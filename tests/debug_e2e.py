import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Listen to request failures
        page.on("requestfailed", lambda req: print(f"REQUEST FAILED: {req.method} {req.url}: {req.failure.error_text if req.failure else 'No error text'}"))
        # Listen to response status codes
        page.on("response", lambda res: print(f"RESPONSE: {res.status} {res.url}") if res.status >= 400 else None)
        # Listen to console events
        page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
        
        print("Navigating to http://localhost:3000...")
        page.goto("http://localhost:3000")
        
        print("Waiting 10 seconds...")
        time.sleep(10)
        
        browser.close()

if __name__ == '__main__':
    run()
