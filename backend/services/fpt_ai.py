"""
FPT AI Marketplace Service
Endpoint: https://mkp-api.fptcloud.com/chat/completions
Auth: Bearer {api_key}
"""

import httpx
import json
from typing import Optional, List, AsyncGenerator


FPT_BASE_URL = "https://mkp-api.fptcloud.com"
TIMEOUT = 60.0


class FPTAIService:
    def __init__(self, api_key: str, model: str = "Llama-3.3-70B-Instruct"):
        self.api_key = api_key
        self.model = model
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

    def _build_messages(self, system: str, user: str, history: list = None) -> list:
        messages = [{"role": "system", "content": system}]
        if history:
            for h in history:
                messages.append({"role": h.role, "content": h.content})
        messages.append({"role": "user", "content": user})
        return messages

    async def chat(self, system: str, user: str, history: list = None) -> Optional[str]:
        """Non-streaming chat completion"""
        payload = {
            "model": self.model,
            "messages": self._build_messages(system, user, history),
            "stream": False,
            "max_tokens": 1024,
            "temperature": 0.3,
        }
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            try:
                resp = await client.post(
                    f"{FPT_BASE_URL}/chat/completions",
                    headers=self.headers,
                    json=payload
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                print(f"FPT API HTTP error: {e.response.status_code} — {e.response.text}")
                return None
            except Exception as e:
                print(f"FPT API error: {e}")
                return None

    async def chat_stream(self, system: str, user: str, history: list = None) -> AsyncGenerator[str, None]:
        """Streaming chat completion — yields text chunks"""
        payload = {
            "model": self.model,
            "messages": self._build_messages(system, user, history),
            "stream": True,
            "max_tokens": 1024,
            "temperature": 0.3,
        }
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{FPT_BASE_URL}/chat/completions",
                    headers=self.headers,
                    json=payload
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        raw = line[6:]
                        if raw == "[DONE]":
                            break
                        try:
                            chunk = json.loads(raw)
                            delta = chunk["choices"][0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except (json.JSONDecodeError, KeyError):
                            continue
            except Exception as e:
                yield f"\n[Lỗi kết nối: {e}]"
