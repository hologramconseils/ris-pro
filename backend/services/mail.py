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
    smtp_server = os.getenv("SMTP_SERVER", "").strip() or None
    smtp_port = int(os.getenv("SMTP_PORT", "587").strip())
    smtp_user = os.getenv("SMTP_USER", "").strip() or None
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip() or None
    
    if not all([smtp_server, smtp_user, smtp_password]):
        print(f"SMTP not configured (Mock mode active). Email to {to_email} logged to {MOCK_LOG}")
        with open(MOCK_LOG, "a") as f:
            f.write(f"--- MOCK EMAIL TO: {to_email} ---\n")
            f.write(f"SUBJECT: {subject}\n")
            f.write(f"BODY:\n{body}\n")
            f.write("-" * 30 + "\n\n")
        return

    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_server, smtp_port)
        else:
            server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
            server.starttls()
        
        server.login(smtp_user, smtp_password)
        server.send_message(msg)
        server.quit()
        print(f"Email successfully sent to {to_email}")
    except Exception as e:
        print(f"Error sending email to {to_email}: {str(e)}")
        # Log to mock as fallback if real fails
        with open(MOCK_LOG, "a") as f:
            f.write(f"--- FAILED EMAIL ATTEMPT TO: {to_email} ---\n")
            f.write(f"ERROR: {str(e)}\n")
            f.write(f"SUBJECT: {subject}\n")
            f.write(f"BODY:\n{body}\n")
            f.write("-" * 30 + "\n\n")
        raise e # Raise to let the router know it failed

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
