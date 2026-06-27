import os
import shutil
import stripe
import httpx
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

async def telecharger_fichier_supabase(file_path: str) -> bytes:
    """Télécharge un document depuis le bucket Supabase pour l'analyser localement."""
    supabase_url = os.environ.get("VITE_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")
    url = f"{supabase_url}/storage/v1/object/authenticated/documents/{file_path}"
    headers = {
        "Authorization": f"Bearer {supabase_key}",
        "apikey": supabase_key
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 200:
            return response.content
        raise Exception(f"Failed to download file from Supabase storage: {response.text}")

try:
    from wealth_advisor_agent import analyser_releve_carriere
except ImportError:
    from backend.wealth_advisor_agent import analyser_releve_carriere

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
    """Receives a PDF file and saves it asynchronously."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    # Lecture/Ecriture asynchrone non-bloquante (FastAPI Pro pattern)
    content = await file.read()
    with open(file_path, "wb") as buffer:
        buffer.write(content)
        
    return {"message": "File uploaded successfully", "filename": file.filename}

@app.post("/api/create-checkout-session")
async def create_checkout_session(data: dict):
    """Creates a Stripe Checkout Session for the detailed report (29€)."""
    file_path = data.get("filePath", "")
    try:
        if not stripe.api_key or "sk_test" not in stripe.api_key:
            # Fallback for testing without real keys
            return {"url": f"{FRONTEND_URL}/bilan?success=true&file={file_path}"}

        import re
        clean_path = re.sub(r'[^a-zA-Z0-9]', '_', file_path)
        idempotency_key = f"checkout_{data.get('userId', 'guest')}_{clean_path}"

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
            success_url=f"{FRONTEND_URL}/bilan?success=true&file={file_path}",
            cancel_url=f"{FRONTEND_URL}/diagnostic?canceled=true&file={file_path}",
            idempotency_key=idempotency_key
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/checkout")
async def api_checkout(data: dict):
    """Alias for create_checkout_session to match frontend requirements."""
    return await create_checkout_session(data)

@app.post("/api/analyze")
async def api_analyze(data: dict):
    """Alias for /api/analyse-patrimoniale to match frontend '/api/analyze' call."""
    file_path = data.get("filePath")
    if not file_path:
        raise HTTPException(status_code=400, detail="Missing filePath parameter")
    filename = os.path.basename(file_path)
    data_for_agent = {"filename": filename}
    return await api_analyse_patrimoniale(data_for_agent)

@app.post("/api/analyse-patrimoniale")
async def api_analyse_patrimoniale(data: dict):
    """Génère un conseil patrimonial personnalisé de manière dynamique à partir d'un relevé PDF."""
    file_name = data.get("filename") or data.get("filePath")
    if not file_name:
        raise HTTPException(status_code=400, detail="Missing filename or filePath parameter")
    
    # Conserver le chemin complet pour Supabase, mais utiliser le nom de base localement
    supabase_path = file_name
    base_name = os.path.basename(file_name)
    file_path = os.path.join(UPLOAD_DIR, base_name)
    
    if not os.path.exists(file_path):
        paths = [file_path, base_name, os.path.join("backend", UPLOAD_DIR, base_name)]
        found = False
        for p in paths:
            if os.path.exists(p):
                file_path = p
                found = True
                break
        if not found:
            # Essayer de télécharger le fichier depuis Supabase
            try:
                if not supabase_path.startswith("uploads/"):
                    supabase_path = f"uploads/{supabase_path}"
                content = await telecharger_fichier_supabase(supabase_path)
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                with open(file_path, "wb") as f:
                    f.write(content)
            except Exception as e:
                raise HTTPException(status_code=404, detail=f"File {file_name} not found locally or on Supabase: {str(e)}")

    try:
        result = await analyser_releve_carriere(file_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
