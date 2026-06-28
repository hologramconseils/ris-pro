import re

# Expression régulière robuste pour détecter le NIR français (Numéro de Sécurité Sociale)
# Gère les formats avec ou sans espaces, tirets, et les départements Corse (2A, 2B)
NIR_REGEX = re.compile(
    r'\b([12])[\s-]*(\d{2})[\s-]*(0[1-9]|1[0-2]|20|30|50|99)[\s-]*(\d{2}|2[aAbB])[\s-]*(\d{3})[\s-]*(\d{3})[\s-]*(\d{2})?\b'
)

def mask_nir(text: str) -> str:
    """Détecte et masque les numéros de Sécurité Sociale (NIR) dans un texte.
    
    Conserve le genre (1 ou 2), l'année et le mois de naissance (utiles pour la retraite),
    et masque le département, la commune et l'ordre de naissance.
    
    Exemple : 
    "1 77 05 75 112 456 78" -> "1 77 05 XX XXX XXX XX"
    """
    if not text:
        return text
        
    def replace_match(match):
        gender = match.group(1)
        year = match.group(2)
        month = match.group(3)
        # On insère des X ou des * à la place des champs sensibles
        has_key = match.group(7) is not None
        
        # Conserver les espaces ou séparateurs du format d'origine s'il y en a
        separator = " " if " " in match.group(0) else ("-" if "-" in match.group(0) else "")
        
        if separator:
            key_part = f"{separator}XX" if has_key else ""
            return f"{gender}{separator}{year}{separator}{month}{separator}XX{separator}XXX{separator}XXX{key_part}"
        else:
            key_part = "XX" if has_key else ""
            return f"{gender}{year}{month}XXXXXXXX{key_part}"

    return NIR_REGEX.sub(replace_match, text)

def anonymize_scan_result(scan):
    """Anonymise un objet ScanResult (SQLAlchemy model) ou un dictionnaire."""
    if not scan:
        return scan
        
    is_dict = isinstance(scan, dict)
    
    # Anonymiser le texte brut extrait (raw_text)
    raw_text = scan.get("raw_text") if is_dict else getattr(scan, "raw_text", None)
    if raw_text:
        masked = mask_nir(raw_text)
        if is_dict:
            scan["raw_text"] = masked
        else:
            scan.raw_text = masked
            
    # Anonymiser le nom de l'utilisateur (identity_name) si présent
    identity_name = scan.get("identity_name") if is_dict else getattr(scan, "identity_name", None)
    if identity_name:
        parts = identity_name.split()
        if len(parts) >= 2:
            masked_name = f"{parts[0]} {parts[1][0]}.***"
        elif len(parts) == 1:
            masked_name = f"{parts[0][0]}.***"
        else:
            masked_name = identity_name
            
        if is_dict:
            scan["identity_name"] = masked_name
        else:
            scan.identity_name = masked_name
            
    return scan
