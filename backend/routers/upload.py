import httpx
import json
import os
import uuid
import shutil
import asyncio
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Header, Request, BackgroundTasks
from sqlalchemy.orm import Session

import database
import schemas
import models
from services import ris_parser, ai_service
from services.rules_engine import RetirementRulesEngine
from routers.auth import get_current_user
from services.auth import SECRET_KEY, ALGORITHM
from jose import jwt, JWTError
from limiter import limiter

router = APIRouter(prefix="/scans", tags=["scans"])

UPLOAD_DIR = "/tmp/ris_uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

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
@limiter.limit("20/minute")
async def upload_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    user: Optional[models.User] = Depends(get_optional_user)
):
    if file.content_type not in ["application/pdf"]:
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptés.")

    try:
        # 1. Save file temporarily
        safe_filename = f"{uuid.uuid4()}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. Create entry in DB with 'pending' status immediately
        new_scan = models.ScanResult(
            user_id=user.id if user else None,
            filename=file.filename,
            has_anomalies=False,
            is_scanned=False,
            is_valid_ris=False,
            ocr_status="pending",
            detailed_report="[]",
            raw_text="",
            created_at=datetime.utcnow()
        )
        db.add(new_scan)
        db.commit()
        db.refresh(new_scan)

        # 3. Background the ENTIRE analysis pipeline
        background_tasks.add_task(
            run_full_analysis_worker,
            new_scan.id,
            file_path
        )
                
        return new_scan
    except Exception as e:
        print(f"CRITICAL UPLOAD ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Échec de l'upload: {str(e)}")

async def run_full_analysis_worker(
    scan_id: int, 
    file_path: str
):
    """Worker function to handle parsing + AI audit in background."""
    from database import SessionLocal
    db_session = SessionLocal()
    db_scan = None
    try:
        db_scan = db_session.query(models.ScanResult).filter(models.ScanResult.id == scan_id).first()
        if not db_scan:
            return

        db_scan.ocr_status = "processing"
        db_session.commit()

        # Step 1: Initial Parsing (Fast)
        parser_res = ris_parser.parse_ris_file(file_path)
        
        # Calculate reliability score and technical audit
        career_raw = parser_res.get("career_data", [])
        technical_audit = []
        for year_item in career_raw:
            audit_item = RetirementRulesEngine.get_year_validation_status(year_item)
            technical_audit.append(audit_item)
            
        reliability_score = RetirementRulesEngine.get_reliability_score(technical_audit)

        # Update ScanResult
        db_scan.is_valid_ris = parser_res.get("is_valid_ris", False)
        db_scan.has_anomalies = parser_res.get("has_anomalies", False)
        db_scan.is_scanned = parser_res.get("is_scanned", False)
        db_scan.raw_text = parser_res.get("raw_text", "")
        db_scan.detailed_report = json.dumps(parser_res.get("detailed_report", []))
        db_scan.identity_hash = parser_res.get("identity_hash")
        db_scan.identity_name = parser_res.get("identity_name")
        db_scan.identity_birth_date = parser_res.get("identity_birth_date")
        db_scan.reliability_score = reliability_score
        db_scan.career_data = json.dumps(technical_audit) # Enriched data
        
        db_session.commit()

        # Step 3: Expensive AI Audit (Slow)
        if db_scan.is_valid_ris or db_scan.is_scanned:
            ai_commentary = None
            max_retries = 2
            for attempt in range(max_retries):
                try:
                    # Extract birth year from identity_birth_date (DD/MM/YYYY)
                    birth_year = 1980
                    if db_scan.identity_birth_date and "/" in db_scan.identity_birth_date:
                        try:
                            birth_year = int(db_scan.identity_birth_date.split("/")[-1])
                        except: pass

                    ai_commentary = await ai_service.generate_ai_audit(
                        parser_res.get("detailed_report", []), 
                        db_scan.filename,
                        raw_text=db_scan.raw_text,
                        images=parser_res.get("images", []),
                        career_data=technical_audit,
                        birth_year=birth_year
                    )
                    if ai_service.is_valid_json(ai_commentary):
                        break
                except Exception as e:
                    print(f"AI attempt {attempt+1} failed: {e}")
                
                if attempt < max_retries - 1:
                    await asyncio.sleep(2)

            if ai_commentary and ai_service.is_valid_json(ai_commentary):
                db_scan.ai_analysis = ai_commentary
                try:
                    ai_data = json.loads(ai_commentary)
                    # Use a more robust check for timeline anomalies
                    full_timeline = ai_data.get("full_timeline", [])
                    ai_anomalies = []
                    
                    for item in full_timeline:
                        # Skip 'complet' years only if they truly have no issues
                        # But prioritize the AI's flagging of anomalies
                        statut = str(item.get("statut", "")).lower()
                        if statut == "complet":
                            continue
                            
                        # Extract data safely with default values
                        year = item.get("annee", "N/A")
                        activite_str = str(item.get("activite", "")).lower()
                        q_count = 0
                        try:
                            q_count = int(item.get("trimestres_valides", 0))
                        except (TypeError, ValueError):
                            pass
                        
                        is_missing_act = not activite_str or any(k in activite_str for k in ["inconnu", "absent", "manquant", "n/a", "trou", "non détecté"])
                        needs_justificatifs = (q_count < 4) or is_missing_act
                        
                        ai_anomalies.append({
                            "year": year, 
                            "title": f"Année {year} : {item.get('statut', 'Anomalie')}", 
                            "description": item.get("anomalie_specifique", "Incohérence détectée"),
                            "justificatif": item.get("justificatif_suggere"),
                            "needs_justificatifs": needs_justificatifs,
                            "points_complementaires": item.get("points_complementaires"),
                            "trimestres_valides": q_count
                        })
                    
                    if ai_anomalies:
                        db_scan.detailed_report = json.dumps(ai_anomalies)
                        db_scan.has_anomalies = True
                    
                except Exception as json_err:
                    print(f"JSON Parse AI error: {json_err}")

        # Final update
        db_scan.ocr_status = "success"
        db_session.commit()

    except Exception as e:
        print(f"CRITICAL WORKER ERROR for scan {scan_id}: {str(e)}")
        if db_scan:
            db_scan.ocr_status = "failed"
            db_scan.ocr_error = str(e)
            db_session.commit()
    finally:
        if os.path.exists(file_path):
            try: os.remove(file_path)
            except: pass
        db_session.close()

