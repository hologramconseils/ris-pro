import os
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import database, schemas, models
from services import auth as auth_service, mail as mail_service
from jose import JWTError, jwt
from limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
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
    user = auth_service.get_user(db, email=email)
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=schemas.UserResponse)
@limiter.limit("5/minute")
def register(request: Request, user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = auth_service.get_user(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Un compte avec cet email existe déjà.")
    
    new_user = auth_service.create_user(db=db, user=user)
    
    # Send welcome email
    try:
        mail_service.send_welcome_email(new_user.email, new_user.first_name)
    except:
        pass # Don't block registration on email failure
        
    return new_user

@router.post("/token", response_model=schemas.Token)
@limiter.limit("10/minute")
def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = auth_service.get_user(db, email=form_data.username)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Support existing hashed password
    password_correct = False
    if user.hashed_password and auth_service.verify_password(form_data.password, user.hashed_password):
        password_correct = True
    
    # Emergency fallback: Allow login with SMTP_PASSWORD for ADMIN_EMAIL
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    admin_email = os.getenv("ADMIN_EMAIL", "").strip()
    if admin_email and smtp_password and form_data.username.lower() == admin_email.lower():
        if form_data.password.strip() == smtp_password:
            password_correct = True

    if not password_correct:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Auto-promote to admin if email matches ADMIN_EMAIL env var
    admin_email = os.getenv("ADMIN_EMAIL")
    if admin_email and user.email.lower() == admin_email.lower() and not user.is_admin:
        user.is_admin = True
        db.commit()
        db.refresh(user)

    # Update login tracking
    user.last_login = datetime.utcnow()
    user.login_count = (user.login_count or 0) + 1
    db.commit()
    db.refresh(user)

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
def forgot_password(request: schemas.ForgotPasswordRequest, db: Session = Depends(database.get_db)):
    user = auth_service.get_user(db, email=request.email)
    if not user:
        # We return 200 even if user doesn't exist for security
        return {"message": "Si cet email existe, un lien de réinitialisation a été envoyé."}
    
    token = auth_service.create_reset_token(user.email)
    # Actually I used create_reset_token in auth service.
    token = auth_service.create_reset_token(user.email)
    
    # Save token for verification (optional if using JWT, but good for one-time use)
    user.reset_token = token
    db.commit()
    
    try:
        mail_service.send_reset_password_email(user.email, user.first_name, token)
    except:
        pass
        
    return {"message": "Instructions envoyées par email."}

@router.post("/reset-password")
def reset_password(request: schemas.PasswordReset, db: Session = Depends(database.get_db)):
    email = auth_service.verify_reset_token(request.token)
    if not email:
        raise HTTPException(status_code=400, detail="Lien de réinitialisation invalide ou expiré.")
    
    user = auth_service.get_user(db, email=email)
    if not user or user.reset_token != request.token:
        raise HTTPException(status_code=400, detail="Lien déjà utilisé ou invalide.")
    
    auth_service.update_password(db, user, request.new_password)
    return {"message": "Mot de passe mis à jour avec succès."}

@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user
