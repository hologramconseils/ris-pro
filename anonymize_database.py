import os
import re
import json
import sqlite3
import httpx
from dotenv import load_dotenv

# Expression régulière robuste pour détecter le NIR français (Numéro de Sécurité Sociale)
NIR_REGEX = re.compile(
    r'\b([12])[\s-]*(\d{2})[\s-]*(0[1-9]|1[0-2]|20|30|50|99)[\s-]*(\d{2}|2[aAbB])[\s-]*(\d{3})[\s-]*(\d{3})[\s-]*(\d{2})?\b'
)

def mask_nir(text: str) -> str:
    """Masque le NIR tout en conservant le genre et la date de naissance pour le calcul retraite."""
    if not text:
        return text
    def replace_match(match):
        gender = match.group(1)
        year = match.group(2)
        month = match.group(3)
        has_key = match.group(7) is not None
        separator = " " if " " in match.group(0) else ("-" if "-" in match.group(0) else "")
        if separator:
            key_part = f"{separator}XX" if has_key else ""
            return f"{gender}{separator}{year}{separator}{month}{separator}XX{separator}XXX{separator}XXX{key_part}"
        else:
            key_part = "XX" if has_key else ""
            return f"{gender}{year}{month}XXXXXXXX{key_part}"
    return NIR_REGEX.sub(replace_match, text)

def mask_name(name: str) -> str:
    """Masque le nom de famille d'un utilisateur (conserve le prénom)."""
    if not name:
        return name
    parts = name.split()
    if len(parts) >= 2:
        return f"{parts[0]} {parts[1][0]}.***"
    return f"{name[0]}.***"

def anonymize_results_json(results_data):
    """Anonymise l'objet JSON contenant les résultats de l'analyse IA."""
    if not results_data:
        return results_data
    
    # 1. Masquer le NIR principal
    if "nir" in results_data and results_data["nir"]:
        results_data["nir"] = mask_nir(results_data["nir"])
        
    # 2. Masquer le nom dans le résumé s'il y est mentionné
    if "summary" in results_data and results_data["summary"]:
        results_data["summary"] = mask_nir(results_data["summary"])
        
    # 3. Masquer le NIR ou les noms dans les détails des anomalies
    if "anomalies" in results_data and isinstance(results_data["anomalies"], list):
        for anomaly in results_data["anomalies"]:
            for key in ["description", "reason", "solution", "employer", "title"]:
                if key in anomaly and anomaly[key]:
                    anomaly[key] = mask_nir(anomaly[key])
                    
    return results_data

def anonymize_local_sqlite():
    """Anonymise la base de données SQLite locale de développement."""
    db_path = "backend/ris_scan_pro.db"
    if not os.path.exists(db_path):
        db_path = "ris_scan_pro.db"
        if not os.path.exists(db_path):
            print("[-] Base de données SQLite locale introuvable.")
            return

    print(f"[*] Connexion à la base de données SQLite locale : {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id, raw_text, identity_name, detailed_report, career_data FROM scan_results")
        rows = cursor.fetchall()
        
        updated_count = 0
        for row in rows:
            row_id, raw_text, identity_name, detailed_report, career_data = row
            
            # Anonymiser les champs
            new_raw_text = mask_nir(raw_text) if raw_text else raw_text
            new_identity_name = mask_name(identity_name) if identity_name else identity_name
            
            # Anonymiser le rapport détaillé (JSON)
            new_detailed_report = detailed_report
            if detailed_report:
                try:
                    report_json = json.loads(detailed_report)
                    if isinstance(report_json, list):
                        for item in report_json:
                            # Anonymiser chaque anomalie du rapport
                            for key in ["description", "reason", "solution", "employer", "title"]:
                                if key in item and item[key]:
                                    item[key] = mask_nir(item[key])
                    elif isinstance(report_json, dict):
                        report_json = anonymize_results_json(report_json)
                    new_detailed_report = json.dumps(report_json, ensure_ascii=False)
                except Exception as e:
                    print(f"[-] Erreur parsing JSON pour le scan {row_id}: {e}")
            
            cursor.execute(
                "UPDATE scan_results SET raw_text = ?, identity_name = ?, detailed_report = ? WHERE id = ?",
                (new_raw_text, new_identity_name, new_detailed_report, row_id)
            )
            updated_count += 1
            
        conn.commit()
        print(f"[+] SQLite : {updated_count} bilans anonymisés avec succès.")
    except Exception as e:
        print(f"[-] Erreur lors de l'anonymisation SQLite : {e}")
    finally:
        conn.close()

async def anonymize_supabase():
    """Anonymise la base de données Supabase de production à distance."""
    # Charger les variables d'environnement depuis le fichier de production
    load_dotenv(".env.production")
    load_dotenv("backend/.env")
    
    supabase_url = os.environ.get("VITE_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("[-] Variables Supabase manquantes dans .env.production ou backend/.env")
        return
        
    print(f"[*] Connexion à Supabase ({supabase_url}) via l'API REST...")
    
    headers = {
        "Authorization": f"Bearer {supabase_key}",
        "apikey": supabase_key,
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Récupérer toutes les analyses
        response = await client.get(f"{supabase_url}/rest/v1/analyses", headers=headers)
        if response.status_code != 200:
            print(f"[-] Erreur de récupération Supabase (Status {response.status_code}): {response.text}")
            return
            
        analyses = response.json()
        print(f"[*] {len(analyses)} enregistrements récupérés depuis Supabase.")
        
        updated_count = 0
        for analysis in analyses:
            analysis_id = analysis.get("id")
            results = analysis.get("results")
            
            if not results:
                continue
                
            # Si results est une chaîne de caractères, on la parse
            is_string = isinstance(results, str)
            if is_string:
                try:
                    results = json.loads(results)
                except:
                    continue
            
            # Anonymiser les données
            anonymized_results = anonymize_results_json(results)
            
            # Si le champ 'results' contenait initialement une chaîne
            if is_string:
                anonymized_results = json.dumps(anonymized_results, ensure_ascii=False)
                
            # Mettre à jour la ligne dans Supabase
            update_payload = {"results": anonymized_results}
            update_resp = await client.patch(
                f"{supabase_url}/rest/v1/analyses?id=eq.{analysis_id}",
                headers=headers,
                json=update_payload
            )
            
            if update_resp.status_code in [200, 201, 204]:
                updated_count += 1
            else:
                print(f"[-] Échec de la mise à jour pour le bilan {analysis_id}: {update_resp.text}")
                
        print(f"[+] Supabase : {updated_count} bilans anonymisés avec succès.")

if __name__ == "__main__":
    import asyncio
    
    # 1. Anonymiser SQLite locale
    anonymize_local_sqlite()
    
    # 2. Anonymiser Supabase de production
    asyncio.run(anonymize_supabase())
