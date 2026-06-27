import os
import httpx
from dotenv import load_dotenv

# Load env from root
load_dotenv(dotenv_path='.env')

supabase_url = os.environ.get("VITE_SUPABASE_URL")
supabase_key = os.environ.get("VITE_SUPABASE_ANON_KEY")

print(f"URL: {supabase_url}")
print(f"Key preview: {supabase_key[:20]}..." if supabase_key else "None")

# Try to list files in bucket
url = f"{supabase_url}/storage/v1/object/list/documents"
headers = {
    "Authorization": f"Bearer {supabase_key}",
    "apikey": supabase_key,
    "Content-Type": "application/json"
}
data = {
    "prefix": "uploads/",
    "limit": 10,
    "offset": 0,
    "sortBy": {"column": "name", "order": "asc"}
}

response = httpx.post(url, headers=headers, json=data)
print(f"List response: {response.status_code}")
print(response.text)
