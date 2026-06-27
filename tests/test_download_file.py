import os
import httpx
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

supabase_url = os.environ.get("VITE_SUPABASE_URL")
supabase_key = os.environ.get("VITE_SUPABASE_ANON_KEY")

file_path = "uploads/0vkc7hk0oyw_1782599003189.pdf"

url = f"{supabase_url}/storage/v1/object/authenticated/documents/{file_path}"
headers = {
    "Authorization": f"Bearer {supabase_key}",
    "apikey": supabase_key
}

response = httpx.get(url, headers=headers)
print(f"Download response for {file_path}: {response.status_code}")
print(f"Content length: {len(response.content)}")
print(f"Error text: {response.text[:200]}")
