from sqlalchemy import Boolean, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship, Mapped, mapped_column
import datetime
import hashlib
from database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    first_name: Mapped[str] = mapped_column()
    last_name: Mapped[str | None] = mapped_column(nullable=True)
    hashed_password: Mapped[str | None] = mapped_column(nullable=True)
    is_admin: Mapped[bool] = mapped_column(default=False)
    has_paid_access: Mapped[bool] = mapped_column(default=False)
    reset_token: Mapped[str | None] = mapped_column(nullable=True)
    reset_token_expires: Mapped[datetime.datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(default=datetime.datetime.utcnow)

    scans = relationship("ScanResult", back_populates="user")

class ScanResult(Base):
    __tablename__ = "scan_results"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    filename: Mapped[str] = mapped_column()
    has_anomalies: Mapped[bool] = mapped_column(default=False)
    is_scanned: Mapped[bool] = mapped_column(default=False)
    is_valid_ris: Mapped[bool] = mapped_column(default=False)
    ocr_status: Mapped[str] = mapped_column(default="none") # none, pending, processing, success, failed
    ocr_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    detailed_report: Mapped[str | None] = mapped_column(Text, nullable=True) 
    ai_analysis: Mapped[str | None] = mapped_column(Text, nullable=True)
    identity_hash: Mapped[str | None] = mapped_column(index=True, nullable=True) # Hash of Name + BirthDate
    identity_name: Mapped[str | None] = mapped_column(nullable=True)
    identity_birth_date: Mapped[str | None] = mapped_column(nullable=True)
    reliability_score: Mapped[int] = mapped_column(default=100)
    career_data: Mapped[str | None] = mapped_column(Text, nullable=True) # JSON of granular year data
    created_at: Mapped[datetime.datetime] = mapped_column(default=datetime.datetime.utcnow, index=True)

    user = relationship("User", back_populates="scans")

class IdentityAccess(Base):
    __tablename__ = "identity_access"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    identity_hash: Mapped[str] = mapped_column(index=True)
    created_at: Mapped[datetime.datetime] = mapped_column(default=datetime.datetime.utcnow)

class Transaction(Base):
    __tablename__ = "transactions"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    scan_id: Mapped[int | None] = mapped_column(ForeignKey("scan_results.id"), nullable=True)
    stripe_session_id: Mapped[str] = mapped_column(unique=True, index=True)
    status: Mapped[str] = mapped_column() # "pending", "completed"
    created_at: Mapped[datetime.datetime] = mapped_column(default=datetime.datetime.utcnow)
