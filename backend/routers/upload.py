import httpx
import json
import os
import uuid
import shutil
import asyncio
import re
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Header, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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

def get_optional_user(authorization: Optional[str] = Header(None), db: AsyncSession = Depends(database.get_db)) -> Optional[models.User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            return None
        user = (await db.execute(select(models.User).filter(models.User.email == email))).scalars().first()
        return user
    except JWTError:
        return None

@router.post("/upload", response_model=schemas.ScanResultResponse)
@limiter.limit("20/minute")
async def upload_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(database.get_db),
    user: Optional[models.User] = Depends(get_optional_user)
):
    if file.content_type not in ["application/pdf"]:
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptés.")

    try:
        # Purger physiquement les anciens fichiers temporaires
        if os.path.exists(UPLOAD_DIR):
            for old_file in os.listdir(UPLOAD_DIR):
                old_path = os.path.join(UPLOAD_DIR, old_file)
                try:
                    if os.path.isfile(old_path):
                        os.remove(old_path)
                except Exception as clean_err:
                    print(f"Error purging old file {old_path}: {clean_err}")

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
        await db.commit()
        await db.refresh(new_scan)

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

def _generate_justificatifs_for_entry(entry):
    """CORRECTIF 4: Génère la liste des justificatifs en fonction du type d'anomalie."""
    q = entry.get('ris_quarters', 0)
    salary = entry.get('salary', 0)
    status = entry.get('status', 'anomalie')
    justifs = []
    if q < 4 or salary == 0 or status == 'anomalie':
        justifs.append("• Bulletins de salaire pour la période concernée")
        justifs.append("• Contrat de travail")
        justifs.append("• Certificat de travail")
        justifs.append("• Attestation employeur")
        justifs.append("• Attestation sur l'honneur d'activité ou de non-activité")
    return "\n".join(justifs) if justifs else None

