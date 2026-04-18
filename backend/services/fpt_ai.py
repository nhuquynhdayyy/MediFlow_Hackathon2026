"""FPT AI Marketplace service - gọi LLM API."""

import json
import logging

import httpx

logger = logging.getLogger(__name__)

FPT_BASE_URL = "https://mkp-api.fptcloud.com"


class FPTAIService:
    async def call(
        self,
        api_key: str,
        model: str,
        system_prompt: str,
        user_message: str,
        context: dict = None,
    ) -> str:
        """Gọi FPT AI API, trả về text response."""
        messages = [{"role": "system", "content": system_prompt}]
        if context:
            messages.append(
                {
                    "role": "user",
                    "content": f"Thông tin bệnh nhân:\n{json.dumps(context, ensure_ascii=False)}",
                }
            )
        messages.append({"role": "user", "content": user_message})

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{FPT_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "temperature": 0.3, "max_tokens": 2048},
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def stream(
        self,
        api_key: str,
        model: str,
        system_prompt: str,
        user_message: str,
    ):
        """Gọi FPT AI API với streaming, yield từng chunk text."""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{FPT_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "stream": True, "temperature": 0.3},
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            delta = data["choices"][0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except Exception:
                            pass
