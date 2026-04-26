import os
import shutil
import stripe
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="RIS Pro API")

# Configure CORS
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5175")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Receives a PDF file and saves it temporarily."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"message": "File uploaded successfully", "filename": file.filename}

@app.post("/api/create-checkout-session")
async def create_checkout_session():
    """Creates a Stripe Checkout Session for the detailed report (29€)."""
    try:
        if not stripe.api_key or "sk_test" not in stripe.api_key:
            # Fallback for testing without real keys
            return {"url": f"{FRONTEND_URL}/bilan?success=true"}

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'eur',
                    'product_data': {
                        'name': 'Bilan Détaillé RIS Pro',
                        'description': 'Audit complet de votre relevé de carrière, avec génération de courriers.',
                    },
                    'unit_amount': 2900, # 29.00 EUR
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{FRONTEND_URL}/bilan?success=true",
            cancel_url=f"{FRONTEND_URL}/diagnostic?canceled=true",
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