@router.post("/{scan_id}/retry")
async def retry_scan_analysis(
    scan_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user)
):
    scan = db.query(models.ScanResult).filter(models.ScanResult.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")
    
    if scan.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Non autorisé.")

    scan.ocr_status = "pending"
    scan.ocr_error = None
    scan.ai_analysis = None
    db.commit()

    background_tasks.add_task(
        run_full_analysis_worker_from_existing_text,
        scan.id,
        db
    )
    return {"message": "Analyse relancée."}

async def run_full_analysis_worker_from_existing_text(
    scan_id: int,
    db_session: Session
):
    """Worker to retry only the AI part if text is already extracted."""
    db_scan = None
    try:
        db_scan = db_session.query(models.ScanResult).filter(models.ScanResult.id == scan_id).first()
        if not db_scan: return
        
        db_scan.ocr_status = "processing"
        db_session.commit()
        
        ai_commentary = await ai_service.generate_ai_audit(
            json.loads(db_scan.detailed_report or "[]"),
            db_scan.filename,
            raw_text=db_scan.raw_text or ""
        )
        
        if ai_service.is_valid_json(ai_commentary):
            db_scan.ai_analysis = ai_commentary
            db_scan.ocr_status = "success"
        else:
            db_scan.ocr_status = "failed"
            db_scan.ocr_error = "L'IA n'a pas pu générer un rapport valide."
            
        db_session.commit()
    except Exception as e:
        if db_scan:
            db_scan.ocr_status = "failed"
            db_scan.ocr_error = str(e)
            db_session.commit()
    finally:
        db_session.close()

@router.get("/history", response_model=List[schemas.ScanResultResponse])
def get_history(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    scans = db.query(models.ScanResult).filter(models.ScanResult.user_id == current_user.id).order_by(models.ScanResult.created_at.desc()).all()
    for s in scans:
        s.is_analysis_complete = s.ocr_status in ["success", "failed"]
        if s.detailed_report:
            try:
                report = json.loads(s.detailed_report)
                s.total_anomalies = len(report)
                if len(report) >= 2:
                    s.preview_anomalies = [report[0], report[-1]]
                elif len(report) == 1:
                    s.preview_anomalies = [report[0]]
                else:
                    s.preview_anomalies = []
            except:
                s.preview_anomalies = []
    return scans

@router.get("/preview/{scan_id}", response_model=schemas.ScanResultResponse)
def get_scan_preview(scan_id: int, db: Session = Depends(database.get_db)):
    scan = db.query(models.ScanResult).filter(models.ScanResult.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")
    
    scan.is_analysis_complete = scan.ocr_status in ["success", "failed"]
    
    if scan.detailed_report:
        try:
            report = json.loads(scan.detailed_report)
            scan.total_anomalies = len(report)
            if len(report) >= 2:
                scan.preview_anomalies = [report[0], report[-1]]
            elif len(report) == 1:
                scan.preview_anomalies = [report[0]]
            else:
                scan.preview_anomalies = []
        except:
            scan.preview_anomalies = []
            
    return scan

@router.get("/{scan_id}", response_model=schemas.ScanResultDetailedResponse)
def get_scan(scan_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    scan = db.query(models.ScanResult).filter(models.ScanResult.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")
    # Admin bypass
    if current_user.is_admin and os.getenv("ENABLE_ADMIN_BYPASS", "true").lower() == "true":
        return scan
        
    # Folder-based access: check if user has paid for this identity_hash
    if not scan.identity_hash:
        # If no identity extracted, we fallback to old global access (or deny)
        if current_user.has_paid_access: return scan
        raise HTTPException(status_code=403, detail="Analyse en cours ou identité non détectée.")

    access_entry = db.query(models.IdentityAccess).filter(
        models.IdentityAccess.user_id == current_user.id,
        models.IdentityAccess.identity_hash == scan.identity_hash
    ).first()
    
    if not access_entry:
        # Check if user has global access (old model) - migration support
        if current_user.has_paid_access:
            return scan
        raise HTTPException(status_code=403, detail="Vous devez payer pour accéder au rapport détaillé de ce dossier.")
        
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
