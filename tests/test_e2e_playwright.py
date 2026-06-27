import os
import sys
import time
from playwright.sync_api import sync_playwright

# Setup absolute paths
TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
MOCK_PDF_PATH = os.path.join(TESTS_DIR, 'mock_career.pdf')

def test_full_flow():
    print("Starting E2E flow test...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Listen to logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
        
        try:
            # 1. Access the homepage
            print("Navigating to homepage...")
            page.goto('http://localhost:5173')
            page.wait_for_load_state('networkidle')
            
            # Verify title or key element is present after dynamic mount
            print("Waiting for page header to mount...")
            page.wait_for_selector('text=Auditez votre')
            print("✓ Homepage loaded & React mounted.")
            
            # 2. Upload file
            print(f"Uploading mock career PDF from: {MOCK_PDF_PATH}")
            file_input = page.locator('input[type="file"]')
            file_input.set_input_files(MOCK_PDF_PATH)
            
            # Wait for navigation to /diagnostic
            print("Waiting for redirection to diagnostic page...")
            page.wait_for_url('**/diagnostic?file=*', timeout=20000)
            print("✓ Redirection to diagnostic page successful.")
            
            # 3. Wait for progress steps to finish
            print("Waiting for audit analysis to complete...")
            page.wait_for_selector('text=Analyse intelligente en cours...', state='detached', timeout=30000)
            print("✓ Audit analysis completed.")
            
            # Take intermediate screenshot
            page.screenshot(path="tests/after_analysis.png")
            
            # Print page text to see if there's an error message
            print("Page content snapshot after loading completed:")
            print(page.locator('body').text_content()[:1000])
            
            # 4. Check Freemium results
            print("Checking Freemium diagnostic results...")
            page.wait_for_selector('text=Diagnostic Freemium', timeout=5000)
            page.wait_for_selector('text=Anomalies identifiées', timeout=5000)
            print("✓ Freemium results page verified.")
            
            # 5. Access premium view (mocking access)
            print("Navigating to premium Bilan in mock mode to verify render...")
            url = page.url
            file_param = url.split('file=')[1] if 'file=' in url else ''
            page.goto(f'http://localhost:5173/bilan?mock=true&file={file_param}')
            page.wait_for_load_state('networkidle')
            
            # Wait for the AI conseilleur analysis to load
            print("Waiting for AI retirement adviser suggestions...")
            page.wait_for_selector('text=Génération de votre Bilan Retraite...', state='detached', timeout=40000)
            
            # Verify premium strategies render
            page.wait_for_selector('text=Bilan Retraite')
            page.wait_for_selector('text=Synthèse Globale de Situation')
            page.wait_for_selector('text=Stratégies d\'Optimisation')
            print("✓ Premium Bilan and recommendations verified successfully!")
            
        except Exception as e:
            print(f"TEST FAILED: {e}")
            page.screenshot(path="tests/failure_screenshot.png")
            print("HTML Body content on failure:")
            try:
                print(page.locator('body').inner_html()[:2000])
            except Exception:
                pass
            raise e
        finally:
            browser.close()
            
    print("🎉 All E2E checks passed successfully!")

if __name__ == '__main__':
    test_full_flow()
