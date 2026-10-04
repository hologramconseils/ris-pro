import os
import sys
import unittest
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from regulatory_watch_agent import (  # noqa: E402
    UPDATES_HEADING,
    apply_changes,
    build_report,
    is_official_url,
    parse_model_json,
    validate_change,
)

CONTENT = """# Règles

- L'âge légal est fixé à 64 ans pour la génération 1968.
- La surcote est de 1,25 % par trimestre.

### Mises à jour réglementaires

*   **Décret n° 2026-344 du 7 mai 2026** : déjà intégré.
"""

TODAY = date(2026, 10, 4)


def change(**overrides):
    base = {
        "old_text": "- L'âge légal est fixé à 64 ans pour la génération 1968.",
        "new_text": "- L'âge légal est fixé à 63 ans et 9 mois pour la génération 1968.",
        "source_reference": "Décret n° 2026-900 du 1er octobre 2026",
        "source_url": "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000000000",
        "justification": "Nouveau calendrier de l'âge légal.",
    }
    base.update(overrides)
    return base


class ValidateChangeTest(unittest.TestCase):
    def test_valid_change_is_accepted(self):
        self.assertIsNone(validate_change(change(), CONTENT))

    def test_rejects_text_not_quoted_verbatim(self):
        self.assertIn("introuvable", validate_change(change(old_text="L'âge légal est de 64 ans."), CONTENT))

    def test_rejects_non_official_url(self):
        self.assertIn("URL", validate_change(change(source_url="https://www.capital.fr/retraite"), CONTENT))

    def test_accepts_official_subdomain(self):
        self.assertTrue(is_official_url("https://legislation.lassuranceretraite.fr/circulaire"))
        self.assertFalse(is_official_url("https://legifrance.gouv.fr.example.com/x"))

    def test_rejects_vague_source(self):
        self.assertIn("texte officiel", validate_change(change(source_reference="Article de presse récent"), CONTENT))
        self.assertIn("texte officiel", validate_change(change(source_reference="Décret récent"), CONTENT))

    def test_rejects_source_already_cited_even_if_worded_differently(self):
        reason = validate_change(change(source_reference="décret 2026-344 (7 mai 2026)"), CONTENT)
        self.assertIn("déjà citée", reason)

    def test_rejects_identical_replacement(self):
        c = change()
        c["new_text"] = c["old_text"]
        self.assertIn("identique", validate_change(c, CONTENT))


class ApplyChangesTest(unittest.TestCase):
    def test_applies_targeted_replacement_and_logs_source(self):
        new_content, accepted, rejected = apply_changes(CONTENT, [change()], TODAY)
        self.assertEqual(len(accepted), 1)
        self.assertEqual(rejected, [])
        self.assertIn("63 ans et 9 mois pour la génération 1968", new_content)
        self.assertNotIn("64 ans pour la génération 1968", new_content)
        # Le reste du document est intact : pas de réécriture.
        self.assertIn("- La surcote est de 1,25 % par trimestre.", new_content)
        self.assertEqual(new_content.count(UPDATES_HEADING), 1)
        self.assertIn("Décret n° 2026-900 du 1er octobre 2026", new_content)
        self.assertIn("2026-10-04", new_content)

    def test_no_valid_change_leaves_file_untouched(self):
        new_content, accepted, rejected = apply_changes(CONTENT, [change(source_url="https://blog.example.com")], TODAY)
        self.assertEqual(new_content, CONTENT)
        self.assertEqual(accepted, [])
        self.assertEqual(len(rejected), 1)

    def test_adds_updates_section_when_missing(self):
        content = "# Règles\n\n- L'âge légal est fixé à 64 ans pour la génération 1968.\n"
        new_content, accepted, _ = apply_changes(content, [change()], TODAY)
        self.assertEqual(len(accepted), 1)
        self.assertIn(UPDATES_HEADING, new_content)


class ParseModelJsonTest(unittest.TestCase):
    def test_parses_fenced_json(self):
        self.assertEqual(parse_model_json('```json\n{"changes": []}\n```'), [])

    def test_rejects_non_json(self):
        with self.assertRaises(ValueError):
            parse_model_json("NO_CHANGE")


class BuildReportTest(unittest.TestCase):
    def test_report_lists_sources(self):
        report = build_report([("regles_gestion_retraite_2023.md", [change()])])
        self.assertIn("regles_gestion_retraite_2023.md", report)
        self.assertIn("legifrance.gouv.fr", report)
        self.assertIn("Avant", report)


if __name__ == "__main__":
    unittest.main()
