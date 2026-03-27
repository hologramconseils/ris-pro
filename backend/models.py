from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
import datetime
import hashlib
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    first_name = Column(String)
    last_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False)
    has_paid_access = Column(Boolean, default=False)
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    scans = relationship("ScanResult", back_populates="user")


class ScanResult(Base):
    __tablename__ = "scan_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    filename = Column(String)
    has_anomalies = Column(Boolean, default=False)
    is_scanned = Column(Boolean, default=False)
    is_valid_ris = Column(Boolean, default=False)
    ocr_status = Column(String, default="none") # none, pending, processing, success, failed
    ocr_error = Column(Text, nullable=True)
    raw_text = Column(Text, nullable=True)
    detailed_report = Column(Text, nullable=True) 
    ai_analysis = Column(Text, nullable=True)
    identity_hash = Column(String, index=True, nullable=True) # Hash of Name + BirthDate
    identity_name = Column(String, nullable=True)
    identity_birth_date = Column(String, nullable=True)
    reliability_score = Column(Integer, default=100)
    career_data = Column(Text, nullable=True) # JSON of granular year data
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    user = relationship("User", back_populates="scans")

class IdentityAccess(Base):
    __tablename__ = "identity_access"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    identity_hash = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    scan_id = Column(Integer, ForeignKey("scan_results.id"), nullable=True)
    stripe_session_id = Column(String, unique=True, index=True)
    status = Column(String) # "pending", "completed"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
