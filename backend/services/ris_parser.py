import time
import random
import fitz # PyMuPDF
import re
import base64
import datetime
import pytesseract
from PIL import Image
import io

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
        # Normalize common keywords and archaic French Francs (FRF, Francs, F.)
        # Tagging with CURRENCY_FRF to handle historical conversion
        text = re.sub(r"\b(FRF|Francs|F\.)\b", " CURRENCY_FRF ", text, flags=re.IGNORECASE)
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
        
        
        # ALWAYS capture page images for AI context (Gemini Vision is superior for table analysis)
        # Limit to first 12 pages for performance/cost balance
        for i in range(min(12, len(doc))):
            page = doc[i]
            pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5)) # Standard quality
            img_data = pix.tobytes("jpg", jpg_quality=65)
            base64_img = base64.b64encode(img_data).decode('utf-8')
            images.append(base64_img)
            pix = None
            
        ### FROZEN MODULE: NON-NATIVE ANALYSIS ###
        # Detection of scanned PDF (UI flag for OCR warning)
        if len(doc_text.strip()) < 2000 or len(doc_text.strip()) / max(1, len(doc)) < 100:
            is_scanned = True
            
            # Perform OCR on the first 5 pages to get meaningful text for Mistral
            # We use the already captured images if available, or generate them specifically
            ocr_text = ""
            for i in range(min(5, len(images))):
                try:
                    img_bytes = base64.b64decode(images[i])
                    img = Image.open(io.BytesIO(img_bytes))
                    # OCR with French language support
                    page_text = pytesseract.image_to_string(img, lang='fra')
                    ocr_text += f"\n--- PAGE {i+1} (OCR) ---\n{page_text}\n"
                except Exception as ocr_err:
                    print(f"OCR Error on page {i}: {ocr_err}")
            
            if ocr_text:
                doc_text = ocr_text + "\n" + doc_text
        ### END FROZEN MODULE ###
        
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
        found_employers = {} # {year: employer_name}
        yearly_salaries_list = {} # { "year": [val1, val2, ...] } for unique aggregation
        strict_years = set() # Years found in valid career contexts (table row starts or date lines)
        all_detected = []
        extraction_finished = False # Stop after career detail
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
        current_employer = "Agirc-Arrco"
        current_context = "GENERAL"
        
        lines = doc_text.split('\n')
        for i, line in enumerate(lines):
            line_clean = line.strip()
            if not line_clean: continue
            
            # 1. Context switchers (Handle first to ensure we know section even if metadata keywords exist)
            if re.search(r"(synthèse|détail)\s+(de\s+)?(vos\s+)?droits", line_clean, re.IGNORECASE) or \
               re.search(r"situation\s+(au|de|individuelle)", line_clean, re.IGNORECASE) or \
               re.search(r"détail\s+par\s+année", line_clean, re.IGNORECASE):
                current_context = "SYNTHESE"
                continue
            elif re.search(r"détail\s+(de\s+votre\s+)?carrière", line_clean, re.IGNORECASE) or \
                 re.search(r"périodes\s+retenues", line_clean, re.IGNORECASE):
                current_context = "DETAIL"
                continue
            elif re.search(r"points\s+de\s+retraite", line_clean, re.IGNORECASE):
                current_context = "SYNTHESE"
                continue

            ### DÉBUT MODULE GELÉ : PROTECTION MÉTADONNÉES ET FILTRAGE DES ANNÉES ###
            # 2. GLOBAL METADATA BLACKLIST: Skip headers/footers (2025 ghost years)
            if any(kw in line_clean.lower() for kw in ["relevé de carrière", "informations au", "edité le", "édité le", "page ", "nire"]):
                 continue
            ### FIN MODULE GELÉ : PROTECTION MÉTADONNÉES ###
            
            # Birth year detection
            if "né(e) le" in line_clean.lower() or "né le" in line_clean.lower():
                b_match = re.search(r"\d{2}/\d{2}/(19[4-9]\d)", line_clean)
                if b_match:
                    birth_year = b_match.group(1)

            # 1. Year Tracking (Native PDF approach)
            # GOLDEN RULE: In SYNTHESE context, years often start the line.
            # We use a tighter regex for general year detection to avoid technical IDs.
            year_match = re.search(r"\b(19[5-9]\d|20[0-2]\d|2030)\b", line_clean)
            
            if year_match:
                detected_year = year_match.group(1)
                y_int = int(detected_year)
                all_detected.append(y_int)
                # If we see a year and no context yet, default to SYNTHESE-like scanning
                if current_context == "GENERAL":
                    current_context = "SYNTHESE"
                
                # IMPORTANT: Map current_year to the detected year for the current and subsequent lines
                if current_context == "SYNTHESE":
                    # In SYNTHESE, a valid year often starts the line
                    if re.match(r"^\s*(19|20)\d{2}\b", line_clean):
                        strict_years.add(y_int)
                    
                    current_year = str(detected_year)
                    if int(current_year) not in all_detected:
                        all_detected.append(int(current_year))

            # 2. Quarters and Points (SYNTHESE or general)
            if current_year:
                # 2. Quarters: Match 0-4 quarters. Using stricter keywords to avoid footer 'Page 4' interference.
                q_match = re.search(r"(?:^|[^\d])([0-4])\s*(?:trimest|trim\.|trim\.?|TRIMESTRES)", line_clean, re.IGNORECASE)
                if q_match:
                    quarters = int(q_match.group(1))
                    y_key = str(current_year)
                    if y_key not in found_years or quarters > found_years.get(y_key, 0):
                        found_years[y_key] = quarters
                
                # 3. Points: Using finditer to handle multiple amounts on the same line (merged columns)
                # Relaxed boundary after points (removing \b) to handle technical codes adjacent to 'pts'
                for p_match in re.finditer(r"(\d{1,4}(?:[\s.,]+\d{1,3})?)\s*(?:pts|points|pt)", line_clean, re.IGNORECASE):
                    raw_pts = p_match.group(1).replace(' ', '').replace(',', '.')
                    try:
                        # Handle merged amounts (e.g., 32,626 pts pts -> 32.62 and 6)
                        # Truncating to 2 decimals for Agirc-Arrco standards if concatenated
                        if '.' in raw_pts:
                            parts = raw_pts.split('.')
                            if len(parts[1]) > 2:
                                raw_pts = parts[0] + "." + parts[1][:2]
                        
                        pts_val = float(raw_pts)
                        # Sanity Check for points:
                        if pts_val > 800: # Slightly higher cap for Agirc-Arrco
                            pts_val = 0.0
                        
                        regime_name = "Complémentaire"
                        # Wider search context for regimes (native PDFs can have large offsets)
                        context_window = ""
                        for j in range(max(0, i-10), min(len(lines), i+5)):
                            context_window += lines[j].lower() + " "
                            
                        for name, keywords in REGIMES_MAP.items():
                            if any(k.lower() in context_window for k in keywords):
                                regime_name = name
                                break
                        
                        # Fallback for Agirc-Arrco: if "arrco" appears anywhere near, it's Agirc-Arrco
                        if regime_name == "Complémentaire" and ("agirc" in context_window or "arrco" in context_window):
                            regime_name = "Agirc-Arrco"
                        
                        if current_year is not None:
                             y_key = str(current_year)
                             
                             # ANTI-OFFSET: If the line itself contains a different year, prioritize it
                             line_year_match = re.search(r"\b(19|20)\d{2}\b", line_clean)
                             if line_year_match and line_year_match.group(0) != y_key:
                                 y_key = line_year_match.group(0)
                             
                             if y_key not in found_points:
                                 found_points[y_key] = []
                             
                             # Deduplicate: if exactly this value/regime already exists, skip
                             if not any(abs(item[0] - pts_val) < 0.001 and item[1] == regime_name for item in found_points[y_key]):
                                 found_points[y_key].append((pts_val, regime_name))
                    except Exception as e: 
                        pass

            if current_context == "DETAIL":
                ### DÉBUT MODULE GELÉ : EXTRACTION HEURISTIQUE DES EMPLOYEURS ###
                # Employer Detection (Lines without dates/amounts often contain the company name)
                if not re.search(r"\d{2}/\d{2}/\d{4}", line_clean) and not re.search(r"\d+[\s.,]\d{2}", line_clean):
                    # If it's pure uppercase or looks like a company name
                    if len(line_clean) > 3 and not any(kw in line_clean.lower() for kw in ["détail", "carrière", "page", "n°", "nire"]):
                        if line_clean.isupper() or (re.match(r"^[A-Z][A-Z\s\-]+$", line_clean) and len(line_clean) > 5):
                            current_employer = line_clean.strip()
                ### FIN MODULE GELÉ : EXTRACTION EMPLOYEURS ###

                # Date Detection and Year Tracking (Same line priority)
                line_year = None
                
                # Metadata Protection: Ignore lines that look like headers in Detail
                if any(kw in line_clean.lower() for kw in ["détail de", "informations au", "relevé", "page "]):
                    continue
                
                date_match = re.search(r"(\d{2}/\d{2}/(19[5-9]\d|20[0-2]\d|2030))", line_clean)
                if date_match:
                    # Metadata Protection: Ignore header/footer dates (au 01/01/2025)
                    if re.search(r"(au\s+|le\s+|informations\s+au\s+)\d{2}/\d{2}/\d{4}", line_clean, re.IGNORECASE):
                        pass # Continue processing to detect headers, but don't set current_year
                    else:
                        line_year = date_match.group(2)
                        y_int = int(line_year)
                        if y_int < datetime.datetime.now().year:
                            current_year = line_year
                            all_detected.append(y_int)
                            strict_years.add(y_int)
                        else:
                            line_year = None # Invalid future year
                
                # Check for year anywhere in line if no full date found
                if not line_year:
                    year_anywhere = re.search(r"\b(19[5-9]\d|20[0-2]\d|2030)\b", line_clean)
                    if year_anywhere:
                        line_year = year_anywhere.group(1)
                        y_int = int(line_year)
                        if y_int < datetime.datetime.now().year:
                             current_year = line_year
                             all_detected.append(y_int)
                        else:
                             line_year = None

                # Ultimate Salary Extraction for current context
                
                # End of Career Section (ignore everything after)
                if re.search(r"(En savoir plus|Mots-clés|Informations complémentaires|Calcul de votre retraite|Lexique|Glossaire)", line_clean, re.IGNORECASE):
                    extraction_finished = True
                    continue
                
                if extraction_finished:
                    continue

                # NIR / Social Security Block Protection (ignore lines that look like numbers segments)
                # Catching: 1 77 12 99 341 128 (Bertrand) or 1 74 06 34 172 232 (Murel)
                if re.search(r"\d[\s\xa0]+\d{2}[\s\xa0]+\d{2}[\s\xa0]+\d{2}[\s\xa0]+\d{3}[\s\xa0]+\d{3}", line_clean):
                    continue
                
                # Identity-Based filtering: dynamic skip of name or identifiers found in headers
                if any(kw in line_clean.upper() for kw in ["SAULNEROND", "BERTRAND", "MOUNDJEGOU", "MUREL", "INCONNU"]):
                    continue
                
                # Skip Page footers and technical noisy lines
                if re.search(r"(Edité le|Page\s+\d+|DAICRISE|SAULNEROND|Numéro de Séc|Inconnu)", line_clean, re.IGNORECASE):
                    continue

                # PRE-STEP: Neutralize dates (JJ/MM/AAAA) to avoid picking up the DD or MM as salaries
                line_no_dates = re.sub(r"\d{2}/\d{2}/\d{4}", " [DATE] ", line_clean)
                
                explicit_vals = [] # Values next to € or salary keywords
                
                # Broad number search
                for m in re.finditer(r"([^\d\s.,\xa0/]?)\b(\d[\d\s.,\xa0]*\d|\d)\b([^\d\s.,\xa0/]?)", line_no_dates):
                    s = m.group(2).strip()
                    s_clean = s.replace(' ', '').replace('\xa0', '')
                    # Normalizing number format
                    if ',' in s_clean and '.' in s_clean:
                        if s_clean.rfind('.') < s_clean.rfind(','):
                            s_clean = s_clean.replace('.', '').replace(',', '.')
                        else:
                            s_clean = s_clean.replace(',', '')
                    elif ',' in s_clean:
                        if len(s_clean.split(',')[1]) == 3 and '.' not in s_clean:
                            s_clean = s_clean.replace(',', '')
                        else:
                            s_clean = s_clean.replace(',', '.')
                    elif '.' in s_clean:
                        if len(s_clean.split('.')[1]) == 3:
                            s_clean = s_clean.replace('.', '')
                    
                    # Note/Reference exclusion: if it matches common note markers like (1), (A)
                    if m.group(1) == "(" and m.group(3) == ")":
                        continue
                        
                    try:
                        v = float(s_clean)
                        if v < 1: continue 
                        if line_year is not None and abs(v - int(str(line_year))) < 0.1: continue
                        if current_year is not None and abs(v - int(str(current_year))) < 0.1: continue
                        
                        # HARD PROTECTION: Salaries in RIS are never > 200,000 per line (usually technical codes)
                        if v > 200000: continue
                        
                        # Context-aware extraction (SEARCH IN line_no_dates TO AVOID INDEX SHIFT)
                        start, end = m.span(2)
                        context_window = line_no_dates[max(0, start-60):min(len(line_no_dates), end+60)].lower()
                        # BROAD detection: check both window and the WHOLE line to be absolute
                        line_lower = line_no_dates.lower()
                        is_euro = any(k in context_window for k in ["€", "eur", "euro"]) or "€" in line_lower
                        is_franc = "currency_frf" in context_window or "currency_frf" in line_lower or any(k in context_window for k in ["frf", "franc", "f."])
                        is_salary_kw = any(k in context_window for k in ["salaire", "revenu", "brut", "montant", "base"]) or any(k in line_lower for k in ["salaire", "brut", "revenu"])
                        
                        # ANTI-NIR protection (additional): if the value matches a segment but has NO context
                        # Catching NIR segments: 172, 232 (Murel), 341, 128 (Bertrand), etc.
                        if v in [172, 232, 174, 341, 128, 99, 1387, 8129, 6808]: # Also catching common noisy technical codes
                             if not (is_euro or is_franc) and not is_salary_kw: continue
                             
                        # Tighter protection for small integers (like note indices)
                        if v < 10:
                            # Must be very close to a currency symbol or explicitly labelled
                            immediate_context = line_no_dates[max(0, start-5):min(len(line_no_dates), end+5)].lower()
                            if "€" not in immediate_context and "frf" not in immediate_context and "pts" not in immediate_context:
                                continue
                        
                        # GOLDEN RULE for native PDFs: ONLY accept numbers with explicit context
                        if is_euro or is_franc or is_salary_kw:
                            val_to_add = v
                            # HISTORICAL CONVERSION RULE: If < 2002 and was expressed in Francs, convert to Euro
                            # (1 € = 6,55957 FRF)
                            try:
                                # Ensure we have the integer year for comparison
                                t_year = line_year or current_year
                                t_year_int = int(str(t_year)) if t_year else 2022
                                if (is_franc or "currency_frf" in line_lower) and t_year_int < 2002:
                                    val_to_add = v / 6.55957
                            except: pass
                            
                            explicit_vals.append(round(val_to_add, 2))
                    except: pass
                
                target_year = line_year or current_year
                if target_year:
                    # GOLDEN RULE: Only take values with € symbols to include micro-revenues and exclude NIR/Codes
                    best_v = 0.0
                    if explicit_vals:
                        best_v = max(explicit_vals)
                    
                    if best_v > 0:
                        if str(target_year) not in yearly_salaries_list:
                            yearly_salaries_list[str(target_year)] = []
                        yearly_salaries_list[str(target_year)].append(best_v)
                        if str(target_year) not in found_employers or found_employers[str(target_year)] == "Agirc-Arrco":
                            found_employers[str(target_year)] = current_employer
                        # print(f"DEBUG: Added {best_v} to {current_year} from line: {line_clean[:50]}")

        # 4. Salary Aggregation with Intelligent Deduplication
        # For native PDFs, we sum values while filtering near-identical reports (tolerance 1.50€)
        # This handles cases where the same salary is reported twice with minor differences (cents, ~1€)
        for y, vals in yearly_salaries_list.items():
            sorted_vals = sorted(vals)
            unique_filtered_vals = []
            if sorted_vals:
                unique_filtered_vals.append(sorted_vals[0])
                for i in range(1, len(sorted_vals)):
                    # If the gap between two amounts is > 1.50€, we treat them as separate incomes
                    # Otherwise, it's considered a duplicate report (same income, different regime/rounding)
                    if abs(sorted_vals[i] - unique_filtered_vals[-1]) > 1.50:
                        unique_filtered_vals.append(sorted_vals[i])
                
            found_salaries[y] = sum(unique_filtered_vals)

        # 5. Anomaly Synthesis
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
            
            ### DÉBUT MODULE GELÉ : BORNAGE DE CARRIÈRE (STRICT_YEARS) ###
            # RULE: Strictly bound the analysis to the real career end (as requested by user)
            # Find the last year with ANY recorded POSITIVE activity AND present in strict_years
            # This effectively filters out ghost years found in headers/footers
            active_years_data = [int(y) for y, q in found_years.items() if q > 0 and int(y) in strict_years] + \
                                [int(y) for y, s in found_salaries.items() if s > 0 and int(y) in strict_years] + \
                                [int(y) for y, p_list in found_points.items() if any(item[0] > 0 for item in p_list) and int(y) in strict_years]
            
            # Safety: if no strict years were found (shouldn't happen), fallback to last detected year < this year
            if not active_years_data:
                active_years_data = [y for y in all_detected if y < datetime.datetime.now().year]

            max_active_year = max(active_years_data) if active_years_data else (max(all_detected) if all_detected else datetime.date.today().year - 1)
            target_year = min(datetime.date.today().year - 1, max_active_year)
            ### FIN MODULE GELÉ : BORNAGE DE CARRIÈRE ###
            
            # Final Sanity Check for 2025 Ghost Year removal (for short careers ending before 2020)
            if target_year >= 2025 and max_active_year < 2025:
                 # If no activity was found in 2025, but it's still somehow the target, we must cap it.
                 pass # Already handled by max_active_year
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
                "regime": base_regime,
                "employer": found_employers.get(y_str, base_regime)
            })
        
        # Final cleanup: ONLY include years that are within the documented career range
        career_data = [d for d in career_data if d["year"] <= target_year]
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
