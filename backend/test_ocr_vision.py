import asyncio
import os
import json
import base64
import fitz
from services import ai_service
from services import ris_parser
from dotenv import load_dotenv

load_dotenv()

async def test_scanned_pdf_analysis():
    print("🚀 Testing Gemini Vision OCR Fallback...")
    
    # Use an existing PDF for the test
    pdf_path = "uploads/012d1d8d-6357-4986-b5d9-c99be2547bf0_rise3.pdf"
    if not os.path.exists(pdf_path):
        print(f"❌ PDF not found: {pdf_path}")
        return

    print(f"📄 Processing {pdf_path} as if it were scanned...")
    
    # Manual extraction of images (simulating ris_parser's behavior for scans)
    images = []
    doc = fitz.open(pdf_path)
    for i in range(min(3, len(doc))): # Just 3 pages for the test to save tokens/time
        page = doc[i]
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img_data = pix.tobytes("png")
        images.append(base64.b64encode(img_data).decode('utf-8'))
    doc.close()
    
    print(f"🖼️ Generated {len(images)} page images.")
    
    # Call AI service with VISION mode
    print("🤖 Calling Gemini Vision...")
    result_raw = await ai_service.generate_ai_audit(
        anomalies=[],
        filename="scanned_test.pdf",
        raw_text="[TEST MODE SCAN - PAS DE TEXTE EXTRAIT]",
        images=images
    )
    
    try:
        result_json = json.loads(result_raw)
        print("\n✅ SUCCESS: Gemini Vision returned valid JSON")
        print(f"Risk Level: {result_json.get('niveau_risque')}")
        print(f"Global Resume: {result_json.get('resume_global')}")
        
        timeline = result_json.get('full_timeline', [])
        print(f"Timeline size: {len(timeline)} years")
        if timeline:
            print("Timeline Sample (First 3):")
            for item in timeline[:3]:
                print(f"  - {item.get('annee')}: {item.get('statut')} ({item.get('trimestres_valides')}/4) -> {item.get('activite')}")
                
    except json.JSONDecodeError:
        print("\n❌ FAILED: Gemini returned non-JSON response")
        print(f"Raw response: {result_raw[:500]}...")

if __name__ == "__main__":
    asyncio.run(test_scanned_pdf_analysis())
