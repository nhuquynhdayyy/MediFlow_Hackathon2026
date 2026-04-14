"""
alerts.py — Alert Check + Patient Triage (Stateful)
- /check     : Phân tích cảnh báo quá tải (cho admin)
- /triage    : Chat với bệnh nhân, stateful session
"""

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel
from dotenv import load_dotenv

from app.api.utils import (
    build_alert_prompt,
    build_patient_triage_prompt,
    compute_department_sequence,
    get_current_load_by_specialty,
    DEPT_FLOOR_MAP,
)

load_dotenv()

router = APIRouter()


# ---------------------------------------------------------------------------
# SCHEMAS
# ---------------------------------------------------------------------------

class AlertRequest(BaseModel):
    load_by_specialty: List[Dict[str, Any]]
    forecast: List[Dict[str, Any]]
    admin_note: Optional[str] = None


class PatientTriageRequest(BaseModel):
    patient_record: str
    departments: Optional[List[Dict[str, Any]]] = None
    forecast: Optional[List[Dict[str, Any]]] = None
    visited_departments: Optional[List[str]] = None  # NEW: stateful
    patient_profile: Optional[Dict[str, Any]] = None  # NEW: elderly, wheelchair, priority
    admin_note: Optional[str] = None


# ---------------------------------------------------------------------------
# ALERT CHECK (Admin dashboard)
# ---------------------------------------------------------------------------

@router.post("/check")
def check_alerts(payload: AlertRequest):
    """
    Phân tích tình trạng tải + forecast → trả về cảnh báo và gợi ý hành động.
    Pre-analysis được thực hiện trước khi gọi LLM để tăng chất lượng output.
    """
    # Pre-compute alerts bằng rule engine (không phụ thuộc LLM)
    critical_depts = [d for d in payload.load_by_specialty if d.get("load_pct", 0) >= 90]
    warning_depts = [d for d in payload.load_by_specialty if 75 <= d.get("load_pct", 0) < 90]

    rule_based_result = _generate_rule_based_alert(
        payload.load_by_specialty,
        payload.forecast,
        critical_depts,
        warning_depts,
    )

    # Nếu không có FPT → trả rule-based (vẫn có giá trị hơn mock cũ)
    if not _fpt_configured():
        return {
            "status": "success",
            "data": {**rule_based_result, "source": "rule_engine"},
            "meta": {"note": "FPT AI chưa cấu hình. Kết quả từ Rule Engine."},
        }

    # Gọi LLM với prompt đã enriched
    prompt = build_alert_prompt(payload.load_by_specialty, payload.forecast)
    try:
        raw = call_fpt_ai(prompt)
        text = extract_text_from_response(raw)
        if not text:
            return {"status": "success", "data": {**rule_based_result, "source": "rule_engine_fallback"}}

        parsed = _parse_json_response(text)
        if parsed:
            return {
                "status": "success",
                "data": {
                    "alert": parsed.get("alert", rule_based_result["alert"]),
                    "recommendations": parsed.get("recommendations", rule_based_result["recommendations"]),
                    "critical_count": len(critical_depts),
                    "warning_count": len(warning_depts),
                    "source": "fpt_ai",
                },
            }
        # Fallback nếu parse lỗi
        return {
            "status": "success",
            "data": {"alert": text.strip(), "recommendations": [], "source": "fpt_text"},
        }

    except Exception as exc:
        return {
            "status": "success",  # Không để frontend crash
            "data": {**rule_based_result, "source": "rule_engine_fallback"},
            "meta": {"error": str(exc)},
        }


# ---------------------------------------------------------------------------
# PATIENT TRIAGE (Chat interface)
# ---------------------------------------------------------------------------

