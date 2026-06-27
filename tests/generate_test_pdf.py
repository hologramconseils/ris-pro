from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os

def create_mock_pdf(filename):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    
    text = [
        "RELEVE DE SITUATION INDIVIDUELLE RETRAITE (RIS)",
        "Assure : Bertrand SAULNEROND",
        "Date de naissance : 14/06/1977",
        "Numero de Securite Sociale : 1770675001002",
        "",
        "Historique des droits enregistres :",
        "2000 | Regime General | 4 trimestres | 15000 EUR | Employeur A",
        "2001 | Regime General | 4 trimestres | 16000 EUR | Employeur A",
        "2002 | Regime General | 2 trimestres | 8000 EUR | Employeur B",
        "2003 | Regime General | 4 trimestres | 20000 EUR | Employeur A",
        "2004 | Regime General | 4 trimestres | 22000 EUR | Employeur A",
        "",
        "Fin du document."
    ]
    
    y = height - 50
    for line in text:
        c.drawString(50, y, line)
        y -= 20
        
    c.save()
    print(f"Mock PDF generated successfully at: {filename}")

if __name__ == '__main__':
    create_mock_pdf('tests/mock_career.pdf')
