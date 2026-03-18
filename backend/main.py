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

    response: Response = await call_next(request)
    
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