@router.post("/triage")
def triage_patient(payload: PatientTriageRequest):
    """
    Chat điều hướng bệnh nhân.

    Luồng xử lý:
    1. Lấy load realtime nếu departments không đủ thông tin
    2. Pre-compute route bằng optimizer (dependency-aware)
    3. Truyền route đã tính vào prompt → AI chỉ diễn đạt, không tự sort
    4. Parse response, fallback gracefully
    """
    departments = payload.departments or []
    visited = payload.visited_departments or []
    patient_profile = payload.patient_profile or {}

    # Nếu Frontend không truyền departments, ta thử parse từ tin nhắn mới nhất của bệnh nhân
    if not departments:
        from app.services.planner import extract_departments
        # Tách lấy các dòng của bệnh nhân
        patient_lines = [
            line.replace("[Bệnh nhân]:", "").strip() 
            for line in payload.patient_record.split('\n') 
            if line.startswith("[Bệnh nhân]:")
        ]
        # Lấy câu mới nhất của bệnh nhân
        latest_patient_msg = patient_lines[-1] if patient_lines else payload.patient_record
        extracted = extract_departments(latest_patient_msg)
        departments = [{"specialty": name} for name in extracted]

    # Enrich departments với realtime data nếu thiếu wait_time
    departments = _enrich_departments(departments)

    # Pre-compute route
    sequence_data = compute_department_sequence(
        departments,
        patient_elderly=patient_profile.get("elderly", False),
        patient_wheelchair=patient_profile.get("wheelchair", False),
    )

    # Fallback result (luôn có giá trị dù LLM fail)
    remaining_route = [d for d in sequence_data["route"] if d not in visited]
    fallback_result = {
        "patient_plan": _build_fallback_plan(remaining_route, sequence_data),
        "recommendations": _build_fallback_recommendations(sequence_data, visited),
        "route": sequence_data["route"],
        "remaining_route": remaining_route,
        "visited": visited,
        "details": sequence_data["sequence"],
        "bottleneck": sequence_data.get("bottleneck"),
        "total_estimated_minutes": sequence_data.get("total_estimated_minutes", 0),
        "source": "rule_engine",
    }

    if not _fpt_configured():
        return {
            "status": "success",
            "data": fallback_result,
            "meta": {"note": "FPT AI chưa cấu hình. Dùng Rule Engine."},
        }

    # Gọi LLM
    prompt = build_patient_triage_prompt(
        payload.patient_record,
        departments,
        payload.forecast or [],
        visited_departments=visited,
    )

    try:
        raw = call_fpt_ai(prompt)
        text = extract_text_from_response(raw)

        if not text:
            return {"status": "success", "data": fallback_result, "meta": {"note": "FPT AI trả rỗng."}}

        parsed = _parse_json_response(text)
        if parsed:
            ai_route = parsed.get("optimal_route", [])
            # Validate: AI không được đề xuất thứ tự vi phạm dependency
            # Nếu AI trả về route hợp lệ → dùng; nếu không → dùng optimizer
            valid_route = ai_route if ai_route else sequence_data["route"]
            ai_visited = parsed.get("visited", visited)
            ai_remaining = [d for d in valid_route if d not in ai_visited]

            return {
                "status": "success",
                "data": {
                    "patient_plan": parsed.get("chat_response", fallback_result["patient_plan"]),
                    "recommendations": parsed.get("recommendations", []),
                    "route": valid_route,
                    "remaining_route": ai_remaining,
                    "visited": ai_visited,
                    "details": sequence_data["sequence"],
                    "bottleneck": sequence_data.get("bottleneck"),
                    "total_estimated_minutes": sequence_data.get("total_estimated_minutes", 0),
                    "source": "fpt_ai",
                },
            }

        # Text thô từ AI (không parse được JSON)
        return {
            "status": "success",
            "data": {
                **fallback_result,
                "patient_plan": text.strip(),
                "source": "fpt_text",
            },
        }

    except Exception as exc:
        return {
            "status": "success",
            "data": fallback_result,
            "meta": {"error": str(exc)},
        }


# ---------------------------------------------------------------------------
# FPT AI CALLER
# ---------------------------------------------------------------------------

def call_fpt_ai(prompt: str, system_prompt: Optional[str] = None) -> Any:
    api_key = os.getenv("FPT_API_KEY")
    base_url = os.getenv("FPT_AI_URL", "https://mkp-api.fptcloud.com")
    model = os.getenv("FPT_AI_MODEL", "Llama-3.3-70B-Instruct")

    if not base_url.endswith("/chat/completions") and not base_url.endswith("/completions"):
        url = f"{base_url.rstrip('/')}/v1/chat/completions"
    else:
        url = base_url

    sys_content = system_prompt or (
        "Bạn là AI y tế. Trả về JSON hợp lệ, không markdown, không giải thích thêm. "
        "Chỉ xuất đúng JSON object được yêu cầu."
    )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": sys_content},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,  # Thấp hơn để output ổn định hơn
        "max_tokens": 2048,
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
        # OpenAI-compatible (FPT Llama format)
        choices = data.get("choices")
        if isinstance(choices, list) and choices:
            msg = choices[0].get("message", {})
            if isinstance(msg, dict):
                return msg.get("content", "")
            return choices[0].get("text", "")

        # Other formats
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


