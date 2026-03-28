# RIS Pro - Moteur d'Analyse Retraite

## 🧊 Modules Gelés (Frozen Modules)
Conformément aux instructions de stabilité, les sections suivantes du code source sont considérées comme stables et **ne doivent plus être modifiées** lors des futures demandes d'évolution, sauf demande explicite :

1.  **Extraction PDF Non-Natif** (`ris_parser.py`) : Module de secours pour les documents scannés.
2.  **Protection Métadonnées & Filtrage des Années** (`ris_parser.py`) : Logique `strict_years` évitant les années fantômes (ex: 2025).
3.  **Extraction Heuristique des Employeurs** (`ris_parser.py`) : Identification automatisée des noms de sociétés.
4.  **Tableau de Contrôle Technique** (`DetailedResult.jsx`) : Structure du tableau et colonne "Employeur" (ex-Régime).

---
## Installation & Développement
- **Backend** : FastAPI (Python 3.10+)
- **Frontend** : React + Vite
- **BDD** : SQLite (ris_scan_pro.db)
