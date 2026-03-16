import stripe
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.orm import Session
import models

# Charger explicitement le .env depuis le répertoire backend/
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=True)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "").strip() or None

def create_checkout_session(user: models.User, success_url: str, cancel_url: str):
    """
    Create a Stripe checkout session for the user.
    """
    # Always ensure the API key is fresh from environment
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "").strip() or stripe.api_key
    
    # Using a fixed price for the analysis (19€)
    session = stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{
            'price_data': {
                'currency': 'eur',
                'product_data': {
                    'name': 'Analyse Détaillée RIS',
                    'description': 'Accès à vie à l\'analyse détaillée de votre relevé de carrière',
                },
                'unit_amount': 1900, # 19.00 EUR
            },
            'quantity': 1,
        }],
        mode='payment',
        success_url=success_url + ("&" if "?" in success_url else "?") + "session_id={CHECKOUT_SESSION_ID}",
        cancel_url=cancel_url,
        customer_email=user.email,
        metadata={
            "user_id": user.id
        }
    )
    return session

def process_webhook(payload, sig_header, endpoint_secret, db: Session):
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError as e:
        # Invalid payload
        return None
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        return None

    # Handle the checkout.session.completed event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        handle_checkout_session(session, db)

    return event

def handle_checkout_session(session, db: Session):
    user_id = session.get("metadata", {}).get("user_id")
    if user_id:
        user = db.query(models.User).filter(models.User.id == int(user_id)).first()
        if user:
            user.has_paid_access = True
            # Log transaction
            transaction = models.Transaction(
                user_id=user.id,
                stripe_session_id=session.get('id'),
                status="completed"
            )
            db.add(transaction)
            db.commit()
