import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

current_dir = os.path.dirname(os.path.abspath(__file__))
default_db_path = os.path.join(current_dir, "ris_scan_pro.db")
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{default_db_path}")

if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if (SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("sqlite")) else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
