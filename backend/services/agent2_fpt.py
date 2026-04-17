"""
FPT AI service dedicated to the isolated Agent 2 backend.
"""

from __future__ import annotations

import json
from typing import AsyncGenerator, Optional

import httpx

FPT_BASE_URL = "https://mkp-api.fptcloud.com"
TIMEOUT = 60.0


class Agent2FPTAIService:
    def __init__(self, api_key: str, model: str = "Llama-3.3-70B-Instruct"):
        self.api_key = api_key
        self.model = model
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }

    def _build_messages(self, system: str, user: str, history: list | None = None) -> list:
        messages = [{"role": "system", "content": system}]
        if history:
            for item in history:
                if isinstance(item, dict):
                    role = item.get("role")
                    content = item.get("content")
                else:
                    role = getattr(item, "role", None)
                    content = getattr(item, "content", None)
                if role and content:
                    messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": user})
        return messages

    async def chat(self, system: str, user: str, history: list | None = None) -> Optional[str]:
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
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
            except Exception:
                return None

    async def chat_stream(
        self,
        system: str,
        user: str,
        history: list | None = None,
    ) -> AsyncGenerator[str, None]:
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
                    json=payload,
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
                        except (json.JSONDecodeError, KeyError, IndexError, TypeError):
                            continue
            except Exception as exc:
                yield f"\n[Loi ket noi: {exc}]"
