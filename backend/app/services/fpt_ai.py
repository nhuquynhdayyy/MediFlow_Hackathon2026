import json
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv()

DEFAULT_MODEL = "Llama-3.3-70B-Instruct"


def _get_fpt_api_url() -> str:
    base_url = os.getenv("FPT_AI_URL", "https://mkp-api.fptcloud.com")
    if base_url.endswith("/chat/completions") or base_url.endswith("/completions"):
        return base_url
    return f"{base_url.rstrip('/')}/v1/chat/completions"


def _get_fpt_api_key() -> str:
    api_key = os.getenv("FPT_API_KEY", "")
    if not api_key:
        raise RuntimeError("FPT_API_KEY chưa được cấu hình.")
    return api_key


def call_fpt_ai(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 1024,
) -> Any:
    api_key = _get_fpt_api_key()
    url = _get_fpt_api_url()
    payload = {
        "model": model or os.getenv("FPT_AI_MODEL", DEFAULT_MODEL),
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"FPT API {e.code}: {body[:200]}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"FPT network error: {e.reason}")


def extract_text_from_response(data: Any) -> str:
    if not data:
        return ""
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        choices = data.get("choices")
        if isinstance(choices, list) and choices:
            msg = choices[0].get("message", {})
            if isinstance(msg, dict):
                return msg.get("content", "")
            return choices[0].get("text", "")

        for key in ("text", "result"):
            if key in data and isinstance(data[key], str):
                return data[key]

        output = data.get("output") or data.get("outputs")
        if isinstance(output, list) and output:
            first = output[0]
            if isinstance(first, dict):
                content = first.get("content")
                if isinstance(content, list) and content:
                    return content[0].get("text", "")
                return first.get("text", "") or first.get("content", "")
    return ""


def generate_text(
    prompt: str,
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 1024,
) -> str:
    system_prompt = system_prompt or (
        "Bạn là AI y tế và quản lý bệnh viện. Trả lời ngắn gọn, rõ ràng và hữu ích. "
        "Nếu được yêu cầu, hãy xuất JSON thuần."
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt},
    ]
    response = call_fpt_ai(messages, model=model, temperature=temperature, max_tokens=max_tokens)
    return extract_text_from_response(response)


def parse_json_response(text: str) -> Optional[Dict[str, Any]]:
    clean = text.strip()
    if clean.startswith("```"):
        parts = clean.split("```")
        clean = parts[1] if len(parts) > 1 else clean
        if clean.startswith("json"):
            clean = clean[4:].strip()

    match = re.search(r"\{.*\}", clean, re.DOTALL)
    if match:
        clean = match.group(0)

    try:
        return json.loads(clean)
    except (json.JSONDecodeError, ValueError):
        return None
