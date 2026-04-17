import json
import os
from typing import Any, Dict, List
from urllib.error import URLError
from urllib.request import Request, urlopen


def _fpt_available() -> bool:
    return bool(os.getenv("FPT_API_KEY") and os.getenv("FPT_AI_URL"))


def _fallback_explanation(mode: str, context: Dict[str, Any], fallback: Any) -> List[str]:
    if isinstance(fallback, list):
        return fallback
    if fallback:
        return [str(fallback)]
    if mode == "operations":
        return ["Operations AI fallback: use load thresholds and redirect patients away from red zones."]
    return ["Navigator AI fallback: choose the route with the lowest wait and load-adjusted cost."]


def generate_explanation(mode: str, context: Dict[str, Any], fallback: Any) -> List[str]:
    if not _fpt_available():
        return _fallback_explanation(mode, context, fallback)

    prompt = (
        f"You are {mode} explainer for a hospital dashboard. "
        f"Summarize this deterministic result in 2-3 short bullet points: {json.dumps(context)}"
    )

    payload = json.dumps(
        {
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 160,
            "temperature": 0.2,
        }
    ).encode("utf-8")

    request = Request(
        os.environ["FPT_AI_URL"],
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {os.environ['FPT_API_KEY']}",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=8) as response:
            raw = json.loads(response.read().decode("utf-8"))
        content = raw.get("choices", [{}])[0].get("message", {}).get("content", "")
        lines = [line.strip("- ").strip() for line in content.splitlines() if line.strip()]
        return lines or _fallback_explanation(mode, context, fallback)
    except (URLError, TimeoutError, KeyError, json.JSONDecodeError):
        return _fallback_explanation(mode, context, fallback)
