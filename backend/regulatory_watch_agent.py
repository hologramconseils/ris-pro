"""Agent de veille réglementaire (retraite France).

Exécuté chaque jour par .github/workflows/regulatory-watch-v2.yml. Les fichiers regles_*.md
sont transmis tels quels à l'IA rédactrice du bilan premium (frontend/api/analyze.js) : toute
modification doit donc être sourcée et vérifiable par un humain avant fusion.

Principes (pour éviter les réécritures quotidiennes sans changement de loi constatées jusqu'ici) :
- l'IA ne réécrit jamais un fichier : elle propose des remplacements ciblés d'un passage existant,
  cité mot pour mot ;
- chaque remplacement doit s'appuyer sur un texte officiel (loi, décret, arrêté, circulaire)
  publié sur un site officiel, et pas déjà cité dans le fichier ;
- tout ce qui ne respecte pas ces règles est écarté, et le rapport des modifications retenues
  (avec leurs sources) sert de description à la pull request.
"""

import json
import os
import re
import sys
from datetime import date
from urllib.parse import urlparse

# Fichiers chargés par frontend/api/analyze.js : seuls ceux-ci ont un effet sur les bilans.
FILES_TO_WATCH = [
    "regles_conge_naissance.md",
    "regles_cumul_emploi_retraite_createur_droits.md",
    "regles_depart_anticipe_2023.md",
    "regles_expatriation_internationale.md",
    "regles_gestion_retraite_2023.md",
    "regles_independants_fonctionnaires.md",
    "regles_minima_sociaux_aspa.md",
    "regles_nouveau_conge_naissance_retraite.md",
    "regles_optimisation_retraite_2023.md",
    "regles_pension_reversion_2023.md",
    "regles_polypensionnes_lura.md",
    "regles_retraite_progressive_60_ans.md",
]

# Sites publiant les textes officiels ou les circulaires des caisses de retraite.
OFFICIAL_DOMAINS = (
    "legifrance.gouv.fr",
    "securite-sociale.fr",
    "boss.gouv.fr",
    "service-public.fr",
    "info-retraite.fr",
    "lassuranceretraite.fr",
    "legislation.lassuranceretraite.fr",
    "agirc-arrco.fr",
    "msa.fr",
    "urssaf.fr",
)

# Un texte officiel doit être identifiable : type de texte + numéro ou date.
OFFICIAL_REFERENCE = re.compile(r"\b(loi|décret|decret|arrêté|arrete|ordonnance|circulaire)\b", re.IGNORECASE)

UPDATES_HEADING = "### Mises à jour réglementaires"

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def build_prompt(filename, content):
    return f"""Vous êtes un agent de conformité expert de la législation française de la retraite.

Voici le document de référence « {filename} », utilisé pour rédiger des bilans retraite :
---
{content}
---

MISSION : à l'aide de la recherche Google, vérifiez si un TEXTE OFFICIEL (loi, décret, arrêté,
ordonnance, circulaire Cnav / Agirc-Arrco / MSA) publié ou entré en vigueur rend FAUSSE une
affirmation précise de ce document.

RÈGLES STRICTES :
1. Ne reformulez rien, n'améliorez pas le style, ne complétez pas le document : seules les
   affirmations devenues inexactes à cause d'un texte officiel comptent.
2. Ignorez tout texte déjà cité dans le document (section « Mises à jour réglementaires » ou
   corps du texte).
3. Chaque modification doit citer un texte officiel précis (type, numéro, date) et une URL vers
   un site officiel (legifrance.gouv.fr, securite-sociale.fr, service-public.fr, info-retraite.fr,
   lassuranceretraite.fr, agirc-arrco.fr, msa.fr, urssaf.fr, boss.gouv.fr).
4. "old_text" doit être un extrait COPIÉ MOT POUR MOT du document (une phrase ou un élément de
   liste), et "new_text" son remplacement corrigé, au même format Markdown.
5. En cas de doute, ne proposez rien. Une absence de modification est la réponse attendue la
   plupart du temps.

Répondez UNIQUEMENT avec un objet JSON valide, sans texte autour :
{{"changes": [{{"old_text": "...", "new_text": "...", "source_reference": "Décret n° 2026-XXX du JJ mois AAAA",
"source_url": "https://www.legifrance.gouv.fr/...", "justification": "une phrase"}}]}}
Si rien n'est à corriger : {{"changes": []}}
"""