async def run_full_analysis_worker(
    scan_id: int, 
    file_path: str
):
    """Worker function to handle parsing + AI audit in background."""
    from database import AsyncSessionLocal
    from sqlalchemy import select
    async with AsyncSessionLocal() as db_session:
    db_scan = None
    try:
        db_scan = (await db_session.execute(select(models.ScanResult).filter(models.ScanResult.id == scan_id))).scalars().first()
        if not db_scan:
            return

        db_scan.ocr_status = "processing"
        await db_session.commit()

        # Step 1: Initial Parsing (Fast)
        parser_res = ris_parser.parse_ris_file(file_path)
        
        if "error" in parser_res and parser_res["error"]:
            raise Exception(parser_res["error"])
        
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
        
        await db_session.commit()

        # Step 3: Expensive AI Audit (Slow)
        if db_scan.is_valid_ris or db_scan.is_scanned:
            ai_commentary = None
            max_retries = 2
            for attempt in range(max_retries):
                try:
                    # Extract birth year and month from identity_birth_date (DD/MM/YYYY or string)
                    birth_year = 1965
                    birth_month = 1
                    if db_scan.identity_birth_date:
                        try:
                            # Try to find DD/MM/YYYY
                            b_match = re.search(r"(\d{2})/(\d{2})/(19[5-9]\d|20[0-2]\d)", str(db_scan.identity_birth_date))
                            if b_match:
                                birth_month = int(b_match.group(2))
                                birth_year = int(b_match.group(3))
                            else:
                                year_match = re.search(r"(19[5-9]\d|20[0-2]\d)", str(db_scan.identity_birth_date))
                                if year_match:
                                    birth_year = int(year_match.group(1))
                        except: pass

                    # Truncate raw_text if too large to prevent API payload errors
                    truncated_text = db_scan.raw_text[:35000] if db_scan.raw_text else ""
                    
                    ai_commentary = await ai_service.generate_ai_audit(
                        parser_res.get("detailed_report", []), 
                        db_scan.filename,
                        raw_text=truncated_text,
                        images=parser_res.get("images", []),
                        career_data=technical_audit,
                        birth_year=birth_year,
                        birth_month=birth_month
                    )
                    if ai_service.is_valid_json(ai_commentary):
                        break
                except Exception as e:
                    print(f"AI attempt {attempt+1} failed: {e}")
                
                if attempt < max_retries - 1:
                    await asyncio.sleep(2)

            # --- POST-PROCESSING & DATA UNIFICATION ---
            
            # 1. Ensure ai_analysis is NEVER NULL if the document was processed
            if not ai_commentary or not ai_service.is_valid_json(ai_commentary):
                # ENHANCED FALLBACK: Reconstruct structured analysis from Technical Audit
                anoms = parser_res.get("detailed_report", [])
                has_anom = "oui" if anoms else "non"
                risk_lvl = "moyen" if anoms else "faible"
                
                # Create a meaningful summary
                tech_summary = "L'analyse technique a été effectuée avec succès. "
                if anoms:
                    tech_summary += f"{len(anoms)} point(s) d'attention ont été identifiés sur vos droits à la retraite."
                else:
                    tech_summary += "Aucune anomalie majeure n'a été détectée."

                ai_commentary = json.dumps({
                    "anomalie_detectee": has_anom,
                    "niveau_risque": risk_lvl,
                    "resume_global": tech_summary,
                    "resume": tech_summary,
                    "compte_rendu": "Synthèse de l'expertise technique :\n\n" + "\n".join([f"• {a['title']} : {a['description']}" for a in anoms[:5]]),
                    "analyse_detaillee": "Analyse technique approfondie effectuée par RIS Pro.",
                    "full_timeline": [],
                    "projection_estimee": "En attente de calcul expert"
                }, ensure_ascii=False)

            ### FROZEN MODULE: NON-NATIVE ANALYSIS - SCAN WARNING ###
            # 2. Add OCR uncertainty warning if scanned
            if db_scan.is_scanned:
                try:
                    ai_data = json.loads(ai_commentary)
                    warning_prefix = "⚠️ L'analyse est basée sur un document scanné dont la restitution peut comporter des approximations. Veuillez vérifier les informations.\n\n"
                    if "resume_global" in ai_data:
                        ai_data["resume_global"] = warning_prefix + ai_data["resume_global"]
                    ai_commentary = json.dumps(ai_data, ensure_ascii=False)
                except: pass
            ### END FROZEN MODULE ###
            
            db_scan.ai_analysis = ai_commentary

            # CORRECTIF 1: Injection de la projection de pension calculée par le moteur expert
            try:
                ai_data_proj = json.loads(db_scan.ai_analysis)
                if career_raw and technical_audit:
                    proj_birth_year = birth_year  # Already computed above
                    total_pts = sum(float(e.get("ris_points", 0.0)) for e in technical_audit)
                    total_q = sum(int(e.get("ris_quarters", 0)) for e in technical_audit)
                    last_salary = next((float(e.get("salary", 0)) for e in reversed(technical_audit) if float(e.get("salary", 0)) > 0), 30000)
                    
                    proj_result = RetirementRulesEngine.project_future_career(
                        total_points=total_pts, birth_year=proj_birth_year,
                        current_salary=last_salary, current_quarters=total_q,
                        birth_month=birth_month, career_data=career_raw
                    )
                    sam_val = RetirementRulesEngine.calculate_sam(career_raw)
                    base_p = RetirementRulesEngine.calculate_base_pension(
                        sam_val,
                        proj_result.get("projected_quarters", total_q),
                        proj_result.get("required_quarters", 172)
                    )
                    svc_val = 1.4386
                    res_2025 = RetirementRulesEngine.get_year_data(2025) or {}
                    if isinstance(res_2025, dict) and "unified" in res_2025:
                        svc_val = float(res_2025["unified"].get("service", 1.4386))
                    comp_p = RetirementRulesEngine.calculate_complementary_pension(
                        proj_result.get("projected_points", total_pts), svc_val
                    )
                    total_monthly = round((base_p + comp_p) / 12.0, 2)
                    
                    ai_data_proj["projection_estimee"] = f"{total_monthly} €/mois"
                    ai_data_proj["projection_detail"] = {
                        "base_mensuelle": round(base_p / 12.0, 2),
                        "complementaire_mensuelle": round(comp_p / 12.0, 2),
                        "total_mensuel": total_monthly,
                        "sam": round(sam_val, 2),
                        "trimestres_projetes": proj_result.get("projected_quarters", 0),
                        "taux_plein": proj_result.get("has_full_rate", False),
                        "age_legal": proj_result.get("legal_age_display", "64 ans")
                    }
                    db_scan.ai_analysis = json.dumps(ai_data_proj, ensure_ascii=False)
            except Exception as proj_err:
                print(f"Projection injection error: {proj_err}")
            
            # 3. CRITICAL DATA MERGE: Algorithmic Anomalies + AI Anomalies
            try:
                ai_data = json.loads(db_scan.ai_analysis)  # Lire depuis ai_analysis, pas ai_commentary, pour conserver la projection (Correctif 1)
                full_timeline = ai_data.get("full_timeline", [])
                
                # Start with algorithmic anomalies
                merged_anomalies = parser_res.get("detailed_report", [])
                
                # Append AI-detected anomalies without duplicates (by year)
                existing_years = {str(x.get("year")) for x in merged_anomalies}
                
                for item in full_timeline:
                    statut = str(item.get("statut", "")).lower()
                    year = str(item.get("annee", ""))
                    
                    if statut == "complet" or not year or year in existing_years:
                        continue
                        
                    q_count = 0
                    try:
                        q_count = int(item.get("trimestres_valides", 0))
                    except: pass
                    
                    activite_str = str(item.get("activite", "")).lower()
                    is_missing_act = not activite_str or any(k in activite_str for k in ["inconnu", "absent", "manquant", "n/a", "trou"])
                    needs_justificatifs = (q_count < 4) or is_missing_act
                    
                    merged_anomalies.append({
                        "year": int(year) if year.isdigit() else year, 
                        "title": f"Année {year} : {item.get('statut', 'Anomalie')}", 
                        "description": item.get("anomalie_specifique", "Incohérence détectée par l'expertise complémentaire"),
                        "justificatif": item.get("justificatif_suggere"),
                        "needs_justificatifs": needs_justificatifs,
                        "points_complementaires": item.get("points_complementaires"),
                        "trimestres_valides": q_count
                    })
                
                # Final sorting and update
                merged_anomalies.sort(key=lambda x: int(str(x.get("year", 0))) if str(x.get("year")).isdigit() else 0)
                db_scan.detailed_report = json.dumps(merged_anomalies, ensure_ascii=False)
                db_scan.has_anomalies = len(merged_anomalies) > 0
                
                # --- NATIVE PDF PRECISION INJECTION ---
                # For native PDFs, we use TECHNICAL_AUDIT as the PRIMARY source because it's exhaustive.
                # AI (Full Timeline) is used to ENRICH the technical data with expert commentary.
                if not db_scan.is_scanned:
                    precision_career = []
                    ai_timeline_map = {int(str(item.get("annee"))): item for item in full_timeline if str(item.get("annee", "")).isdigit()}
                    
                    # Iterate over ALL technical entries to ensure a complete Control Table
                    for tech_entry in technical_audit:
                        y_int = tech_entry.get("year", 0)
                        if y_int >= datetime.now().year: continue # Strict 2026+ filter
                        
                        ai_item = ai_timeline_map.get(y_int, {})
                        
                        # CORRECTIF 2: Enrichir l'employeur depuis l'IA
                        ai_activite = ai_item.get("activite", "")
                        employer_val = tech_entry.get("employer", tech_entry.get("regime", "Inconnu"))
                        if ai_activite and ai_activite.lower() not in ["agirc-arrco", "n/a", "inconnu", "", "complémentaire"]:
                            employer_val = ai_activite
                        elif employer_val.lower() in ["agirc-arrco", "complémentaire"]:
                            employer_val = ai_activite if ai_activite else tech_entry.get("regime", "Inconnu")
                        
                        # Merge Technical Data + AI Commentary
                        entry = {
                            "year": y_int,
                            "salary": tech_entry.get("salary", 0.0),
                            "ris_quarters": tech_entry.get("ris_quarters", 0),
                            "ris_points": tech_entry.get("ris_points", 0.0),
                            "regime": tech_entry.get("regime", "Inconnu"),
                            "employer": employer_val,
                            # Carry over AI's specific findings if they exist
                            "anomalie_specifique": ai_item.get("anomalie_specifique"),
                            "justificatif_suggere": ai_item.get("justificatif_suggere"),
                            "statut": ai_item.get("statut")
                        }
                        
                        # Apply rules engine validation to get status and consistency checks
                        precision_career.append(RetirementRulesEngine.get_year_validation_status(entry))
                    
                    if precision_career:
                        precision_career.sort(key=lambda x: x['year'])
                        db_scan.career_data = json.dumps(precision_career, ensure_ascii=False)
                        db_scan.reliability_score = RetirementRulesEngine.get_reliability_score(precision_career)
                        
                        # CRITICAL FIX: Restoration of Expert Blocks (Expert Analysis and Chronology)
                        # If the AI was too brief (missing blocks), we populate them technically.
                        if not ai_data.get('resume_global') or len(str(ai_data.get('resume_global'))) < 50:
                            ai_data['resume_global'] = "Analyse technique effectuée. Des anomalies sur les trimestres ou les points ont été détectées nécessitant une vérification des justificatifs."
                        
                        # CORRECTIF 3+4 AMÉLIORÉ: TOUJOURS reconstruire la timeline depuis precision_career
                        # pour garantir que les employeurs enrichis (Correctif 2) apparaissent dans l'activité.
                        # On préserve les commentaires IA (anomalie_specifique, justificatif_suggere) quand ils existent.
                        existing_ai_timeline = {int(str(t.get('annee', 0))): t for t in ai_data.get('full_timeline', []) if str(t.get('annee', '')).isdigit()}
                        ai_data['full_timeline'] = []
                        for e in precision_career:
                            yr = e['year']
                            ai_t = existing_ai_timeline.get(yr, {})
                            ai_data['full_timeline'].append({
                                "annee": yr,
                                "statut": e.get('status', 'incomplet'),
                                "trimestres_valides": e.get('ris_quarters', 0),
                                "activite": e.get('employer', e.get('regime', 'Activité détectée')),
                                "points_complementaires": e.get('ris_points', 0.0),
                                "salaire_brut": e.get('salary', 0.0),
                                "anomalie_specifique": ai_t.get('anomalie_specifique') or e.get('explanation') or (f"Vérification requise pour l'année {yr}." if e.get('status') != 'conforme' else f"Année {yr} conforme."),
                                "justificatif_suggere": ai_t.get('justificatif_suggere') or e.get('justificatif_suggere') or _generate_justificatifs_for_entry(e),
                                "needs_justificatifs": e.get('status') != 'conforme'
                            })
                        db_scan.ai_analysis = json.dumps(ai_data, ensure_ascii=False)

                ### FROZEN MODULE: NON-NATIVE ANALYSIS - TECHNICAL BACKFILL ###
                # 4. Backfill technical career_data for scanned documents if empty
                if db_scan.is_scanned and full_timeline and not career_raw:
                    ai_career_data = []
                    for item in full_timeline:
                        year = item.get("annee")
                        if not year or not str(year).isdigit(): continue
                        
                        entry = {
                            "year": int(year),
                            "salary": float(item.get("salaire_brut", 0.0)) or 0.0,
                            "ris_quarters": int(item.get("trimestres_valides", 0)) or 0,
                            "ris_points": float(item.get("points_complementaires", 0.0)) or 0.0,
                            "regime": item.get("activite", "Détecté par IA"),
                            "employer": item.get("activite", "")
                        }
                        validated_entry = RetirementRulesEngine.get_year_validation_status(entry)
                        ai_career_data.append(validated_entry)
                        
                        # Enrich the AI timeline item to ensure justifications exist just like native docs
                        item['anomalie_specifique'] = item.get('anomalie_specifique') or validated_entry.get('explanation') or (f"Vérification requise pour l'année {year}." if validated_entry.get('status') != 'conforme' else f"Année {year} conforme.")
                        item['justificatif_suggere'] = item.get('justificatif_suggere') or validated_entry.get('justificatif_suggere') or _generate_justificatifs_for_entry(validated_entry)
                        item['needs_justificatifs'] = validated_entry.get('status') != 'conforme'
                    
                    if ai_career_data:
                        ai_career_data.sort(key=lambda x: x['year'])
                        db_scan.career_data = json.dumps(ai_career_data, ensure_ascii=False)
                        db_scan.reliability_score = RetirementRulesEngine.get_reliability_score(ai_career_data)
                        
                        # --- UNIFICATION: Apply same timeline rebuild as native ---
                        existing_ai_tl = {int(str(t.get('annee', 0))): t for t in ai_data.get('full_timeline', []) if str(t.get('annee', '')).isdigit()}
                        ai_data['full_timeline'] = []
                        for e in ai_career_data:
                            yr = e['year']
                            ai_t = existing_ai_tl.get(yr, {})
                            ai_data['full_timeline'].append({
                                "annee": yr,
                                "statut": e.get('status', 'incomplet'),
                                "trimestres_valides": e.get('ris_quarters', 0),
                                "activite": e.get('employer', e.get('regime', 'Activité détectée')),
                                "points_complementaires": e.get('ris_points', 0.0),
                                "salaire_brut": e.get('salary', 0.0),
                                "anomalie_specifique": ai_t.get('anomalie_specifique') or e.get('explanation') or (f"Vérification requise pour l'année {yr}." if e.get('status') != 'conforme' else f"Année {yr} conforme."),
                                "justificatif_suggere": ai_t.get('justificatif_suggere') or e.get('justificatif_suggere') or _generate_justificatifs_for_entry(e),
                                "needs_justificatifs": e.get('status') != 'conforme'
                            })
                        db_scan.ai_analysis = json.dumps(ai_data, ensure_ascii=False)
                        
                        # --- UNIFICATION: Recalculate projection with backfilled data ---
                        try:
                            scan_total_pts = sum(float(x.get("ris_points", 0.0)) for x in ai_career_data)
                            scan_total_q = sum(int(x.get("ris_quarters", 0)) for x in ai_career_data)
                            scan_last_salary = next((float(x.get("salary", 0)) for x in reversed(ai_career_data) if float(x.get("salary", 0)) > 0), 30000)
                            scan_proj = RetirementRulesEngine.project_future_career(
                                total_points=scan_total_pts, birth_year=birth_year,
                                current_salary=scan_last_salary, current_quarters=scan_total_q,
                                birth_month=birth_month, career_data=ai_career_data
                            )
                            scan_sam = RetirementRulesEngine.calculate_sam(ai_career_data)
                            scan_base_p = RetirementRulesEngine.calculate_base_pension(
                                scan_sam, scan_proj.get("projected_quarters", scan_total_q),
                                scan_proj.get("required_quarters", 172)
                            )
                            scan_svc = 1.4386
                            scan_res = RetirementRulesEngine.get_year_data(2025) or {}
                            if isinstance(scan_res, dict) and "unified" in scan_res:
                                scan_svc = float(scan_res["unified"].get("service", 1.4386))
                            scan_comp_p = RetirementRulesEngine.calculate_complementary_pension(
                                scan_proj.get("projected_points", scan_total_pts), scan_svc
                            )
                            scan_total_monthly = round((scan_base_p + scan_comp_p) / 12.0, 2)
                            ai_data["projection_estimee"] = f"{scan_total_monthly} €/mois"
                            ai_data["projection_detail"] = {
                                "base_mensuelle": round(scan_base_p / 12.0, 2),
                                "complementaire_mensuelle": round(scan_comp_p / 12.0, 2),
                                "total_mensuel": scan_total_monthly,
                                "sam": round(scan_sam, 2),
                                "trimestres_projetes": scan_proj.get("projected_quarters", 0),
                                "taux_plein": scan_proj.get("has_full_rate", False),
                                "age_legal": scan_proj.get("legal_age_display", "64 ans")
                            }
                            db_scan.ai_analysis = json.dumps(ai_data, ensure_ascii=False)
                        except Exception as scan_proj_err:
                            print(f"Scan projection recalculation error: {scan_proj_err}")
                ### END FROZEN MODULE ###

            except Exception as final_err:
                print(f"Final Data Merging error: {final_err}")

        # Final update
        db_scan.ocr_status = "success"
        await db_session.commit()

    except Exception as e:
        print(f"CRITICAL WORKER ERROR for scan {scan_id}: {str(e)}")
        if db_scan:
            db_scan.ocr_status = "failed"
            db_scan.ocr_error = str(e)
            await db_session.commit()
    finally:
        if os.path.exists(file_path):
            try: os.remove(file_path)
            except: pass
        db_session.close()

