from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
import database, models
from routers.auth import get_current_user
from services import stripe as stripe_service
import os

router = APIRouter(prefix="/billing", tags=["billing"])

@router.post("/create-checkout-session")
def create_checkout_session(
    success_url: str,
    cancel_url: str,
    current_user: models.User = Depends(get_current_user), 
):
    try:
        session = stripe_service.create_checkout_session(current_user, success_url, cancel_url)
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(database.get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    # Ensure env is loaded (redundant but safe for routers)
    from pathlib import Path
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(dotenv_path=_env_path, override=True)
    
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    
    event = stripe_service.process_webhook(payload, sig_header, endpoint_secret, db)
    
    if event is None:
        raise HTTPException(status_code=400, detail="Invalid webhook signature or payload")

    return Response(status_code=200)



