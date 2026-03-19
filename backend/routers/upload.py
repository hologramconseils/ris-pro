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
        print(f"DEBUG: Saving upload to {file_path}") # Added logging
        with open(file_path, "wb") as buffer: # Changed to shutil.copyfileobj for potentially better performance with large files
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
            created_at=datetime.utcnow() # Added created_at
        )
        db.add(new_scan)
        db.commit()
        db.refresh(new_scan)
        print(f"DEBUG: Created scan {new_scan.id} for user {user.id if user else 'anonymous'}") # Added logging

        # 3. Background the ENTIRE analysis pipeline
        background_tasks.add_task(
            run_full_analysis_worker,
            new_scan.id,
            file_path,
            db
        )
                
        return new_scan
    except Exception as e:
        print(f"CRITICAL UPLOAD ERROR: {str(e)}") # Added error logging
        raise HTTPException(status_code=500, detail=f"Échec de l'upload: {str(e)}")

async def run_full_analysis_worker(
    scan_id: int, 
    file_path: str,
    db_session: Session
):
    """Worker function to handle parsing + AI audit in background."""
    print(f"DEBUG: Starting background worker for scan {scan_id}") # Added logging
    db_scan = None
    try:
        db_scan = db_session.query(models.ScanResult).filter(models.ScanResult.id == scan_id).first()
        if not db_scan:
            print(f"ERROR: Scan {scan_id} not found in worker") # Added error logging for None scan
            return

        db_scan.ocr_status = "processing"
        db_session.commit()
        print(f"DEBUG: Scan {scan_id} status -> processing") # Added logging

        # Step 1: Initial Parsing (Fast)
        result = ris_parser.parse_ris_file(file_path)
        
        # Step 2: Update scan info
        db_scan.is_scanned = result.get("is_scanned", False)
        db_scan.is_valid_ris = result.get("is_valid_ris", False)
        db_scan.raw_text = result.get("raw_text", "")
        db_scan.has_anomalies = result.get("has_anomalies", False)
        db_scan.detailed_report = json.dumps(result.get("detailed_report", []))
        db_session.commit()

        # Step 3: Expensive AI Audit (Slow)
        # We only do this if it's a valid RIS or a suspected scan
        if db_scan.is_valid_ris or db_scan.is_scanned:
            ai_commentary = None
            max_retries = 2
            for attempt in range(max_retries):
                try:
                    ai_commentary = await ai_service.generate_ai_audit(
                        result.get("detailed_report", []), 
                        db_scan.filename,
                        raw_text=db_scan.raw_text,
                        images=result.get("images", [])
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
                    if ai_data.get("anomalie_detectee") == "oui":
                        db_scan.has_anomalies = True
                        
                        if ai_data.get("full_timeline"):
                            ai_anomalies = []
                            for item in ai_data["full_timeline"]:
                                if item.get("statut") == "complet": continue
                                
                                activite_str = str(item.get("activite", "")).lower()
                                q_count = int(item.get("trimestres_valides", 0))
                                
                                is_missing_act = not activite_str or any(k in activite_str for k in ["inconnu", "absent", "manquant", "n/a", "trou", "non détecté"])
                                needs_justificatifs = (q_count < 4) and is_missing_act
                                
                                ai_anomalies.append({
                                    "year": item["annee"], 
                                    "title": f"Année {item['annee']} : {item['statut']}", 
                                    "description": item["anomalie_specifique"],
                                    "justificatif": item.get("justificatif_suggere"),
                                    "needs_justificatifs": needs_justificatifs
                                })
                            
                            if ai_anomalies:
                                db_scan.detailed_report = json.dumps(ai_anomalies)
                except Exception as json_err:
                    print(f"JSON Parse AI error: {json_err}")

        # Final update
        db_scan.ocr_status = "success"
        db_session.commit()
        print(f"DEBUG: Worker success for scan {scan_id}") # Added logging

    except Exception as e:
        print(f"CRITICAL WORKER ERROR for scan {scan_id}: {str(e)}") # Added error logging
        if db_scan:
            db_scan.ocr_status = "failed"
            db_scan.ocr_error = str(e)
            db_session.commit()
    finally:
        # Crucial Memory Cleanup
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"DEBUG: Cleaned up {file_path}") # Added logging
            except:
                pass
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
        
        # We assume raw_text is already there, just re-run AI audit
        # (This is a simplified retry for now since file is deleted)
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
        if s.detailed_report:
            try:
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
            except:
                pass
    return scans

@router.get("/preview/{scan_id}", response_model=schemas.ScanResultResponse)
def get_scan_preview(scan_id: int, db: Session = Depends(database.get_db)):
    scan = db.query(models.ScanResult).filter(models.ScanResult.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")
    
    scan.is_ai_complete = scan.ai_analysis is not None
    
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
        raise HTTPException(status_code=403, detail="Vous devez payer pour accéder au rapport détaillé.")
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
