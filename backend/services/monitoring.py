import os
import logging
from services.mail import send_email

# Configuration du logger de sécurité
logger = logging.getLogger("security")
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('[%(asctime)s] [SECURITY] [%(levelname)s] %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)

def log_security_event(level: str, message: str, trigger_email_alert: bool = False):
    """Enregistre un événement de sécurité dans les journaux système et envoie une alerte e-mail si nécessaire."""
    level = level.upper()
    log_msg = f"[Security Event] {message}"
    
    # 1. Enregistrement dans les logs du serveur (visibles sur Vercel/Console)
    if level == "INFO":
        logger.info(log_msg)
    elif level == "WARNING":
        logger.warning(log_msg)
    elif level == "ERROR":
        logger.error(log_msg)
    elif level == "CRITICAL":
        logger.critical(log_msg)
        
    # 2. Envoi d'une alerte email à l'administrateur
    if trigger_email_alert:
        admin_email = os.getenv("ADMIN_EMAIL", "").strip() or None
        if admin_email:
            try:
                subject = f"⚠️ RIS Pro - Alerte Sécurité : {level}"
                body = f"""Bonjour,

Un événement de sécurité critique a été détecté sur RIS Pro :

- Niveau : {level}
- Détail : {message}

Veuillez inspecter vos consoles d'hébergement Vercel et Supabase pour plus d'informations.

L'équipe RIS Pro
"""
                send_email(admin_email, subject, body)
            except Exception as e:
                logger.error(f"[Failed Alert] Échec de l'envoi de l'alerte email : {str(e)}")
        else:
            logger.warning("[Alert Skipped] ADMIN_EMAIL non configuré dans l'environnement.")
