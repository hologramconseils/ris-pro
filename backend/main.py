from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import os
import models
from routers import auth, upload, stripe as stripe_router

# Create DB tables on startup
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="RIS Scan Pro API",
    description="API pour l'analyse des Relevés Individuels de Situation",
    version="1.0.0"
)

# CORS Settings - Use ALLOWED_ORIGINS env var for production
allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5173").split(",")]

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

@app.get("/")
def read_root():
    return {"message": "RIS Scan Pro API v1.0"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
