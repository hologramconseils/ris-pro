import os
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
import database, schemas, models
from services import auth as auth_service, mail as mail_service
from jose import JWTError, jwt
from limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session invalide, veuillez vous reconnecter.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth_service.SECRET_KEY, algorithms=[auth_service.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = await auth_service.get_user(db, email=email)
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=schemas.UserResponse)
@limiter.limit("5/minute")
async def register(request: Request, user: schemas.UserCreate, db: AsyncSession = Depends(database.get_db)):
    db_user = await auth_service.get_user(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Un compte avec cet email existe déjà.")
    
    new_user = await auth_service.create_user(db=db, user=user)
    
    # Send welcome email
    try:
        mail_service.send_welcome_email(new_user.email, new_user.first_name)
    except:
        pass # Don't block registration on email failure
        
    return new_user

@router.post("/token", response_model=schemas.Token)
@limiter.limit("10/minute")
async def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(database.get_db)):
    print(f"LOGIN ATTEMPT: {form_data.username}")
    
    # SECURE FALLBACK: Force access for admin ONLY if explicitly configured in env with a secure password
    admin_pass = os.getenv("ADMIN_PASSWORD")
    admin_email = os.getenv("ADMIN_EMAIL")
    
    is_emergency = False
    if admin_pass and admin_email:
        admin_pass = admin_pass.strip()
        admin_email = admin_email.strip()
        if admin_pass != "admin123" and admin_pass != "":
            is_emergency = (form_data.username.lower() == admin_email.lower() and form_data.password.strip() == admin_pass)
    
    user = await auth_service.get_user(db, email=form_data.username)
    
    if is_emergency:
        if not user:
            # Create the admin user on the fly if missing from DB
            from models import User
            user = User(
                email=admin_email,
                first_name="Admin",
                last_name="Direct",
                is_admin=True,
                hashed_password=auth_service.get_password_hash(admin_pass)
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            print(f"EMERGENCY: Created admin user {admin_email}")
            from services.monitoring import log_security_event
            log_security_event("CRITICAL", f"Admin user created via emergency fallback: {admin_email}", trigger_email_alert=True)
        password_correct = True
        from services.monitoring import log_security_event
        log_security_event("CRITICAL", f"Admin emergency login bypass executed for {admin_email}", trigger_email_alert=True)
    else:
        if not user:
            print(f"LOGIN FAILED: User {form_data.username} not found")
            from services.monitoring import log_security_event
            log_security_event("WARNING", f"Failed login attempt for unknown user: {form_data.username}", trigger_email_alert=False)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email ou mot de passe incorrect.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        password_correct = auth_service.verify_password(form_data.password, user.hashed_password) if user.hashed_password else False

    if not password_correct:
        print(f"LOGIN FAILED: Incorrect password for {form_data.username}")
        from services.monitoring import log_security_event
        log_security_event("WARNING", f"Failed login attempt (incorrect password) for: {form_data.username}", trigger_email_alert=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Auto-promote to admin if email matches ADMIN_EMAIL env var
    admin_email_env = os.getenv("ADMIN_EMAIL")
    if admin_email_env and user.email.lower() == admin_email_env.lower() and not user.is_admin:
        user.is_admin = True
        await db.commit()
        await db.refresh(user)
        from services.monitoring import log_security_event
        log_security_event("INFO", f"User promoted to administrator on login: {user.email}", trigger_email_alert=True)
    elif user.is_admin:
        from services.monitoring import log_security_event
        log_security_event("INFO", f"Administrator logged in successfully: {user.email}", trigger_email_alert=True)

    access_token_expires = timedelta(minutes=auth_service.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth_service.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": user
    }

@router.post("/forgot-password")
async def forgot_password(request: schemas.ForgotPasswordRequest, db: AsyncSession = Depends(database.get_db)):
    user = await auth_service.get_user(db, email=request.email)
    if not user:
        # We return 200 even if user doesn't exist for security
        return {"message": "Si cet email existe, un lien de réinitialisation a été envoyé."}
    
    token = auth_service.create_reset_token(user.email)
    
    # Save token for verification
    user.reset_token = token
    await db.commit()
    
    try:
        mail_service.send_reset_password_email(user.email, user.first_name, token)
    except:
        pass
        
    return {"message": "Instructions envoyées par email."}

@router.post("/reset-password")
async def reset_password(request: schemas.PasswordReset, db: AsyncSession = Depends(database.get_db)):
    email = auth_service.verify_reset_token(request.token)
    if not email:
        raise HTTPException(status_code=400, detail="Lien de réinitialisation invalide ou expiré.")
    
    user = await auth_service.get_user(db, email=email)
    if not user or user.reset_token != request.token:
        raise HTTPException(status_code=400, detail="Lien déjà utilisé ou invalide.")
    
    await auth_service.update_password(db, user, request.new_password)
    return {"message": "Mot de passe mis à jour avec succès."}

@router.get("/me", response_model=schemas.UserResponse)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user
