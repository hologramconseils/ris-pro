import os
import time
import subprocess
import httpx
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

def run_test():
    # Start backend server
    print("Starting backend server...")
    proc = subprocess.Popen(
        ["./venv/bin/python3", "-m", "uvicorn", "main:app", "--port", "8000"],
        cwd="backend"
    )
    time.sleep(3) # Wait for server to boot
    
    try:
        print("Making POST request to /api/analyze...")
        url = "http://localhost:8000/api/analyze"
        payload = {"filePath": "uploads/0vkc7hk0oyw_1782599003189.pdf"}
        
        response = httpx.post(url, json=payload, timeout=20.0)
        print(f"Status Code: {response.status_code}")
        print(f"Response Content: {response.text}")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        print("Stopping backend server...")
        proc.terminate()
        proc.wait()

if __name__ == '__main__':
    run_test()
