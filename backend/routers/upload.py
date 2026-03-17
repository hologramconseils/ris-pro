from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Header, Request, BackgroundTasks
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
    background_tasks: BackgroundTasks,
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

    # Background the AI Audit for all valid RIS or Scans (including guests for preview)
    if result["is_valid_ris"] or result["is_scanned"]:
        background_tasks.add_task(
            run_ai_audit_background,
            db_scan.id,
            file.filename,
            result["detailed_report"],
            result.get("raw_text", ""),
            result.get("images", [])
        )

    # Add preview anomalies for free results
    if db_scan.detailed_report:
        report = json.loads(db_scan.detailed_report)
        db_scan.total_anomalies = len(report)
        if len(report) >= 2:
            oldest = report[0]
            most_recent = report[-1]
            if len(report) > 2:
                most_recent = report[-2]
            db_scan.preview_anomalies = [oldest, most_recent]
        elif len(report) == 1:
            db_scan.preview_anomalies = [report[0]]
            
    return db_scan

async def run_ai_audit_background(
    scan_id: int, 
    filename: str, 
    initial_report: list, 
    raw_text: str, 
    images: list
):
    """Worker function to run expensive AI analysis in the background."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        db_scan = db.query(models.ScanResult).filter(models.ScanResult.id == scan_id).first()
        if not db_scan:
            return

        # Simple Retry Mechanism: 1 retry if AI fails or returns invalid JSON
        ai_commentary = None
        max_retries = 2
        for attempt in range(max_retries):
            try:
                ai_commentary = await ai_service.generate_ai_audit(
                    initial_report, 
                    filename,
                    raw_text=raw_text,
                    images=images
                )
                if ai_service.is_valid_json(ai_commentary):
                    break
                print(f"Attempt {attempt + 1}: AI returned invalid JSON. Retrying...")
            except Exception as e:
                print(f"Attempt {attempt + 1}: AI service error: {e}")
            
            if attempt < max_retries - 1:
                await asyncio.sleep(2)

        if not ai_commentary or not ai_service.is_valid_json(ai_commentary):
            print(f"AI Audit consistently failed for scan {scan_id}")
            # Mark as complete but with error to stop spinner
            db_scan.ai_analysis = json.dumps({"error": "AI Timeout or Invalid Response"})
            db.commit()
            return

        db_scan.ai_analysis = ai_commentary
        
        # Experts AI Logic
        try:
            ai_data = json.loads(ai_commentary)
            if ai_data.get("anomalie_detectee") == "oui":
                db_scan.has_anomalies = True
                
                if ai_data.get("full_timeline"):
                    ai_anomalies = [
                        {
                            "year": item["annee"], 
                            "title": f"Année {item['annee']} : {item['statut']}", 
                            "description": item["anomalie_specifique"],
                            "justificatif": item.get("justificatif_suggere")
                        }
                        for item in ai_data["full_timeline"] if item.get("statut") != "complet"
                    ]
                    if ai_anomalies:
                        db_scan.detailed_report = json.dumps(ai_anomalies)
        except Exception as json_err:
            print(f"Failed to parse AI JSON for scan {scan_id}: {json_err}")
            
        db.commit()
    except Exception as e:
        print(f"Background AI Audit Failed for scan {scan_id}: {e}")
    finally:
        db.close()
        # Cleanup: Delete the uploaded file to save space
        try:
            file_path = os.path.join(UPLOAD_DIR, filename) 
            # Note: filename here is actually the safe_filename passed from upload_file
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as cleanup_err:
            print(f"Cleanup failed for {filename}: {cleanup_err}")

    # Add preview anomalies for free results
    if db_scan.detailed_report:
        report = json.loads(db_scan.detailed_report)
        db_scan.total_anomalies = len(report)
        if len(report) >= 2:
            oldest = report[0]
            most_recent = report[-1]
            if len(report) > 2:
                most_recent = report[-2]
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

@router.get("/preview/{scan_id}", response_model=schemas.ScanResultResponse)
def get_scan_preview(scan_id: int, db: Session = Depends(database.get_db)):
    scan = db.query(models.ScanResult).filter(models.ScanResult.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")
    
    # Compute is_ai_complete for the response
    scan.is_ai_complete = scan.ai_analysis is not None
    
    # Refresh preview anomalies if they were updated by AI
    if scan.detailed_report:
        try:
            report = json.loads(scan.detailed_report)
            scan.total_anomalies = len(report)
            if len(report) >= 2:
                oldest = report[0]
                most_recent = report[-1]
                if len(report) > 2:
                    most_recent = report[-2]
                scan.preview_anomalies = [oldest, most_recent]
            elif len(report) == 1:
                scan.preview_anomalies = [report[0]]
        except:
            pass
            
    return scan

@router.get("/{scan_id}", response_model=schemas.ScanResultDetailedResponse)
def get_scan(scan_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    scan = db.query(models.ScanResult).filter(models.ScanResult.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")
    enable_admin = os.getenv("ENABLE_ADMIN_BYPASS", "true").lower() == "true"
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
