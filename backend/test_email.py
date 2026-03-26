import os
import sys
from dotenv import load_dotenv

# Add current directory to path so we can import services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.mail import send_email

def test_resend():
    load_dotenv()
    
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    smtp_user = os.getenv("SMTP_USER", "onboarding@resend.dev").strip()
    test_recipient = "bertrand.saulnerond@hologramconseils.com"
    
    print(f"--- Diagnostic Resend ---")
    print(f"RESEND_API_KEY: {'Définie' if api_key else 'MANQUANTE'}")
    print(f"SMTP_USER (Expéditeur): {smtp_user}")
    print(f"Destinataire de test: {test_recipient}")
    
    if not api_key:
        print("\nERREUR: La clé API 'RESEND_API_KEY' n'est pas configurée dans le fichier backend/.env")
        print("Le système fonctionnera en mode MOCK (pas d'envoi réel).")
        return

    try:
        print("\nTentative d'envoi d'un email de test...")
        send_email(
            to_email=test_recipient,
            subject="Test de configuration RIS Pro",
            body="Ceci est un test pour vérifier que la réinitialisation de mot de passe fonctionnera avec votre domaine hologramconseils.com."
        )
        print("\nSUCCÈS: L'email a été envoyé (vérifiez votre boîte de réception).")
    except Exception as e:
        print(f"\nÉCHEC: Une erreur est survenue lors de l'envoi : {str(e)}")
        print("\nNote: Si vous utilisez 'onboarding@resend.dev', le destinataire doit être l'email associé à votre compte Resend.")

if __name__ == "__main__":
    test_resend()
