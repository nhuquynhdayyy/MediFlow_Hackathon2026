import os
import json
import urllib.request
import urllib.error
from pathlib import Path

dotenv_path = Path("c:\\MediFlow\\MediFlow_Hackathon2026\\backend\\.env")
with dotenv_path.open(encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]
        os.environ.setdefault(key, value)
api_key = os.getenv("FPT_API_KEY")
base_url = os.getenv("FPT_AI_URL", "https://mkp-api.fptcloud.com")
model = os.getenv("FPT_AI_MODEL", "Llama-3.3-70B-Instruct")

url = f"{base_url.rstrip('/')}/v1/chat/completions"
print(f"Testing URL: {url} with model {model} and key start: {api_key[:5] if api_key else 'None'}")

payload = {
    "model": model,
    "messages": [
        {"role": "user", "content": "hello"}
    ],
    "temperature": 0.3,
    "max_tokens": 50,
}

request_data = json.dumps(payload).encode("utf-8")
request = urllib.request.Request(
    url,
    data=request_data,
    headers={
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
)

try:
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read().decode("utf-8")
        print("SUCCESS:")
        print(raw)
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='ignore')
    print(f"HTTP Error: {e.code} {e.reason} | body: {body}")
except Exception as e:
    print(f"Exception: {e}")
