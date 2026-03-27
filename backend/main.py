from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import os
import models
from routers import auth, upload, stripe as stripe_router, admin
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response
from limiter import limiter

# Create DB tables on startup
models.Base.metadata.create_all(bind=engine)

# Manual Migration Helper for existing databases
def check_and_update_schema():
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns("scan_results")]
    
    with engine.connect() as conn:
        if "ocr_status" not in columns:
            print("Migration: Adding ocr_status to scan_results")
            conn.execute(text("ALTER TABLE scan_results ADD COLUMN ocr_status VARCHAR DEFAULT 'none'"))
            conn.commit()
        if "ocr_error" not in columns:
            print("Migration: Adding ocr_error to scan_results")
            conn.execute(text("ALTER TABLE scan_results ADD COLUMN ocr_error TEXT"))
            conn.commit()
        if "raw_text" not in columns:
            print("Migration: Adding raw_text to scan_results")
            conn.execute(text("ALTER TABLE scan_results ADD COLUMN raw_text TEXT"))
            conn.commit()
        if "identity_hash" not in columns:
            print("Migration: Adding identity_hash to scan_results")
            conn.execute(text("ALTER TABLE scan_results ADD COLUMN identity_hash VARCHAR"))
            conn.commit()
        if "identity_name" not in columns:
            print("Migration: Adding identity_name to scan_results")
            conn.execute(text("ALTER TABLE scan_results ADD COLUMN identity_name VARCHAR"))
            conn.commit()
        if "identity_birth_date" not in columns:
            print("Migration: Adding identity_birth_date to scan_results")
            conn.execute(text("ALTER TABLE scan_results ADD COLUMN identity_birth_date VARCHAR"))
            conn.commit()
        if "reliability_score" not in columns:
            print("Migration: Adding reliability_score to scan_results")
            conn.execute(text("ALTER TABLE scan_results ADD COLUMN reliability_score INTEGER DEFAULT 100"))
            conn.commit()
        if "career_data" not in columns:
            print("Migration: Adding career_data to scan_results")
            conn.execute(text("ALTER TABLE scan_results ADD COLUMN career_data TEXT"))
            conn.commit()
        
        # Check transactions table
        columns_trans = [c['name'] for c in inspector.get_columns("transactions")]
        if "scan_id" not in columns_trans:
            print("Migration: Adding scan_id to transactions")
            conn.execute(text("ALTER TABLE transactions ADD COLUMN scan_id INTEGER REFERENCES scan_results(id)"))
            conn.commit()

try:
    check_and_update_schema()
except Exception as e:
    print(f"Migration failed (might be already up to date): {e}")

app = FastAPI(
    title="RIS Pro API",
    description="API pour l'analyse des Relevés Individuels de Situation",
    version="1.0.0"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Standard CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://ris.hologramconseils.com",
        "https://ris-scan-pro.vercel.app",
    ],
    allow_origin_regex="https://ris-scan-pro-.*\\.vercel\\.app", # Allow all Vercel previews
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    try:
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        from fastapi.responses import JSONResponse
        # Manually add CORS headers to the error response so the frontend sees the message instead of 'Network Error'
        error_response = JSONResponse(
            status_code=500,
            content={"detail": "Une erreur interne est survenue.", "error": str(e)}
        )
        origin = request.headers.get("origin")
        if origin:
            error_response.headers["Access-Control-Allow-Origin"] = origin
            error_response.headers["Access-Control-Allow-Credentials"] = "true"
        error_response.headers["Access-Control-Allow-Methods"] = "*"
        error_response.headers["Access-Control-Allow-Headers"] = "*"
        return error_response

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(stripe_router.router)
app.include_router(admin.router)

@app.get("/")
def read_root():
    return {"message": "RIS Pro API v1.0"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
