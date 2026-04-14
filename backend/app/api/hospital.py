"""
hospital.py — Hospital Operations AI
- /chat: trả lời câu hỏi điều phối bác sĩ/phòng khám
- Sử dụng FPT AI nếu cấu hình, fallback bằng rule engine nếu cần
"""

import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.utils import (
    build_hospital_operations_prompt,
    get_current_load_by_specialty,
    get_forecast_summary,
)
from app.services.fpt_ai import call_fpt_ai, extract_text_from_response, parse_json_response

router = APIRouter()


class HospitalOperationsRequest(BaseModel):
    message: str
    load_by_specialty: Optional[List[Dict[str, Any]]] = None
    forecast: Optional[List[Dict[str, Any]]] = None
    admin_note: Optional[str] = None


@router.post("/chat")
def hospital_chat(payload: HospitalOperationsRequest):
    load_data = payload.load_by_specialty or get_current_load_by_specialty()
    forecast = payload.forecast or get_forecast_summary().get("forecast", [])

    # Pre-analyze load state for fallback messaging
    critical = [d for d in load_data if d.get("load_pct", 0) >= 90]
    warning = [d for d in load_data if 75 <= d.get("load_pct", 0) < 90]

    if not _fpt_configured():
        return {
            "status": "success",
            "data": {
                "assistant_message": _build_operation_fallback(critical, warning),
                "recommendations": _build_operation_recommendations(critical, warning),
                "critical_count": len(critical),
                "warning_count": len(warning),
                "source": "rule_engine",
            },
            "meta": {"note": "FPT AI chưa cấu hình. Dùng Rule Engine."},
        }

    prompt = build_hospital_operations_prompt(
        payload.message,
        load_data,
        forecast,
        payload.admin_note,
    )

    try:
        response = call_fpt_ai([
            {"role": "system", "content": "Bạn là Hospital Operations AI."
            },
            {"role": "user", "content": prompt},
        ], temperature=0.3, max_tokens=900)
        text = extract_text_from_response(response)
        parsed = parse_json_response(text)

        if parsed:
            return {
                "status": "success",
                "data": {
                    "assistant_message": parsed.get("assistant_message", text.strip()),
                    "recommendations": parsed.get("recommendations", []),
                    "action_items": parsed.get("action_items", []),
                    "summary": parsed.get("summary", ""),
                    "critical_count": len(critical),
                    "warning_count": len(warning),
                    "source": "fpt_ai",
                },
            }

        return {
            "status": "success",
            "data": {
                "assistant_message": text.strip(),
                "recommendations": [],
                "action_items": [],
                "summary": "",
                "critical_count": len(critical),
                "warning_count": len(warning),
                "source": "fpt_text",
            },
        }
    except Exception as exc:
        return {
            "status": "success",
            "data": {
                "assistant_message": _build_operation_fallback(critical, warning),
                "recommendations": _build_operation_recommendations(critical, warning),
                "action_items": [],
                "summary": "",
                "critical_count": len(critical),
                "warning_count": len(warning),
                "source": "rule_engine_fallback",
            },
            "meta": {"error": str(exc)},
        }


def _fpt_configured() -> bool:
    return bool(os.getenv("FPT_API_KEY") and os.getenv("FPT_AI_URL"))


def _build_operation_fallback(critical: List[Dict[str, Any]], warning: List[Dict[str, Any]]) -> str:
    if critical:
        items = ", ".join(d["specialty"] for d in critical[:3])
        return (
            f"Cảnh báo hiện tại có {len(critical)} khoa quá tải. Ưu tiên điều phối nhân lực cho: {items}. "
            "Hạn chế tiếp nhận bệnh nhân mới nếu cần."
        )
    if warning:
        items = ", ".join(d["specialty"] for d in warning[:3])
        return (
            f"Có {len(warning)} khoa tiệm cận tải cao. Thực hiện giám sát sát sao và cân nhắc chuyển bớt lịch khám. "
            "Ưu tiên mở thêm ca khám tại các khoa ít tải."
        )
    return "Tình hình vận hành hiện ổn định. Duy trì lịch trình và theo dõi tiếp diễn."


def _build_operation_recommendations(critical: List[Dict[str, Any]], warning: List[Dict[str, Any]]) -> List[str]:
    recs = []
    if critical:
        recs.append("Kích hoạt kế hoạch điều phối khẩn cấp cho các khoa quá tải.")
        recs.append("Chuyển bệnh nhân nhẹ sang khoa ít tải hơn hoặc hẹn lịch lại.")
    elif warning:
        recs.append("Tăng tốc xử lý tại các khoa cảnh báo trong 1-2 giờ tới.")
        recs.append("Thống kê lại nguồn lực bác sĩ và phòng khám để phân bổ hợp lý.")
    else:
        recs.append("Duy trì phân bổ hiện tại và theo dõi các chỉ số realtime.")
    return recs
