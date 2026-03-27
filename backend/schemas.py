from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: Optional[str] = None

class UserCreate(UserBase):
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    is_admin: bool
    has_paid_access: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ScanResultBase(BaseModel):
    filename: str

class ScanResultCreate(ScanResultBase):
    pass

class ScanResultResponse(ScanResultBase):
    id: int
    has_anomalies: bool
    is_scanned: bool
    is_valid_ris: bool
    preview_anomalies: Optional[List[dict]] = None
    total_anomalies: int = 0
    is_analysis_complete: bool = Field(default=False, serialization_alias="is_analysis_complete")
    ocr_status: str = "none"
    ocr_error: Optional[str] = None
    identity_hash: Optional[str] = None
    identity_name: Optional[str] = None
    identity_birth_date: Optional[str] = None
    reliability_score: int = 100
    career_data: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True

class ScanResultDetailedResponse(ScanResultResponse):
    detailed_report: Optional[str] = None
    expert_analysis: Optional[str] = Field(None, alias="ai_analysis")
    raw_text: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[UserResponse] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    token: str
    new_password: str
