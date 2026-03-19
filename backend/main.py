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

@app.middleware("http")
async def add_security_and_cors_headers(request: Request, call_next):
    # Handle OPTIONS preflight manually for maximum reliability
    if request.method == "OPTIONS":
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "https://ris.hologramconseils.com",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": "true",
            }
        )

    try:
        response: Response = await call_next(request)
    except Exception as e:
        print(f"CORS MIDDLEWARE caught crash: {e}")
        # Build an error response but still add CORS headers
        from fastapi.responses import JSONResponse
        response = JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error during CORS request", "error": str(e)}
        )

    # Standard Security Headers
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Brute-force CORS Headers
    response.headers["Access-Control-Allow-Origin"] = "https://ris.hologramconseils.com"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

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