def _parse_json_response(text: str) -> Optional[Dict]:
    """Parse JSON từ LLM response, xử lý các edge cases."""
    clean = text.strip()

    # Remove markdown code fences
    if clean.startswith("```"):
        parts = clean.split("```")
        clean = parts[1] if len(parts) > 1 else clean
        if clean.startswith("json"):
            clean = clean[4:].strip()

    # Extract JSON object nếu có text thừa xung quanh
    match = re.search(r"\{.*\}", clean, re.DOTALL)
    if match:
        clean = match.group(0)

    try:
        return json.loads(clean)
    except (json.JSONDecodeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def _fpt_configured() -> bool:
    return bool(os.getenv("FPT_API_KEY") and os.getenv("FPT_AI_URL"))


def _enrich_departments(departments: List[Dict]) -> List[Dict]:
    """
    Thêm wait_time và floor vào departments nếu chưa có.
    Lấy từ realtime data.
    """
    if not departments:
        return departments

    # Kiểm tra xem có thiếu wait_time không
    needs_enrich = any("wait_time" not in d for d in departments)
    if not needs_enrich:
        return departments

    try:
        realtime = {d["specialty"]: d for d in get_current_load_by_specialty()}
    except Exception:
        return departments

    enriched = []
    for d in departments:
        dept_name = d.get("department") or d.get("specialty") or ""
        rt = realtime.get(dept_name, {})
        enriched.append({
            **d,
            "wait_time": d.get("wait_time") or rt.get("wait_time", 10),
            "floor": d.get("floor") or rt.get("floor") or DEPT_FLOOR_MAP.get(dept_name, 1),
            "load_pct": d.get("load_pct") or rt.get("load_pct", 0),
        })
    return enriched


def _generate_rule_based_alert(
    load_data: List[Dict],
    forecast_data: List[Dict],
    critical: List[Dict],
    warning: List[Dict],
) -> Dict:
    """Alert tự động bằng rule engine — không cần LLM."""
    if critical:
        names = ", ".join(d["specialty"] for d in critical[:3])
        alert = f"CẢNH BÁO ĐỎ: {names} đang quá tải ≥90%. Cần hành động ngay."
        recommendations = [
            f"Điều phối thêm nhân lực ngay cho: {critical[0]['specialty']}.",
            "Kích hoạt quy trình phân luồng khẩn cấp, chuyển bệnh nhân sang khoa ít tải hơn.",
        ]
    elif warning:
        names = ", ".join(d["specialty"] for d in warning[:3])
        alert = f"Cảnh báo vàng: {names} đang tiệm cận ngưỡng 85%."
        recommendations = [
            f"Tăng tốc xử lý tại {warning[0]['specialty']} trong 1-2 giờ tới.",
            "Thông báo để bệnh nhân mới phân bổ sang khoa ít tải hơn.",
        ]
    else:
        max_dept = max(load_data, key=lambda x: x.get("load_pct", 0), default=None)
        alert = "Hệ thống hoạt động bình thường. Tất cả khoa trong ngưỡng an toàn."
        recommendations = [
            f"Theo dõi {max_dept['specialty'] if max_dept else 'các khoa'} — hiện cao nhất.",
            "Duy trì phân bổ nhân lực theo ca.",
        ]

    return {
        "alert": alert,
        "recommendations": recommendations,
        "critical_count": len(critical),
        "warning_count": len(warning),
    }


def _build_fallback_plan(remaining_route: List[str], sequence_data: Dict) -> str:
    if not remaining_route:
        return "Bạn đã hoàn thành tất cả các khoa! Vui lòng đến quầy thanh toán."
    total_min = sequence_data.get("total_estimated_minutes", 0)
    route_str = " → ".join(remaining_route)
    return (
        f"Lộ trình tối ưu cho bạn: {route_str}.\n"
        f"Tổng thời gian ước tính: ~{total_min} phút.\n"
        f"Thứ tự này đã tính theo thời gian chờ thực tế và yêu cầu y tế."
    )


def _build_fallback_recommendations(sequence_data: Dict, visited: List[str]) -> List[str]:
    recs = []
    bottleneck = sequence_data.get("bottleneck")
    if bottleneck:
        recs.append(
            f"Điểm tắc nghẽn: {bottleneck['department']} "
            f"({bottleneck['load_pct']}%, chờ ~{bottleneck['wait_time']} phút). "
            f"Cân nhắc đến đây sớm."
        )
    recs.append("Khi khám xong mỗi khoa, báo lại để cập nhật lộ trình realtime.")
    if sequence_data.get("route"):
        last = sequence_data["route"][-1]
        if last not in visited:
            recs.append(f"Khám {last} sau cùng — đây là khoa cuối hành trình.")
    return recs