import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        page.on("requestfailed", lambda req: print(f"REQUEST FAILED: {req.method} {req.url}"))
        page.on("response", lambda res: print(f"RESPONSE: {res.status} {res.url}") if res.status >= 400 else None)
        page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
        
        print("Navigating to http://localhost:5173...")
        page.goto("http://localhost:5173")
        
        print("Waiting 5 seconds...")
        time.sleep(5)
        
        print("Taking screenshot...")
        page.screenshot(path="tests/debug_vite_screenshot.png")
        
        print("Page HTML content (first 1000 chars):")
        print(page.content()[:1000])
        
        inputs = page.locator('input').all()
        print(f"Number of input elements: {len(inputs)}")
        
        browser.close()

if __name__ == '__main__':
    run()
