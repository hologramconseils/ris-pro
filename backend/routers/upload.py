from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Header, Request
from sqlalchemy.orm import Session
from typing import Optional, List
import database, schemas, models
from services import ris_parser
from routers.auth import get_current_user
from services.auth import SECRET_KEY, ALGORITHM
from jose import jwt, JWTError
import json
import uuid
import os
from services import ai_service
import asyncio
from limiter import limiter

router = APIRouter(prefix="/scans", tags=["scans"])

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

def get_optional_user(authorization: Optional[str] = Header(None), db: Session = Depends(database.get_db)) -> Optional[models.User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            return None
        user = db.query(models.User).filter(models.User.email == email).first()
        return user
    except JWTError:
        return None

@router.post("/upload", response_model=schemas.ScanResultResponse)
@limiter.limit("5/minute")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    user: Optional[models.User] = Depends(get_optional_user)
):
    if file.content_type not in ["application/pdf"]:
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptés.")

    # Save file temporarily
    safe_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())

    # Parse RIS
    result = ris_parser.parse_ris_file(file_path)

    # Save to DB
    db_scan = models.ScanResult(
        user_id=user.id if user else None,
        filename=file.filename,
        has_anomalies=result["has_anomalies"],
        is_scanned=result["is_scanned"],
        is_valid_ris=result["is_valid_ris"],
        detailed_report=json.dumps(result["detailed_report"]) if result["detailed_report"] else None
    )
    db.add(db_scan)
    db.commit()
    db.refresh(db_scan)

    # NEW: AI Audit for logged-in users
    # Always trigger for anything identified as a RIS or a scan
    if user and (result["is_valid_ris"] or result["is_scanned"]):
        try:
            ai_commentary = await ai_service.generate_ai_audit(
                result["detailed_report"], 
                file.filename,
                raw_text=result.get("raw_text", ""),
                images=result.get("images", [])
            )
            db_scan.ai_analysis = ai_commentary
            
            # Sync has_anomalies flag and previews with AI findings (Expert AI is source of truth)
            try:
                ai_data = json.loads(ai_commentary)
                if ai_data.get("anomalie_detectee") == "oui":
                    db_scan.has_anomalies = True
                    
                    # If parser missed everything, try to build preview from AI timeline
                    if not result["detailed_report"] and ai_data.get("full_timeline"):
                        ai_anomalies = [
                            {"year": item["annee"], "title": f"Année {item['annee']} : {item['statut']}", "description": item["anomalie_specifique"]}
                            for item in ai_data["full_timeline"] if item.get("statut") != "complet"
                        ]
                        if ai_anomalies:
                            db_scan.detailed_report = json.dumps(ai_anomalies)
            except:
                pass
                
            db.commit()
        except Exception as e:
            print(f"AI Audit Failed: {e}")

    # Add preview anomalies for free results
    if db_scan.detailed_report:
        report = json.loads(db_scan.detailed_report)
        db_scan.total_anomalies = len(report)
        if len(report) >= 2:
            # Sort by year (assuming title contains the year or report has a 'year' field)
            # Find the most recent anomaly that is NOT the absolute last year
            oldest = report[0]
            most_recent = report[-1]
            if len(report) > 2:
                most_recent = report[-2] # Default to second-to-last
            db_scan.preview_anomalies = [oldest, most_recent]
        elif len(report) == 1:
            db_scan.preview_anomalies = [report[0]]
            
    return db_scan

@router.get("/history", response_model=List[schemas.ScanResultResponse])
def get_history(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    scans = db.query(models.ScanResult).filter(models.ScanResult.user_id == current_user.id).order_by(models.ScanResult.created_at.desc()).all()
    for s in scans:
        if s.detailed_report:
            report = json.loads(s.detailed_report)
            s.total_anomalies = len(report)
            if len(report) >= 2:
                oldest = report[0]
                most_recent = report[-1]
                if len(report) > 2:
                    most_recent = report[-2]
                s.preview_anomalies = [oldest, most_recent]
            elif len(report) == 1:
                s.preview_anomalies = [report[0]]
    return scans

@router.get("/{scan_id}", response_model=schemas.ScanResultDetailedResponse)
def get_scan(scan_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    scan = db.query(models.ScanResult).filter(models.ScanResult.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")
    enable_admin = os.getenv("ENABLE_ADMIN_BYPASS", "false").lower() == "true"
    if not (current_user.has_paid_access or (current_user.is_admin and enable_admin)):
        raise HTTPException(status_code=403, detail="Vous devez payer 19€ pour accéder au rapport détaillé.")
    return scan
@router.delete("/{scan_id}")
def delete_scan(scan_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    scan = db.query(models.ScanResult).filter(models.ScanResult.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")
    if scan.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à supprimer cette analyse.")
    
    db.delete(scan)
    db.commit()
    return {"message": "Analyse supprimée avec succès."}
