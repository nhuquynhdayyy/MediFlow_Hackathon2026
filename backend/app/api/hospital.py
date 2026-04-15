from __future__ import annotations

from fastapi import APIRouter, Query

from app.models.requests import HospitalChatRequest
from app.models.responses import StandardResponse
from app.services.fpt_ai import call_fpt_ai, extract_text_from_response
from app.services.ai_explainer import explain_route
from app.services.load_predictor import get_department_load, predict_load
from app.services.overload_detector import analyze_overload
from app.services.route_optimizer import map_orders_to_departments, optimize_route

router = APIRouter()


@router.get("/now-vs-later", response_model=StandardResponse[dict])
def now_vs_later(departments: str = Query(...), compare_after_hours: int = Query(2, ge=1, le=6)):
    selected = [x.strip() for x in departments.split(",") if x.strip()]
    mapped = map_orders_to_departments(selected)
    now_result = optimize_route(mapped, get_department_load(0))
    later_result = optimize_route(mapped, get_department_load(compare_after_hours))
    recommended = "đi_sau" if later_result["estimated_time"] < now_result["estimated_time"] else "đi_ngay"
    return StandardResponse(
        status="success",
        message="So sánh đi ngay và đi sau thành công.",
        data={
            "recommendation": recommended,
            "now": now_result,
            "later": {"offset_hours": compare_after_hours, **later_result},
            "reasoning": explain_route(
                now_result["optimal_route"],
                now_result["estimated_time"],
                later_result["estimated_time"],
            ),
        },
    )


@router.get("/overload-analysis", response_model=StandardResponse[dict])
def overload_analysis():
    current = get_department_load(0)
    analysis = analyze_overload(current)
    prediction = predict_load(lookahead_hours=3)
    return StandardResponse(
        status="success",
        message="Phân tích quá tải bệnh viện thành công.",
        data={
            **analysis,
            "peak_hours": prediction["peak_hours"],
            "forecast_overloaded_departments": prediction["overloaded_departments"],
        },
    )


@router.post("/hospital/chat", response_model=StandardResponse[dict])
def hospital_ops_chat(payload: HospitalChatRequest):
    current = get_department_load(0)
    prediction = predict_load(lookahead_hours=3)
    analysis = analyze_overload(current)

    history_msgs = []
    for msg in payload.history[-10:]:
        role = "assistant" if msg.role == "assistant" else "user"
        history_msgs.append({"role": role, "content": msg.text})

    top_load = sorted(current, key=lambda x: x.get("load_pct", 0), reverse=True)[:8]
    top_lines = [
        f"- {row['department']}: {row['load_pct']}% | chờ {row['wait_time']}p | BS {row['doctors']}"
        for row in top_load
    ]
    trend = prediction.get("timeline", [])
    trend_lines = [f"- {slot['hour']}: {slot['average_load']}%" for slot in trend[:4]]

    system_prompt = (
        "Bạn là Operations Copilot cho bệnh viện, hỗ trợ điều dưỡng, y tá, bác sĩ và quản lý vận hành.\n"
        "Nhiệm vụ: phân tích lưu lượng hiện tại, dự báo tăng/giảm, và đề xuất điều phối nhân sự cụ thể.\n"
        "Trả lời ngắn gọn 4-7 dòng, ưu tiên hành động thực tế theo khoa."
    )
    context = (
        "Dữ liệu realtime top khoa:\n"
        + "\n".join(top_lines)
        + "\n\nDự báo tải 3 giờ tới:\n"
        + "\n".join(trend_lines)
        + f"\n\nKhoa quá tải: {', '.join(analysis.get('overloaded_departments', [])) or 'Không có'}"
        + f"\nGiờ cao điểm: {', '.join(prediction.get('peak_hours', [])) or 'Chưa rõ'}"
        + f"\n\nCâu hỏi: {payload.message}"
    )

    try:
        response = call_fpt_ai(
            [{"role": "system", "content": system_prompt}, *history_msgs, {"role": "user", "content": context}],
            temperature=0.25,
            max_tokens=420,
        )
        text = extract_text_from_response(response).strip()
        if not text:
            text = "Mình chưa nhận được phản hồi AI, bạn thử hỏi lại với câu ngắn hơn."
        return StandardResponse(
            status="success",
            message="Hospital chat thành công",
            data={
                "reply": text,
                "source": "fpt_ai",
                "snapshot": {
                    "peak_hours": prediction.get("peak_hours", []),
                    "overloaded_departments": analysis.get("overloaded_departments", []),
                },
            },
        )
    except Exception:
        fallback = (
            "Hiện hệ thống ở chế độ dự phòng. Gợi ý: ưu tiên điều phối nhân sự cho khoa có tải cao nhất,"
            " tăng bác sĩ theo ca tại giờ cao điểm và chuyển ca nhẹ sang khoa tải thấp."
        )
        return StandardResponse(
            status="success",
            message="Hospital chat fallback",
            data={"reply": fallback, "source": "fallback"},
        )
