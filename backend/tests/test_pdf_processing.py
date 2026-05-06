import unittest
from unittest.mock import patch, MagicMock, AsyncMock
import json
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from services import ris_parser, ai_service

# Mock environment
ai_service.MISTRAL_API_KEY = "fake_mistral"
ai_service.GEMINI_API_KEY = "fake_gemini"
ai_service.MISTRAL_DISABLED = False

class TestPDFProcessing(unittest.IsolatedAsyncioTestCase):

    @patch("services.ris_parser.fitz.open")
    @patch("services.ris_parser.pytesseract.image_to_string")
    def test_ris_parser_native(self, mock_ocr, mock_fitz):
        # Mock a native PDF with enough text
        mock_doc = MagicMock()
        mock_page = MagicMock()
        mock_page.get_text.return_value = "CNAV Relevé de carrière. " * 100 # > 2000 chars
        
        # Pixmap mock for images (always called now)
        mock_pix = MagicMock()
        mock_pix.tobytes.return_value = b"fake_img_data"
        mock_page.get_pixmap.return_value = mock_pix
        
        mock_doc.__iter__.return_value = [mock_page]
        mock_doc.__getitem__.return_value = mock_page
        mock_doc.__len__.return_value = 1
        mock_fitz.return_value = mock_doc
        
        res = ris_parser.parse_ris_file("fake.pdf")
        
        # Check if we got an error dict or real dict
        self.assertNotIn("error", res)
        self.assertIn("is_scanned", res)
        self.assertFalse(res["is_scanned"])
        self.assertIn("CNAV", res["raw_text"])
        mock_ocr.assert_not_called()

    @patch("services.ris_parser.fitz.open")
    @patch("services.ris_parser.pytesseract.image_to_string")
    @patch("services.ris_parser.Image.open")
    @patch("shutil.which")
    def test_ris_parser_scanned(self, mock_which, mock_img_open, mock_ocr, mock_fitz):
        mock_which.return_value = "/usr/bin/tesseract"
        # Mock a scanned PDF (very little native text)
        mock_doc = MagicMock()
        mock_page = MagicMock()
        mock_page.get_text.return_value = " "
        
        # Pixmap mock for images
        mock_pix = MagicMock()
        mock_pix.tobytes.return_value = b"fake_img_data"
        mock_page.get_pixmap.return_value = mock_pix
        
        mock_doc.__iter__.return_value = [mock_page]
        mock_doc.__getitem__.return_value = mock_page
        mock_doc.__len__.return_value = 1
        mock_fitz.return_value = mock_doc
        
        mock_ocr.return_value = "TEXT DETECTED BY OCR"
        
        res = ris_parser.parse_ris_file("fake.pdf")
        
        self.assertNotIn("error", res)
        self.assertTrue(res["is_scanned"])
        self.assertIn("TEXT DETECTED BY OCR", res["raw_text"])
        mock_ocr.assert_called()

    @patch("services.ai_service._call_mistral", new_callable=AsyncMock)
    @patch("services.ai_service._call_gemini", new_callable=AsyncMock)
    async def test_ai_routing_native(self, mock_gemini, mock_mistral):
        # Mock Mistral success for native
        mock_mistral.return_value = json.dumps({
            "anomalie_detectee": "non", 
            "resume_global": "Analyse OK. " * 50, # Long enough
            "full_timeline": [],
            "compte_rendu": "RAS"
        })
        
        res_json = await ai_service.generate_ai_audit([], "test.pdf", raw_text="Full text", images=[])
        res = json.loads(res_json)
        
        self.assertIn("Analyse OK", res["resume_global"])
        mock_mistral.assert_called_once()
        mock_gemini.assert_not_called()

    @patch("services.ai_service._call_mistral", new_callable=AsyncMock)
    @patch("services.ai_service._call_gemini", new_callable=AsyncMock)
    async def test_ai_routing_scanned_fallback(self, mock_gemini, mock_mistral):
        # Mock Mistral returning short/bad response for scan
        mock_mistral.return_value = json.dumps({"short": "res"}) # Length < 800
        mock_gemini.return_value = json.dumps({
            "anomalie_detectee": "oui", 
            "resume_global": "Vision OK. " * 50,
            "full_timeline": [],
            "compte_rendu": "RAS"
        })
        
        res_json = await ai_service.generate_ai_audit([], "test.pdf", raw_text="OCR text" * 50, images=["img1"])
        res = json.loads(res_json)
        
        self.assertIn("Vision OK", res["resume_global"])
        mock_mistral.assert_called_once()
        mock_gemini.assert_called_once()

if __name__ == "__main__":
    unittest.main()
