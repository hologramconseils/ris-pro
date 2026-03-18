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
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://js.stripe.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https://*.stripe.com; "
        "frame-src https://js.stripe.com;"
    )
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# CORS Settings - Use ALLOWED_ORIGINS env var for production
default_origins = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5173,https://ris.hologramconseils.com"
allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", default_origins).split(",")]

# CORS Settings
# IMPORTANT: When allow_credentials=True, allow_origins CANNOT be ["*"]
allowed_origins = [
    "https://ris.hologramconseils.com",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
