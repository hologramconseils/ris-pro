import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

# Mock email flag for development
USE_MOCK = True
MOCK_LOG = "/tmp/emails.log"

def send_email(to_email: str, subject: str, body: str):
    """
    Sends an email using SMTP or logs to a file in mock mode.
    """
    if USE_MOCK:
        with open(MOCK_LOG, "a") as f:
            f.write(f"--- EMAIL TO: {to_email} ---\n")
            f.write(f"SUBJECT: {subject}\n")
            f.write(f"BODY:\n{body}\n")
            f.write("-" * 30 + "\n\n")
        print(f"Mock email sent to {to_email} (logged to {MOCK_LOG})")
        return

    # Real SMTP implementation (disabled for dev)
    # ...
    pass

def send_welcome_email(to_email: str, first_name: str):
    subject = "Bienvenue sur RIS Scan Pro !"
    body = f"""Bonjour {first_name},

Bienvenue sur RIS Scan Pro ! Votre compte a été créé avec succès.

Vous pouvez désormais analyser vos documents RIS et suivre l'historique de vos audits de carrière.
Si vous avez besoin de modifier votre mot de passe, vous pouvez le faire à tout moment depuis votre espace client.

Cordialement,
L'équipe Hologram Conseils
"""
    send_email(to_email, subject, body)

def send_reset_password_email(to_email: str, first_name: str, token: str):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={token}"
    
    subject = "Réinitialisation de votre mot de passe - RIS Scan Pro"
    body = f"""Bonjour {first_name},

Vous avez demandé la réinitialisation de votre mot de passe RIS Scan Pro.
Veuillez cliquer sur le lien ci-dessous pour définir un nouveau mot de passe :

{reset_link}

Ce lien est valable pendant 1 heure. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.

Cordialement,
L'équipe Hologram Conseils
"""
    send_email(to_email, subject, body)