def parse_model_json(text):
    """Extrait l'objet JSON de la réponse du modèle (éventuellement entourée de ```json)."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Aucun objet JSON dans la réponse")
    data = json.loads(cleaned[start:end + 1])
    changes = data.get("changes", [])
    if not isinstance(changes, list):
        raise ValueError("'changes' n'est pas une liste")
    return changes


def is_official_url(url):
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        return False
    return any(host == d or host.endswith("." + d) for d in OFFICIAL_DOMAINS)


def is_already_cited(reference, content):
    """Un texte est considéré déjà cité si son numéro (ex. 2026-699) figure dans le fichier,
    quelle que soit la formulation, ou à défaut si la référence entière y figure."""
    numbers = re.findall(r"\b\d{2,4}-\d{1,5}\b", reference)
    if numbers:
        return any(n in content for n in numbers)
    return reference.lower() in content.lower()


def validate_change(change, content):
    """Renvoie None si la modification est recevable, sinon la raison du rejet."""
    old_text = (change.get("old_text") or "").strip()
    new_text = (change.get("new_text") or "").strip()
    reference = (change.get("source_reference") or "").strip()
    url = (change.get("source_url") or "").strip()

    if not old_text or not new_text:
        return "extrait ou remplacement vide"
    if old_text == new_text:
        return "remplacement identique à l'original"
    occurrences = content.count(old_text)
    if occurrences == 0:
        return "extrait introuvable mot pour mot dans le fichier"
    if occurrences > 1:
        return "extrait ambigu (présent plusieurs fois)"
    if not OFFICIAL_REFERENCE.search(reference) or not re.search(r"\d", reference):
        return f"source non identifiée comme un texte officiel (type et numéro ou date) : {reference!r}"
    if is_already_cited(reference, content):
        return f"source déjà citée dans le fichier : {reference!r}"
    if not is_official_url(url):
        return f"URL hors site officiel : {url!r}"
    return None


def apply_changes(content, changes, today):
    """Applique les modifications recevables. Renvoie (nouveau contenu, retenues, rejetées)."""
    accepted, rejected = [], []
    for change in changes:
        reason = validate_change(change, content)
        if reason:
            rejected.append((change, reason))
            continue
        content = content.replace(change["old_text"].strip(), change["new_text"].strip(), 1)
        accepted.append(change)

    if accepted:
        entries = "\n".join(
            f"*   **{c['source_reference'].strip()}** ({c['source_url'].strip()}) : {c.get('justification', '').strip()} "
            f"_(ajouté le {today.isoformat()})_"
            for c in accepted
        )
        if UPDATES_HEADING in content:
            content = content.rstrip() + "\n" + entries + "\n"
        else:
            content = content.rstrip() + f"\n\n{UPDATES_HEADING}\n\n" + entries + "\n"
    return content, accepted, rejected


def build_report(results):
    """Rapport Markdown des modifications retenues, utilisé comme description de PR."""
    lines = [
        "Pull request ouverte automatiquement par l'agent de veille réglementaire RIS Pro.",
        "",
        "Chaque modification ci-dessous remplace un passage précis et s'appuie sur un texte officiel.",
        "**Vérifiez chaque source avant de fusionner** : ces fichiers sont transmis tels quels à l'IA",
        "qui rédige les bilans premium.",
        "",
    ]
    for filename, accepted in results:
        lines.append(f"## `{filename}`")
        for c in accepted:
            lines += [
                f"- **Source** : [{c['source_reference'].strip()}]({c['source_url'].strip()})",
                f"  - Motif : {c.get('justification', '').strip()}",
                f"  - Avant : {c['old_text'].strip()}",
                f"  - Après : {c['new_text'].strip()}",
            ]
        lines.append("")
    return "\n".join(lines)


def ask_model(client, types, prompt):
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            temperature=0,
        ),
    )
    return response.text or ""


def main():
    from dotenv import load_dotenv
    from google import genai
    from google.genai import types

    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("[Error] Aucune clé GEMINI_API_KEY ou GOOGLE_API_KEY dans l'environnement.")
        sys.exit(1)
    client = genai.Client(api_key=api_key)

    print("=== Veille réglementaire (retraite France) ===")
    today = date.today()
    results = []

    for filename in FILES_TO_WATCH:
        path = os.path.join(REPO_ROOT, filename)
        if not os.path.exists(path):
            print(f"[Warning] {filename} introuvable, ignoré.")
            continue
        with open(path, encoding="utf-8") as f:
            content = f.read()

        try:
            changes = parse_model_json(ask_model(client, types, build_prompt(filename, content)))
        except Exception as err:
            print(f"[Error] {filename} : réponse inexploitable ({err}), aucun changement appliqué.")
            continue

        new_content, accepted, rejected = apply_changes(content, changes, today)
        for change, reason in rejected:
            print(f"[Rejeté] {filename} : {reason}")
        if accepted:
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_content)
            results.append((filename, accepted))
            print(f"[Modifié] {filename} : {len(accepted)} modification(s) sourcée(s).")
        else:
            print(f"[Info] {filename} : aucun changement.")

    report_path = os.environ.get("REGULATORY_REPORT_PATH")
    if results and report_path:
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(build_report(results))

    print(f"=== Veille terminée : {len(results)} fichier(s) modifié(s). ===")


if __name__ == "__main__":
    main()
