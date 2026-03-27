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
    
    def cleanup_ocr_text(text: str):
        """Fixes common OCR errors and archaic notations."""
        # Normalize common keywords without breaking word boundaries
        text = re.sub(r"\bFRF\b", "€", text)
        text = re.sub(r"\bpts\b", " points ", text, flags=re.IGNORECASE)
        # Only replace 'trim' if not already part of 'trimestre'
        text = re.sub(r"\btrim(?!\.|es)\b", " trimestres ", text, flags=re.IGNORECASE)
        return text
    try:
        doc = fitz.open(file_path)
        for page in doc:
            try:
                # Sort=True is CRITICAL for native PDFs to keep column order
                doc_text += page.get_text("text", sort=True) + "\n"
            except Exception as e:
                # Fallback to normal text extraction if sort=True fails for some reason
                doc_text += page.get_text("text") + "\n"
        
        # Detection of scanned PDF (OCR fallback needed)
        if len(doc_text.strip()) < 2000 or len(doc_text.strip()) / max(1, len(doc)) < 100:
            is_scanned = True
            for i in range(min(10, len(doc))):
                page = doc[i]
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                img_data = pix.tobytes("jpg", jpg_quality=60)
                base64_img = base64.b64encode(img_data).decode('utf-8')
                images.append(base64_img)
                pix = None
        
        doc.close()
    except Exception as e:
        if 'doc' in locals() and doc:
            doc.close()
        return {
            "has_anomalies": False,
            "error": f"Impossible de lire le fichier PDF : {str(e)}",
            "detailed_report": []
        }

    # Final text cleanup (OCR typos, archaic currency)
    doc_text = cleanup_ocr_text(doc_text)

    # Basic validation
    if is_scanned:
        doc_text = f"[MODE SCAN DETECTÉ - ANALYSE VISUELLE PRIORITAIRE]\n{doc_text}"

    # Detection logic: broader keywords for various RIS issuers (CNAV, Agirc-Arrco, etc.)
    # Filename fallback for detection
    filename_lower = file_path.lower()
    is_ris_filename = any(k in filename_lower for k in ["ris", "relevé", "carriere", "retraite"])

    is_ris = is_scanned or is_ris_filename or any(keyword in doc_text.lower() for keyword in [
        "relevé individuel", "ris", "retraites", "assurance vieillesse", 
        "carrière", "situation", "points", "trimestres", "employeur",
        "droits", "période", "salaire", "cotisation", "relevé de situation"
    ])
    
    anomalies_list = []
    
    # Enable analysis for both native and scanned text
    if is_ris:
        found_years = {}
        found_points = {}  # {year: [(pts_val, regime_name), ...]}
        found_salaries = {}
        all_detected = []
        birth_year = None

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
        current_context = "GENERAL"
        
        lines = doc_text.split('\n')
        for i, line in enumerate(lines):
            line_clean = line.strip()
            if not line_clean: continue
            
            # Context switchers (Broadened to handle variant layouts)
            if re.search(r"(synthèse|détail)\s+(de\s+)?(vos\s+)?droits", line_clean, re.IGNORECASE) or \
               re.search(r"situation\s+(au|de|individuelle)", line_clean, re.IGNORECASE):
                current_context = "SYNTHESE"
            elif re.search(r"détail\s+(de\s+votre\s+)?carrière", line_clean, re.IGNORECASE) or \
                 re.search(r"périodes\s+retenues", line_clean, re.IGNORECASE):
                current_context = "DETAIL"
            elif re.search(r"points\s+de\s+retraite", line_clean, re.IGNORECASE):
                # Points can also appear in a separate section, often treated like SYNTHESE
                current_context = "SYNTHESE"
            
            # Birth year detection
            if "né(e) le" in line_clean.lower() or "né le" in line_clean.lower():
                b_match = re.search(r"\d{2}/\d{2}/(19[4-9]\d)", line_clean)
                if b_match:
                    birth_year = b_match.group(1)

            # 1. Year Tracking
            year_match = re.search(r"\b(19[5-9]\d|20[0-2]\d)\b", line_clean)
            if year_match:
                detected_year = year_match.group(1)
                all_detected.append(int(detected_year))
                # If we see a year and no context yet, default to SYNTHESE-like scanning
                if current_context == "GENERAL":
                    current_context = "SYNTHESE"
                if current_context == "SYNTHESE":
                    current_year = detected_year

            # 2. Quarters and Points (SYNTHESE or general)
            if current_year:
                # Quarters - Relaxed regex (removed strict trailing \b after complex words)
                q_match = re.search(r"(\d+)\s*(?:trimestr|trim\.|T)", line_clean, re.IGNORECASE)
                if q_match:
                    quarters = int(q_match.group(1))
                    if quarters > 4: quarters = 4
                    if current_year not in found_years or quarters > found_years[current_year]:
                        found_years[current_year] = quarters
                
                p_match = re.search(r"(\d{1,4}(?:[\s.,]\d{1,3})?)\s*(?:pts|points|pt)\b", line_clean, re.IGNORECASE)
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
                        
                        if current_year:
                             if current_year not in found_points:
                                 found_points[current_year] = []
                             found_points[current_year].append((pts_val, regime_name))
                    except: pass

            # 3. Salaries (DETAIL) - Aggregation Logic
            if current_context == "DETAIL":
                date_match = re.search(r"(\d{2}/\d{2}/(19[5-9]\d|20[0-2]\d))", line_clean)
                if date_match:
                    row_year = date_match.group(2)
                    current_year = row_year
                    all_detected.append(int(row_year))
                
                # Check for year even without full date (e.g. 2024 at start of line)
                elif re.match(r"^(19[5-9]\d|20[0-2]\d)\b", line_clean):
                    row_year = line_clean[:4]
                    current_year = row_year
                    all_detected.append(int(row_year))
                
                    # Ultimate Salary Extraction: find all number-like strings and pick the best one
                    potential_vals = []
                    for m in re.finditer(r"\b(\d[\d\s.,\xa0]*\d|\d)\b", line_clean):
                        s = m.group(1).strip()
                        # Basic cleanup of spaces and non-breaking spaces
                        s_clean = s.replace(' ', '').replace('\xa0', '')
                        
                        # Handle mixed separators (1.000,00 or 1,000.00)
                        if ',' in s_clean and '.' in s_clean:
                            if s_clean.rfind('.') < s_clean.rfind(','):
                                s_clean = s_clean.replace('.', '').replace(',', '.')
                            else:
                                s_clean = s_clean.replace(',', '')
                        elif ',' in s_clean:
                            # Check if it looks like a thousands separator (e.g. 15,000) or decimal (15000,00)
                            if len(s_clean.split(',')[1]) == 3 and '.' not in s_clean:
                                s_clean = s_clean.replace(',', '')
                            else:
                                s_clean = s_clean.replace(',', '.')
                        elif '.' in s_clean:
                            # Same for dot
                            if len(s_clean.split('.')[1]) == 3:
                                s_clean = s_clean.replace('.', '')
                        
                        try:
                            v = float(s_clean)
                            # Exclude if it perfectly matches the current year
                            if abs(v - int(current_year or 0)) < 0.1: continue
                            
                            # Exclude if it looks like part of a date (surrounded by /)
                            start, end = m.span()
                            if start > 0 and line_clean[start-1] == '/': continue
                            if end < len(line_clean) and line_clean[end] == '/': continue
                            
                            potential_vals.append(v)
                        except: pass
                    
                    if potential_vals:
                        # In a detailed line, the largest non-year number is almost always the salary
                        # (Points and quarters are much smaller)
                        best_v = max(potential_vals)
                        if best_v > 100 or any(k in line_clean.lower() for k in ["€", "salaire", "revenu", "brut", "montant"]):
                            found_salaries[current_year] = found_salaries.get(current_year, 0.0) + best_v

        # 4. Anomaly Synthesis
        if all_detected:
            years_list = sorted(list(set(all_detected)))
            if not years_list:
                return {
                    "has_anomalies": False,
                    "is_scanned": is_scanned,
                    "is_valid_ris": is_ris,
                    "detailed_report": [],
                    "raw_text": doc_text,
                    "images": images,
                    "warning": "Aucune année de carrière détectée dans le document."
                }
            start_year = min(years_list)
            if birth_year is not None:
                start_year = max(1960, min(start_year, int(birth_year) + 16))
            
            target_year = datetime.date.today().year - 1
            main_regime = "Agirc-Arrco"
            for p_list in found_points.values():
                for _, r_name in p_list:
                    if r_name != "Complémentaire":
                        main_regime = r_name
                        break

            for y in range(start_year, target_year + 1):
                y_str = str(y)
                q = found_years.get(y_str, 0)
                p_list = found_points.get(y_str, [])
                p = sum(item[0] for item in p_list)
                p_desc = " | ".join([f"{item[0]} pts ({item[1]})" for item in p_list])
                s = found_salaries.get(y_str, 0)
                
                # USER RULE: 0, 1, 2, 3 trimestres = Anomalie (Consistent with Rules Engine)
                if q < 4:
                    title_suffix = "trimestre" if q <= 1 else "trimestres"
                    description = f"L'année {y} est incomplète ({q}/4 trimestres)."
                    
                    if p > 0:
                        description += f" Cependant, {p_desc} ont été détectés."
                    
                    anomalies_list.append({
                        "year": y, 
                        "title": f"Année {y} : {q} / 4 trimestres — anomalie détectée",
                        "description": description,
                        "needs_justificatifs": True,
                        "points_complementaires": p if p > 0 else None
                    })
                
                # Check for absence of points if activity exists
                elif (q > 0 or s > 0) and p <= 0:
                    anomalies_list.append({
                        "year": y, "title": f"Absence de points {main_regime} ({y})",
                        "description": f"Une activité est détectée ({q} trim) mais aucun point n'apparaît au régime complémentaire.",
                        "needs_justificatifs": False
                    })

    # 5. Granular Career Data for Rules Engine
    career_data = []
    if all_detected:
        all_unique_years = sorted(list(set(all_detected)))
        for y in all_unique_years:
            y_str = str(y)
            # Find the best salary for this year (often the max found in DETAIL)
            salary = found_salaries.get(y_str, 0.0)
            
            # Points list to determine main regime and total points
            points_info = found_points.get(y_str, [])
            total_points = sum(item[0] for item in points_info)
            
            # Use the first specific regime found, or default to Agirc-Arrco
            base_regime = "Agirc-Arrco"
            for pts, reg in points_info:
                if reg != "Complémentaire":
                    base_regime = reg
                    break
            
            career_data.append({
                "year": y,
                "salary": salary,
                "ris_points": total_points,
                "ris_quarters": found_years.get(y_str, 0),
                "regime": base_regime
            })
        
        # Enforce chronological sorting (ascending)
        career_data.sort(key=lambda x: x["year"])

    identity_data = extract_identity(doc_text)

    return {
        "has_anomalies": len(anomalies_list) > 0,
        "is_scanned": is_scanned,
        "is_valid_ris": is_ris,
        "detailed_report": sorted(anomalies_list, key=lambda x: x.get("year", 0)),
        "career_data": career_data,
        "raw_text": doc_text,
        "images": images,
        "identity_name": identity_data[0],
        "identity_birth_date": identity_data[1],
        "identity_hash": identity_data[2],
        "warning": None if (is_ris or is_scanned) else "Le document ne semble pas être un RIS standard."
    }

