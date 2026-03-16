import os
import resend
from dotenv import load_dotenv

load_dotenv()

# Mock email flag for development
USE_MOCK = True
MOCK_LOG = "/tmp/emails.log"

def send_email(to_email: str, subject: str, body: str):
    """
    Sends an email using Resend API or logs to a file in mock mode.
    """
    resend_api_key = os.getenv("RESEND_API_KEY", "").strip() or None
    
    if not resend_api_key:
        print(f"RESEND_API_KEY not configured (Mock mode active). Email to {to_email} logged to {MOCK_LOG}")
        with open(MOCK_LOG, "a") as f:
            f.write(f"--- MOCK EMAIL TO: {to_email} ---\n")
            f.write(f"SUBJECT: {subject}\n")
            f.write(f"BODY:\n{body}\n")
            f.write("-" * 30 + "\n\n")
        return

    try:
        resend.api_key = resend_api_key
        
        # Determine the sender email.
        # Resend requires a verified domain. By default, 'onboarding@resend.dev' works for testing if the recipient is the same as the resend account owner.
        # Or a custom verified domain like 'contact@yourdomain.com'
        from_email = os.getenv("SMTP_USER", "onboarding@resend.dev").strip()
        
        params = {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": body.replace('\n', '<br>') # Simple conversion to HTML for better display
        }
        
        email = resend.Emails.send(params)
        print(f"Email successfully sent via Resend to {to_email}. ID: {email.get('id')}")
    except Exception as e:
        print(f"CRITICAL RESEND ERROR: {str(e)}")
        # Log to mock as fallback if real fails
        with open(MOCK_LOG, "a") as f:
            f.write(f"--- FAILED EMAIL ATTEMPT TO: {to_email} ---\n")
            f.write(f"ERROR: {str(e)}\n")
            f.write(f"SUBJECT: {subject}\n")
            f.write(f"BODY:\n{body}\n")
            f.write("-" * 30 + "\n\n")
        raise e

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
