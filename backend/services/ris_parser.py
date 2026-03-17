import time
import random
import fitz # PyMuPDF
import re
import base64
import datetime

def parse_ris_file(file_path: str):
    """
    Parses a RIS PDF file using PyMuPDF.
    Extracts years and quarters to detect anomalies.
    Provides OCR fallback via images for scanned PDFs.
    """
    time.sleep(1) # Visual delay for user experience
    
    doc_text = ""
    is_scanned = False
    images = []
    
    try:
        doc = fitz.open(file_path)
        for page in doc:
            doc_text += page.get_text()
        
        # Detection of scanned PDF (OCR fallback needed)
        # If very little text is extracted (< 1000 chars), we treat it as a scan
        if len(doc_text.strip()) < 1000:
            is_scanned = True
            # Convert first 15 pages to images for Gemini Vision
            # This allows the AI to "see" the document even if no text is extractable
            for i in range(min(15, len(doc))):
                page = doc[i]
                # Matrix 3x3 approx 216 DPI for better detail on low quality scans/photos
                pix = page.get_pixmap(matrix=fitz.Matrix(3, 3))
                img_data = pix.tobytes("png")
                base64_img = base64.b64encode(img_data).decode('utf-8')
                images.append(base64_img)
        
        doc.close()
    except Exception as e:
        return {
            "has_anomalies": False,
            "error": f"Impossible de lire le fichier PDF : {str(e)}",
            "detailed_report": []
        }

    # Basic validation and Scan labeling
    if is_scanned:
        doc_text = f"[MODE SCAN DETECTÉ - ANALYSE VISUELLE PRIORITAIRE]\n{doc_text}"

    # Check for document type (fallback to true for scans to allow AI analysis)
    is_ris = is_scanned or any(keyword in doc_text.lower() for keyword in ["relevé individuel", "ris", "retraites", "assurance vieillesse", "carrière"])
    
    anomalies_list = []
    
    if is_ris and not is_scanned:
        # Real-ish parsing logic: Extract years and their associated quarters
        # Typical RIS line: "2015  Assurance Vieillesse  4 trimestres  15000 €"
        
        found_years = {}
        found_points = {}  # {year: (pts_val, regime_name)}
        found_salaries = {}
        all_potential_years = []

        REGIMES_MAP = {
            "Agirc-Arrco": ["agirc", "arrco"],
            "Ircantec": ["ircantec"],
            "RAFP": ["rafp"],
            "CRPN": ["crpn"],
            "RCI": ["rci", "artisans", "commerçants", "indépendant"],
            "MSA": ["msa", "agricole"],
            "Libéral": ["carmf", "cnbf", "avocats", "médecins"]
        }

        # Stateful Parsing Machine
        current_year = None
        current_context = "GENERAL" # GENERAL, SYNTHESE (Détail par année), DETAIL (Détail de votre carrière)
        
        lines = doc_text.split('\n')
        for i, line in enumerate(lines):
            line_clean = line.strip()
            if not line_clean: continue
            
            # Context switchers
            if "synthèse de vos droits" in line_clean.lower() or "détail par année" in line_clean.lower():
                current_context = "SYNTHESE"
            elif "détail de votre carrière" in line_clean.lower():
                current_context = "DETAIL"
            elif "en savoir plus" in line_clean.lower():
                current_context = "GENERAL"

            # 1. Year Tracking (Global + Contextual)
            year_match = re.search(r"\b(19[5-8]\d|199\d|20[0-2]\d)\b", line_clean)
            if year_match:
                detected_year = year_match.group(1)
                if current_context == "SYNTHESE":
                    current_year = detected_year
                
                year_int = int(detected_year)
                if year_int not in all_potential_years:
                    all_potential_years.append(year_int)

            # 2. Quarters and Points (SYNTHESE Context)
            if current_context == "SYNTHESE" and current_year:
                q_match = re.search(r"(\d+)\s*(?:trimestr|trim\.|T)\b", line_clean, re.IGNORECASE)
                if q_match:
                    quarters = int(q_match.group(1))
                    if quarters > 4: quarters = 4
                    if current_year not in found_years or quarters > found_years[current_year]:
                        found_years[current_year] = quarters
                
                p_match = re.search(r"(\d+(?:[\s.,]\d+)?)\s*(?:pts|points)\b", line_clean, re.IGNORECASE)
                if p_match:
                    raw_pts = p_match.group(1).replace(' ', '').replace(',', '.')
                    try:
                        pts_val = float(raw_pts)
                        regime_name = "Complémentaire"
                        context_window = ""
                        for j in range(max(0, i-2), min(len(lines), i+2)):
                            context_window += lines[j].lower() + " "
                            
                        for name, keywords in REGIMES_MAP.items():
                            if any(k.lower() in context_window for k in keywords):
                                regime_name = name
                                break
                        
                        if current_year not in found_points or pts_val > found_points[current_year][0]:
                            found_points[current_year] = (pts_val, regime_name)
                    except:
                        pass

            # 3. Salaries (DETAIL Context)
            if current_context == "DETAIL":
                date_match = re.search(r"(\d{2}/\d{2}/(19[5-9]\d|20[0-2]\d))", line_clean)
                if date_match:
                    item_year = date_match.group(2)
                    search_scope = ""
                    for j in range(i, min(len(lines), i+3)):
                        search_scope += lines[j] + " "
                    
                    s_match = re.search(r"(\d{1,3}(?:[\s]\d{3})*(?:[.,]\d+)?)\s*(?:€|EUR|FRF)\b", search_scope)
                    if s_match:
                        raw_sal = s_match.group(1).replace(' ', '').replace(',', '.')
                        try:
                            sal_val = float(raw_sal)
                            if "FRF" in s_match.group(0):
                                sal_val = sal_val / 6.55957
                                
                            if item_year not in found_salaries or sal_val > found_salaries[item_year]:
                                found_salaries[item_year] = sal_val
                        except:
                            pass

        # Timeline establishment for native PDFs
        birth_year = None
        birth_match = re.search(r"(?:Né[e]? le|naissance\s*:?|né en)\s*.*?(\d{4})", doc_text, re.IGNORECASE)
        if birth_match:
            birth_year = int(birth_match.group(1))
            if birth_year < 1920 or birth_year > 2010: birth_year = None

        detected_years_raw = list(found_years.keys()) + list(found_points.keys()) + list(found_salaries.keys())
        all_detected = [int(y) for y in detected_years_raw if y] + all_potential_years
        
        if all_detected:
            years_list = sorted(list(set(all_detected)))
            start_year = min(years_list)
            if birth_year is not None:
                start_year = max(1960, min(start_year, int(birth_year) + 16))
            
            FINAL_YEAR = datetime.date.today().year
            main_regime = "Agirc-Arrco"
            for _, r_name in found_points.values():
                if r_name != "Complémentaire":
                    main_regime = r_name
                    break

            for y in range(start_year, FINAL_YEAR + 1):
                y_str = str(y)
                q = found_years.get(y_str, 0)
                p_data = found_points.get(y_str, (0, "N/A"))
                p = p_data[0]
                s = found_salaries.get(y_str, 0)
                title_suffix = "trimestre" if q <= 1 else "trimestres"
                
                if q == 0:
                    anomalies_list.append({
                        "year": y, "title": f"Année {y} : 0 trimestre",
                        "description": f"Aucun trimestre validé au régime de base pour l'année {y}. Vérifiez vos droits."
                    })
                elif q < 4:
                    anomalies_list.append({
                        "year": y, "title": f"Année {y} : {q} {title_suffix}",
                        "description": f"L'année {y} est incomplète au régime de base ({q}/4 trimestres)."
                    })
                
                if (q > 0 or s > 0) and p <= 0:
                    anomalies_list.append({
                        "year": y, "title": f"Absence de points {main_regime} ({y})",
                        "description": f"Une activité est détectée ({q} trim, Sal: {s:.0f}€) mais aucun point n'apparaît au régime complémentaire."
                    })

    has_anomalies = len(anomalies_list) > 0
    
    result = {
        "has_anomalies": has_anomalies,
        "is_scanned": is_scanned,
        "is_valid_ris": is_ris,
        "detailed_report": sorted(anomalies_list, key=lambda x: x.get("year", 0)),
        "raw_text": doc_text,
        "images": images, # Base64 images for Gemini Vision
        "warning": None if (is_ris or is_scanned) else "Le document ne semble pas être un RIS standard."
    }
    
    return result