@router.post("/{scan_id}/retry")
async def retry_scan_analysis(
    scan_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(database.get_db),
    user: models.User = Depends(get_current_user)
):
    scan = (await db.execute(select(models.ScanResult).filter(models.ScanResult.id == scan_id))).scalars().first()
    if not scan:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")
    
    if scan.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Non autorisé.")

    scan.ocr_status = "pending"
    scan.ocr_error = None
    scan.ai_analysis = None
    await db.commit()

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
    """Worker to retry AI analysis + apply all post-processing corrections.
    
    Re-runs the AI audit using the already-extracted text, then applies the same
    4 corrections as the main worker:
      1. Projection de pension (moteur expert)
      2. Enrichissement employeur via IA
      3. Timeline complète (toutes les années)
      4. Justificatifs auto-générés
    """
    db_scan = None
    try:
        db_scan = (await db_session.execute(select(models.ScanResult).filter(models.ScanResult.id == scan_id))).scalars().first()
        if not db_scan: return
        
        db_scan.ocr_status = "processing"
        await db_session.commit()

        # Reconstruct career data from existing DB field
        career_raw = []
        technical_audit = []
        if db_scan.career_data:
            try:
                technical_audit = json.loads(db_scan.career_data)
                career_raw = technical_audit  # For SAM calculation
            except: pass
        
        # Extract birth year and month
        birth_year = 1965
        birth_month = 1
        if db_scan.identity_birth_date:
            try:
                b_match = re.search(r"(\d{2})/(\d{2})/(19[5-9]\d|20[0-2]\d)", str(db_scan.identity_birth_date))
                if b_match:
                    birth_month = int(b_match.group(2))
                    birth_year = int(b_match.group(3))
                else:
                    year_match = re.search(r"(19[5-9]\d|20[0-2]\d)", str(db_scan.identity_birth_date))
                    if year_match:
                        birth_year = int(year_match.group(1))
            except: pass

        # Truncate raw_text if too large
        truncated_text = db_scan.raw_text[:35000] if db_scan.raw_text else ""
        
        # Run IA audit with full context
        ai_commentary = None
        max_retries = 2
        for attempt in range(max_retries):
            try:
                ai_commentary = await ai_service.generate_ai_audit(
                    json.loads(db_scan.detailed_report or "[]"),
                    db_scan.filename,
                    raw_text=truncated_text,
                    career_data=technical_audit,
                    birth_year=birth_year,
                    birth_month=birth_month
                )
                if ai_service.is_valid_json(ai_commentary):
                    break
            except Exception as e:
                print(f"AI retry attempt {attempt+1} failed: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
        
        # FALLBACK if IA fails
        if not ai_commentary or not ai_service.is_valid_json(ai_commentary):
            anoms = json.loads(db_scan.detailed_report or "[]")
            has_anom = "oui" if anoms else "non"
            risk_lvl = "moyen" if anoms else "faible"
            tech_summary = "L'analyse technique a été effectuée avec succès. "
            if anoms:
                tech_summary += f"{len(anoms)} point(s) d'attention ont été identifiés sur vos droits à la retraite."
            else:
                tech_summary += "Aucune anomalie majeure n'a été détectée."

            ai_commentary = json.dumps({
                "anomalie_detectee": has_anom,
                "niveau_risque": risk_lvl,
                "resume_global": tech_summary,
                "resume": tech_summary,
                "compte_rendu": "Synthèse de l'expertise technique :\n\n" + "\n".join([f"• {a['title']} : {a['description']}" for a in anoms[:5]]),
                "analyse_detaillee": "Analyse technique approfondie effectuée par RIS Pro.",
                "full_timeline": [],
                "projection_estimee": "En attente de calcul expert"
            }, ensure_ascii=False)

        # OCR scan warning
        if db_scan.is_scanned:
            try:
                ai_data_w = json.loads(ai_commentary)
                warning_prefix = "⚠️ L'analyse est basée sur un document scanné dont la restitution peut comporter des approximations. Veuillez vérifier les informations.\n\n"
                if "resume_global" in ai_data_w:
                    ai_data_w["resume_global"] = warning_prefix + ai_data_w["resume_global"]
                ai_commentary = json.dumps(ai_data_w, ensure_ascii=False)
            except: pass

        db_scan.ai_analysis = ai_commentary

        # === CORRECTIF 1: Projection de pension ===
        try:
            ai_data_proj = json.loads(db_scan.ai_analysis)
            if career_raw and technical_audit:
                total_pts = sum(float(e.get("ris_points", 0.0)) for e in technical_audit)
                total_q = sum(int(e.get("ris_quarters", 0)) for e in technical_audit)
                last_salary = next((float(e.get("salary", 0)) for e in reversed(technical_audit) if float(e.get("salary", 0)) > 0), 30000)
                
                proj_result = RetirementRulesEngine.project_future_career(
                    total_points=total_pts, birth_year=birth_year,
                    current_salary=last_salary, current_quarters=total_q,
                    birth_month=birth_month, career_data=career_raw
                )
                sam_val = RetirementRulesEngine.calculate_sam(career_raw)
                base_p = RetirementRulesEngine.calculate_base_pension(
                    sam_val,
                    proj_result.get("projected_quarters", total_q),
                    proj_result.get("required_quarters", 172)
                )
                svc_val = 1.4386
                res_2025 = RetirementRulesEngine.get_year_data(2025) or {}
                if isinstance(res_2025, dict) and "unified" in res_2025:
                    svc_val = float(res_2025["unified"].get("service", 1.4386))
                comp_p = RetirementRulesEngine.calculate_complementary_pension(
                    proj_result.get("projected_points", total_pts), svc_val
                )
                total_monthly = round((base_p + comp_p) / 12.0, 2)
                
                ai_data_proj["projection_estimee"] = f"{total_monthly} €/mois"
                ai_data_proj["projection_detail"] = {
                    "base_mensuelle": round(base_p / 12.0, 2),
                    "complementaire_mensuelle": round(comp_p / 12.0, 2),
                    "total_mensuel": total_monthly,
                    "sam": round(sam_val, 2),
                    "trimestres_projetes": proj_result.get("projected_quarters", 0),
                    "taux_plein": proj_result.get("has_full_rate", False),
                    "age_legal": proj_result.get("legal_age_display", "64 ans")
                }
                db_scan.ai_analysis = json.dumps(ai_data_proj, ensure_ascii=False)
        except Exception as proj_err:
            print(f"Retry projection injection error: {proj_err}")

        # === CORRECTIFS 2/3/4: Anomaly merge, employer enrichment, timeline, justificatifs ===
        try:
            ai_data = json.loads(db_scan.ai_analysis)  # Lire depuis ai_analysis, pas ai_commentary, pour conserver la projection (Correctif 1)
            full_timeline = ai_data.get("full_timeline", [])
            
            # Merge anomalies
            merged_anomalies = json.loads(db_scan.detailed_report or "[]")
            existing_years = {str(x.get("year")) for x in merged_anomalies}
            
            for item in full_timeline:
                statut = str(item.get("statut", "")).lower()
                year = str(item.get("annee", ""))
                if statut == "complet" or not year or year in existing_years:
                    continue
                q_count = 0
                try: q_count = int(item.get("trimestres_valides", 0))
                except: pass
                activite_str = str(item.get("activite", "")).lower()
                is_missing_act = not activite_str or any(k in activite_str for k in ["inconnu", "absent", "manquant", "n/a", "trou"])
                needs_justificatifs = (q_count < 4) or is_missing_act
                merged_anomalies.append({
                    "year": int(year) if year.isdigit() else year,
                    "title": f"Année {year} : {item.get('statut', 'Anomalie')}",
                    "description": item.get("anomalie_specifique", "Incohérence détectée par l'expertise complémentaire"),
                    "justificatif": item.get("justificatif_suggere"),
                    "needs_justificatifs": needs_justificatifs,
                    "points_complementaires": item.get("points_complementaires"),
                    "trimestres_valides": q_count
                })
            
            merged_anomalies.sort(key=lambda x: int(str(x.get("year", 0))) if str(x.get("year")).isdigit() else 0)
            db_scan.detailed_report = json.dumps(merged_anomalies, ensure_ascii=False)
            db_scan.has_anomalies = len(merged_anomalies) > 0
            
            # NATIVE PDF PRECISION INJECTION
            if not db_scan.is_scanned and technical_audit:
                precision_career = []
                ai_timeline_map = {int(str(item.get("annee"))): item for item in full_timeline if str(item.get("annee", "")).isdigit()}
                
                for tech_entry in technical_audit:
                    y_int = tech_entry.get("year", 0)
                    if y_int >= datetime.now().year: continue
                    
                    ai_item = ai_timeline_map.get(y_int, {})
                    
                    # CORRECTIF 2: Enrichir l'employeur depuis l'IA
                    ai_activite = ai_item.get("activite", "")
                    employer_val = tech_entry.get("employer", tech_entry.get("regime", "Inconnu"))
                    if ai_activite and ai_activite.lower() not in ["agirc-arrco", "n/a", "inconnu", "", "complémentaire"]:
                        employer_val = ai_activite
                    elif employer_val.lower() in ["agirc-arrco", "complémentaire"]:
                        employer_val = ai_activite if ai_activite else tech_entry.get("regime", "Inconnu")
                    
                    entry = {
                        "year": y_int,
                        "salary": tech_entry.get("salary", 0.0),
                        "ris_quarters": tech_entry.get("ris_quarters", 0),
                        "ris_points": tech_entry.get("ris_points", 0.0),
                        "regime": tech_entry.get("regime", "Inconnu"),
                        "employer": employer_val,
                        "anomalie_specifique": ai_item.get("anomalie_specifique"),
                        "justificatif_suggere": ai_item.get("justificatif_suggere"),
                        "statut": ai_item.get("statut")
                    }
                    precision_career.append(RetirementRulesEngine.get_year_validation_status(entry))
                
                if precision_career:
                    precision_career.sort(key=lambda x: x['year'])
                    db_scan.career_data = json.dumps(precision_career, ensure_ascii=False)
                    db_scan.reliability_score = RetirementRulesEngine.get_reliability_score(precision_career)
                    
                    # CORRECTIF 3+4 AMÉLIORÉ: TOUJOURS reconstruire la timeline depuis precision_career
                    existing_ai_timeline = {int(str(t.get('annee', 0))): t for t in ai_data.get('full_timeline', []) if str(t.get('annee', '')).isdigit()}
                    ai_data['full_timeline'] = []
                    for e in precision_career:
                        yr = e['year']
                        ai_t = existing_ai_timeline.get(yr, {})
                        ai_data['full_timeline'].append({
                            "annee": yr,
                            "statut": e.get('status', 'incomplet'),
                            "trimestres_valides": e.get('ris_quarters', 0),
                            "activite": e.get('employer', e.get('regime', 'Activité détectée')),
                            "points_complementaires": e.get('ris_points', 0.0),
                            "salaire_brut": e.get('salary', 0.0),
                            "anomalie_specifique": ai_t.get('anomalie_specifique') or e.get('explanation') or (f"Vérification requise pour l'année {yr}." if e.get('status') != 'conforme' else f"Année {yr} conforme."),
                            "justificatif_suggere": ai_t.get('justificatif_suggere') or e.get('justificatif_suggere') or _generate_justificatifs_for_entry(e),
                            "needs_justificatifs": e.get('status') != 'conforme'
                        })
                    db_scan.ai_analysis = json.dumps(ai_data, ensure_ascii=False)

            # Scanned doc backfill
            if db_scan.is_scanned and full_timeline and not technical_audit:
                ai_career_data = []
                for item in full_timeline:
                    year = item.get("annee")
                    if not year or not str(year).isdigit(): continue
                    entry = {
                        "year": int(year),
                        "salary": float(item.get("salaire_brut", 0.0)) or 0.0,
                        "ris_quarters": int(item.get("trimestres_valides", 0)) or 0,
                        "ris_points": float(item.get("points_complementaires", 0.0)) or 0.0,
                        "regime": item.get("activite", "Détecté par IA"),
                        "employer": item.get("activite", "")
                    }
                    validated_entry = RetirementRulesEngine.get_year_validation_status(entry)
                    ai_career_data.append(validated_entry)
                    
                    item['anomalie_specifique'] = item.get('anomalie_specifique') or validated_entry.get('explanation') or (f"Vérification requise pour l'année {year}." if validated_entry.get('status') != 'conforme' else f"Année {year} conforme.")
                    item['justificatif_suggere'] = item.get('justificatif_suggere') or validated_entry.get('justificatif_suggere') or _generate_justificatifs_for_entry(validated_entry)
                    item['needs_justificatifs'] = validated_entry.get('status') != 'conforme'

                if ai_career_data:
                    ai_career_data.sort(key=lambda x: x['year'])
                    db_scan.career_data = json.dumps(ai_career_data, ensure_ascii=False)
                    db_scan.reliability_score = RetirementRulesEngine.get_reliability_score(ai_career_data)
                    
                    # --- UNIFICATION: Apply same timeline rebuild as native ---
                    existing_ai_tl = {int(str(t.get('annee', 0))): t for t in ai_data.get('full_timeline', []) if str(t.get('annee', '')).isdigit()}
                    ai_data['full_timeline'] = []
                    for e in ai_career_data:
                        yr = e['year']
                        ai_t = existing_ai_tl.get(yr, {})
                        ai_data['full_timeline'].append({
                            "annee": yr,
                            "statut": e.get('status', 'incomplet'),
                            "trimestres_valides": e.get('ris_quarters', 0),
                            "activite": e.get('employer', e.get('regime', 'Activité détectée')),
                            "points_complementaires": e.get('ris_points', 0.0),
                            "salaire_brut": e.get('salary', 0.0),
                            "anomalie_specifique": ai_t.get('anomalie_specifique') or e.get('explanation') or (f"Vérification requise pour l'année {yr}." if e.get('status') != 'conforme' else f"Année {yr} conforme."),
                            "justificatif_suggere": ai_t.get('justificatif_suggere') or e.get('justificatif_suggere') or _generate_justificatifs_for_entry(e),
                            "needs_justificatifs": e.get('status') != 'conforme'
                        })
                    db_scan.ai_analysis = json.dumps(ai_data, ensure_ascii=False)
                    
                    # --- UNIFICATION: Recalculate projection with backfilled data ---
                    try:
                        scan_total_pts = sum(float(x.get("ris_points", 0.0)) for x in ai_career_data)
                        scan_total_q = sum(int(x.get("ris_quarters", 0)) for x in ai_career_data)
                        scan_last_salary = next((float(x.get("salary", 0)) for x in reversed(ai_career_data) if float(x.get("salary", 0)) > 0), 30000)
                        scan_proj = RetirementRulesEngine.project_future_career(
                            total_points=scan_total_pts, birth_year=birth_year,
                            current_salary=scan_last_salary, current_quarters=scan_total_q,
                            birth_month=birth_month, career_data=ai_career_data
                        )
                        scan_sam = RetirementRulesEngine.calculate_sam(ai_career_data)
                        scan_base_p = RetirementRulesEngine.calculate_base_pension(
                            scan_sam, scan_proj.get("projected_quarters", scan_total_q),
                            scan_proj.get("required_quarters", 172)
                        )
                        scan_svc = 1.4386
                        scan_res = RetirementRulesEngine.get_year_data(2025) or {}
                        if isinstance(scan_res, dict) and "unified" in scan_res:
                            scan_svc = float(scan_res["unified"].get("service", 1.4386))
                        scan_comp_p = RetirementRulesEngine.calculate_complementary_pension(
                            scan_proj.get("projected_points", scan_total_pts), scan_svc
                        )
                        scan_total_monthly = round((scan_base_p + scan_comp_p) / 12.0, 2)
                        ai_data["projection_estimee"] = f"{scan_total_monthly} €/mois"
                        ai_data["projection_detail"] = {
                            "base_mensuelle": round(scan_base_p / 12.0, 2),
                            "complementaire_mensuelle": round(scan_comp_p / 12.0, 2),
                            "total_mensuel": scan_total_monthly,
                            "sam": round(scan_sam, 2),
                            "trimestres_projetes": scan_proj.get("projected_quarters", 0),
                            "taux_plein": scan_proj.get("has_full_rate", False),
                            "age_legal": scan_proj.get("legal_age_display", "64 ans")
                        }
                        db_scan.ai_analysis = json.dumps(ai_data, ensure_ascii=False)
                    except Exception as scan_proj_err:
                        print(f"Retry scan projection recalculation error: {scan_proj_err}")

        except Exception as final_err:
            print(f"Retry data merging error: {final_err}")

        db_scan.ocr_status = "success"
        await db_session.commit()
    except Exception as e:
        print(f"CRITICAL RETRY WORKER ERROR for scan {scan_id}: {str(e)}")
        if db_scan:
            db_scan.ocr_status = "failed"
            db_scan.ocr_error = str(e)
            await db_session.commit()
    finally:
        db_session.close()

@router.get("/history", response_model=List[schemas.ScanResultResponse])
async def get_history(db: AsyncSession = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    scans = (await db.execute(select(models.ScanResult).filter(models.ScanResult.user_id == current_user.id).order_by(models.ScanResult.created_at.desc()))).scalars().all()
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
async def get_scan_preview(scan_id: int, db: AsyncSession = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    scan = (await db.execute(select(models.ScanResult).filter(models.ScanResult.id == scan_id))).scalars().first()
    if not scan:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")
    
    if scan.user_id != current_user.id and not current_user.is_admin:
        from services.monitoring import log_security_event
        log_security_event("WARNING", f"User {current_user.email} (ID {current_user.id}) attempted unauthorized access to preview of scan {scan_id}", trigger_email_alert=True)
        raise HTTPException(status_code=403, detail="Accès non autorisé à cet aperçu.")
    
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
async def get_scan(scan_id: int, db: AsyncSession = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    scan = (await db.execute(select(models.ScanResult).filter(models.ScanResult.id == scan_id))).scalars().first()
    if not scan:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")
    # Admin bypass
    if current_user.is_admin and os.getenv("ENABLE_ADMIN_BYPASS", "true").lower() == "true":
        from services.anonymizer import anonymize_scan_result
        return anonymize_scan_result(scan)
        
    # Folder-based access: check if user has paid for this identity_hash
    if not scan.identity_hash:
        # If no identity extracted, we fallback to old global access (or deny)
        if current_user.has_paid_access: return scan
        raise HTTPException(status_code=403, detail="Analyse en cours ou identité non détectée.")

    access_entry = (await db.execute(select(models.IdentityAccess).filter(
        models.IdentityAccess.user_id == current_user.id,
        models.IdentityAccess.identity_hash == scan.identity_hash
    ))).scalars().first()
    
    if not access_entry:
        # Check if user has global access (old model) - migration support
        if current_user.has_paid_access:
            return scan
        from services.monitoring import log_security_event
        log_security_event("WARNING", f"User {current_user.email} (ID {current_user.id}) attempted unauthorized access to detailed scan {scan_id} (No payment)", trigger_email_alert=True)
        raise HTTPException(status_code=403, detail="Vous devez payer pour accéder au rapport détaillé de ce dossier.")
        
    return scan

@router.delete("/{scan_id}")
async def delete_scan(scan_id: int, db: AsyncSession = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    scan = (await db.execute(select(models.ScanResult).filter(models.ScanResult.id == scan_id))).scalars().first()
    if not scan:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")
    if scan.user_id != current_user.id:
        from services.monitoring import log_security_event
        log_security_event("WARNING", f"User {current_user.email} (ID {current_user.id}) attempted unauthorized deletion of scan {scan_id}", trigger_email_alert=True)
        raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à supprimer cette analyse.")
    
    db.delete(scan)
    await db.commit()
    return {"message": "Analyse supprimée avec succès."}