def extract_identity(text: str):
    """
    Extracts name and birth date to create a unique identity hash.
    """
    import hashlib
    name = "Inconnu"
    
    # Pattern 1: "M. NOM Prénom" or "Mme NOM Prénom" (usually at top)
    name_match = re.search(r"(?:M\.|Mme)\s+([A-Z\s\-]{2,})\s+([A-Z][a-z]+(?:[\s\-][A-Z][a-z]+)*)", text)
    if name_match:
        name = f"{name_match.group(1).strip()} {name_match.group(2).strip()}"
    else:
        # Pattern 2: "Nom d'usage : NOM" + "Prénom : Prénom"
        usage_match = re.search(r"Nom\s+d'usage\s*:\s*([A-Z\s\-]{2,})", text, re.IGNORECASE)
        prename_match = re.search(r"Prénom\s*:\s*([A-Z][a-z]+(?:[\s\-][A-Z][a-z]+)*)", text, re.IGNORECASE)
        if usage_match and prename_match:
            name = f"{usage_match.group(1).strip()} {prename_match.group(1).strip()}"
        else:
            # Pattern 3: Just look for a name-like structure after "RELEVÉ INDIVIDUEL DE SITUATION"
            lines = text.split('\n')
            for i in range(min(40, len(lines))):
                if any(k in lines[i].lower() for k in ["monsieur", "madame"]):
                    name = lines[i].strip()
                    break

    # Birth date
    birth_date = "00/00/0000"
    # Looking for "Date de naissance : DD/MM/YYYY" or "né(e) le DD/MM/YYYY"
    b_match = re.search(r"(?:né\(e\)\s+le|naissance\s*:)\s*(\d{2}/\d{2}/\d{4})", text, re.IGNORECASE)
    if b_match:
        birth_date = b_match.group(1)
        
    identity_str = f"{name.upper()}_{birth_date}"
    identity_hash = hashlib.sha256(identity_str.encode()).hexdigest()
    
    return name, birth_date, identity_hash
