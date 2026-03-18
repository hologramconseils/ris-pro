from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import database, models, schemas
from routers.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

def check_admin(user: models.User = Depends(get_current_user)):
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs."
        )
    return user

@router.get("/users", response_model=List[schemas.UserResponse])
def get_all_users(
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(check_admin)
):
    """Récupère tous les utilisateurs et leur activité (admin uniquement)"""
    return db.query(models.User).order_by(models.User.created_at.desc()).all()

@router.get("/stats")
def get_stats(
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(check_admin)
):
    """Statistiques globales pour le dashboard"""
    total_users = db.query(models.User).count()
    paid_users = db.query(models.User).filter(models.User.has_paid_access == True).count()
    total_scans = db.query(models.ScanResult).count()
    
    return {
        "total_users": total_users,
        "paid_users": paid_users,
        "total_scans": total_scans
    }
