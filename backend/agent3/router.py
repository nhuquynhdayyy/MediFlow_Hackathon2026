from __future__ import annotations

import logging
import os

from fastapi import APIRouter, HTTPException, Query

from agent3.engine import (
    analyze_overload,
    call_fpt_ai,
    explain_overload,
    explain_route,
    extract_text_from_response,
    get_department_load,
    infer_department_from_order,
    map_orders_to_departments,
    optimize_route,
    predict_load,
)
from agent3.schemas import (
    ApiEnvelope,
    HospitalChatRequest,
    OptimizeRouteRequest,
    PatientChatRequest,
    PatientFlowStatusRequest,
    PatientProgressUpdateRequest,
    RoomUpsertRequest,
    StaffUpsertRequest,
    SuggestTimeRequest,
)
from agent3.static_data import DEPARTMENT_ALIASES, DEPARTMENT_META, TEST_DB
from agent3.store import (
    build_overview_snapshot,
    canonical_department_name,
    create_room,
    create_staff,
    delete_room,
    delete_staff,
    get_patient_orders,
    get_patient_state,
    list_hospital_map,
    list_patient_flows,
    list_staff,
    list_system_metrics,
    log_navigation_event,
    normalize_text,
    save_system_metric,
    sync_queue_status,
    update_patient_flow_status,
    update_patient_state,
    update_room,
    update_staff,
)

router = APIRouter()
logger = logging.getLogger(__name__)
STRICT_LIVE_AI = os.getenv("AGENT3_STRICT_LIVE_AI", "true").strip().lower() not in {"0", "false", "no"}


def envelope(message: str, data=None, status: str = "success") -> ApiEnvelope:
    return ApiEnvelope(status=status, message=message, data=data)


def vi_name(department: str) -> str:
    if department in DEPARTMENT_META:
        return DEPARTMENT_META[department]["vi"]
    if department in TEST_DB:
        return department
    return department


def _find_department_mentions(message: str, candidates: list[str]) -> list[str]:
    normalized_message = normalize_text(message)
    matches: list[str] = []

    for department in candidates:
        aliases = {normalize_text(department), normalize_text(vi_name(department))}
        aliases.update(alias for alias, target in DEPARTMENT_ALIASES.items() if target == department)
        if any(alias and alias in normalized_message for alias in aliases):
            matches.append(department)

    guessed = canonical_department_name(message)
    if guessed in candidates and guessed not in matches:
        matches.append(guessed)
    return matches


def _build_navigation_fallback(
    message: str,
    *,
    patient_state_data: dict,
    resolved_departments: list[str],
    all_departments: list[str],
    floor_map: dict[str, int | str],
    block_map: dict[str, str],
    room_map: dict[str, str],
) -> str:
    normalized_message = normalize_text(message)
    mentioned = _find_department_mentions(message, all_departments)
    target = mentioned[0] if mentioned else (resolved_departments[0] if len(resolved_departments) == 1 else "")

    if target:
        floor = floor_map.get(target, "?")
        block = block_map.get(target, "A1")
        room = room_map.get(target, "")
        room_text = f", phòng {room}" if room else ""
        department_name = vi_name(target)
        if any(keyword in normalized_message for keyword in ("tang may", "o dau", "khu nao", "phong nao", "duong di", "toi", "den")):
            return f"{department_name} ở tầng {floor}, khu {block}{room_text}. Bạn đi theo bảng chỉ dẫn lên đúng tầng rồi rẽ vào khu này là tới."

    if any(keyword in normalized_message for keyword in ("sau khi xet nghiem", "xet nghiem xong", "lam xet nghiem xong")):
        completed = set(patient_state_data.get("completed", []))
        next_step = next((item for item in resolved_departments if item not in completed and item not in {"Lab", "Imaging"}), None)
        if next_step:
            floor = floor_map.get(next_step, "?")
            block = block_map.get(next_step, "A1")
            return f"Sau khi xét nghiệm xong, bạn di chuyển đến {vi_name(next_step)} ở tầng {floor}, khu {block} để tiếp tục khám."
        return "Sau khi xét nghiệm xong, bạn thường quay lại khoa khám chính hoặc khu bác sĩ đã chỉ định để nộp kết quả và chờ bước tiếp theo."

    if len(resolved_departments) > 1 and any(keyword in normalized_message for keyword in ("di nhu the nao", "thu tu", "lo trinh", "toi dau truoc")):
        route = optimize_route(resolved_departments, get_department_load(0))
        route_text = " -> ".join(vi_name(item) for item in route.get("optimal_route", []))
        if route_text:
            return f"Thứ tự nên đi là: {route_text}. Lộ trình này có thời gian chờ ước tính khoảng {route.get('estimated_time', 0)} phút."

    if mentioned:
        readable = ", ".join(vi_name(item) for item in mentioned[:3])
        return f"Mình nhận ra khoa bạn hỏi là {readable}. Bạn hỏi thêm tầng, khu hoặc đường đi để mình chỉ chính xác hơn."

    return "AI tạm thời chưa phản hồi được. Bạn nói rõ tên khoa cần đến, ví dụ 'Khoa Tim mạch ở tầng mấy?', mình sẽ chỉ theo tầng và khu."


@router.get("/departments")
def get_departments():
    rows = get_department_load(hour_offset=0)
    names = [item["department"] for item in rows]
    return envelope("Danh sách khoa", names)


@router.get("/department-load")
def department_load():
    rows = get_department_load(hour_offset=0)
    sync_queue_status(rows)
    return envelope("Tải khoa theo thời gian thực", rows)


@router.get("/predict-load")
def predict_load_api():
    data = predict_load(lookahead_hours=3)
    data.update(explain_overload(data["overloaded_departments"], data["peak_hours"]))
    return envelope("Dự báo tải thành công", data)


@router.post("/optimize-route")
def optimize_route_api(payload: OptimizeRouteRequest):
    if not payload.departments:
        return envelope("Danh sách khoa cần khám đang rỗng.", None, status="error")
    mapped = map_orders_to_departments(payload.departments)
    load_rows = get_department_load(hour_offset=0)
    result = optimize_route(
        mapped,
        load_rows,
        include_prerequisites=payload.constraints.auto_include_prerequisites,
    )
    result["reasoning"] = explain_route(result["optimal_route"], result["estimated_time"], result["alternative_time"])
    result["patient_state"] = payload.patient_state.model_dump()
    orders = get_patient_orders(payload.patient_id)
    log_navigation_event(
        payload.patient_id,
        event_type="route_optimized",
        appointment_id=orders.get("appointment_id", ""),
        medical_record_id=orders.get("medical_record_id", ""),
        route=result["optimal_route"],
        state=payload.patient_state.model_dump(),
        payload={"requested_departments": payload.departments, "mapped_departments": mapped},
    )
    return envelope("Tối ưu lộ trình thành công.", result)


@router.post("/suggest-time")
def suggest_time_api(payload: SuggestTimeRequest):
    if not payload.departments:
        return envelope("Danh sách khoa cần khám đang rỗng.", None, status="error")
    mapped = map_orders_to_departments(payload.departments)
    options = []
    for hour_offset in range(0, payload.lookahead_hours + 1):
        load_rows = get_department_load(hour_offset=hour_offset)
        computed = optimize_route(
            mapped,
            load_rows,
            include_prerequisites=payload.constraints.auto_include_prerequisites,
        )
        options.append({"offset_hours": hour_offset, **computed})
    best = sorted(options, key=lambda item: item["estimated_time"])[0]
    return envelope(
        "Gợi ý thời điểm đi khám thành công.",
        {
            "recommended_offset_hours": best["offset_hours"],
            "estimated_time": best["estimated_time"],
            "optimal_route": best["optimal_route"],
            "alternatives": options,
        },
    )


@router.get("/now-vs-later")
def now_vs_later(departments: str = Query(...), compare_after_hours: int = Query(2, ge=1, le=6)):
    selected = [item.strip() for item in departments.split(",") if item.strip()]
    mapped = map_orders_to_departments(selected)
    now_result = optimize_route(mapped, get_department_load(0), include_prerequisites=False)
    later_result = optimize_route(mapped, get_department_load(compare_after_hours), include_prerequisites=False)
    recommendation = "di_sau" if later_result["estimated_time"] < now_result["estimated_time"] else "di_ngay"
    return envelope(
        "So sánh đi ngay và đi sau thành công.",
        {
            "recommendation": recommendation,
            "now": now_result,
            "later": {"offset_hours": compare_after_hours, **later_result},
            "reasoning": explain_route(now_result["optimal_route"], now_result["estimated_time"], later_result["estimated_time"]),
        },
    )


@router.get("/overload-analysis")
def overload_analysis():
    current = get_department_load(0)
    sync_queue_status(current)
    analysis = analyze_overload(current)
    prediction = predict_load(lookahead_hours=3)
    return envelope(
        "Phân tích quá tải bệnh viện thành công.",
        {
            **analysis,
            "peak_hours": prediction["peak_hours"],
            "forecast_overloaded_departments": prediction["overloaded_departments"],
        },
    )


@router.get("/patient/{patient_id}/orders")
def patient_orders(patient_id: str):
    return envelope("Lấy orders thành công", get_patient_orders(patient_id))


@router.get("/patient/{patient_id}/state")
def patient_state(patient_id: str):
    return envelope("Lấy trạng thái thành công", get_patient_state(patient_id))


@router.post("/patient/{patient_id}/progress")
def update_progress(patient_id: str, payload: PatientProgressUpdateRequest):
    orders = get_patient_orders(patient_id)
    updated = update_patient_state(
        patient_id,
        payload.completed_step,
        payload.current_step,
        appointment_id=orders.get("appointment_id", ""),
    )
    mapped_orders = map_orders_to_departments(orders["orders"])
    remaining = [item for item in mapped_orders if item not in updated["completed"]]
    reroute = optimize_route(remaining, get_department_load(0), include_prerequisites=False) if remaining else {}
    if reroute:
        log_navigation_event(
            patient_id,
            event_type="route_rerouted",
            appointment_id=orders.get("appointment_id", ""),
            medical_record_id=orders.get("medical_record_id", ""),
            route=reroute.get("optimal_route", []),
            state=updated,
            payload={"remaining_departments": remaining},
        )
    return envelope("Đã cập nhật tiến trình và điều hướng lại", {"patient_state": updated, "reroute": reroute})


@router.post("/patient/{patient_id}/chat")
def patient_chat(patient_id: str, payload: PatientChatRequest):
    patient_state_data = get_patient_state(patient_id)
    load_rows = get_department_load(0)
    floor_map = {item["department"]: item.get("floor", "?") for item in load_rows}
    block_map = {item["department"]: item.get("block", "A1 (Khac)") for item in load_rows}
    room_map = {item["department"]: item.get("room_code", "") for item in load_rows}
    all_departments = list(floor_map.keys())

    departments = payload.departments_context or get_patient_orders(patient_id)["orders"]
    resolved_departments: list[str] = []
    for item in departments:
        candidate = canonical_department_name(item) or infer_department_from_order(item)
        if candidate and candidate not in resolved_departments:
            resolved_departments.append(candidate)
    resolved_departments = [item for item in resolved_departments if item in all_departments]

    context_lines = []
    for department in resolved_departments:
        floor = floor_map.get(department, "?")
        block = block_map.get(department, "A1 (Khac)")
        context_lines.append(f"- {vi_name(department)} ({department}) | {block} | Tầng {floor}")

    full_catalog = [
        f"- {vi_name(item)} ({item}) | {block_map.get(item, 'A1 (Khác)')} | Tầng {floor_map.get(item, '?')}"
        for item in all_departments
    ]
    history_messages = []
    for item in payload.history[-8:]:
        role = "assistant" if item.role == "assistant" else "user"
        history_messages.append({"role": role, "content": item.text})

    system_prompt = (
        "Bạn là trợ lý điều hướng bệnh viện cho bệnh nhân. "
        "Trả lời bằng tiếng Việt có dấu, ngắn gọn, dễ hiểu, có chỉ dẫn từng bước cụ thể."
    )
    user_context = (
        f"Patient ID: {patient_id}\n"
        f"Trạng thái hiện tại: {patient_state_data}\n"
        "Danh sách khoa liên quan:\n"
        f"{chr(10).join(context_lines)}\n\n"
        "Danh mục khoa toàn viện:\n"
        f"{chr(10).join(full_catalog)}\n\n"
        f"Câu hỏi mới nhất: {payload.message}"
    )

    try:
        response = call_fpt_ai(
            [{"role": "system", "content": system_prompt}, *history_messages, {"role": "user", "content": user_context}],
            temperature=0.3,
            max_tokens=320,
        )
        text = extract_text_from_response(response).strip() or "Mình chưa có phản hồi phù hợp."
        source = "agent3_ai"
        diagnostics = None
    except Exception as exc:
        logger.exception("Agent3 patient chat AI call failed for patient_id=%s", patient_id)
        if STRICT_LIVE_AI:
            raise HTTPException(status_code=502, detail=f"Agent3 live AI call failed: {exc}") from exc
        text = _build_navigation_fallback(
            payload.message,
            patient_state_data=patient_state_data,
            resolved_departments=resolved_departments,
            all_departments=all_departments,
            floor_map=floor_map,
            block_map=block_map,
            room_map=room_map,
        )
        source = "agent3_fallback"
        diagnostics = {"ai_available": False, "reason": "FPT_AI_unavailable_or_misconfigured"}

    log_navigation_event(
        patient_id,
        event_type="patient_chat",
        appointment_id=get_patient_orders(patient_id).get("appointment_id", ""),
        state=patient_state_data,
        payload={"message": payload.message, "reply": text},
    )
    return envelope("Chat thành công", {"reply": text, "source": source, "diagnostics": diagnostics})


@router.post("/hospital/chat")
def hospital_chat(payload: HospitalChatRequest):
    current = get_department_load(0)
    prediction = predict_load(lookahead_hours=3)
    analysis = analyze_overload(current)
    top_load = sorted(current, key=lambda item: item.get("load_pct", 0), reverse=True)[:8]

    history_messages = []
    for item in payload.history[-10:]:
        history_messages.append({"role": "assistant" if item.role == "assistant" else "user", "content": item.text})

    top_lines = [
        f"- {vi_name(row['department'])}: {row['load_pct']}% | chờ {row['wait_time']}p | BS {row['doctors']}"
        for row in top_load
    ]
    trend_lines = [f"- {slot['hour']}: {slot['average_load']}%" for slot in prediction.get("timeline", [])[:4]]
    system_prompt = (
        "Bạn là AI AGENT cho bệnh viện. "
        "Trả lời tiếng Việt có dấu, 4-6 dòng, ưu tiên hành động cụ thể theo khoa."
    )
    user_context = (
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
            [{"role": "system", "content": system_prompt}, *history_messages, {"role": "user", "content": user_context}],
            temperature=0.25,
            max_tokens=260,
        )
        text = extract_text_from_response(response).strip()
        if not text:
            raise RuntimeError("empty response")
    except Exception as exc:
        logger.exception("Agent3 hospital chat AI call failed")
        if STRICT_LIVE_AI:
            raise HTTPException(status_code=502, detail=f"Agent3 live AI call failed: {exc}") from exc
        text = (
            "Hệ thống đang ở chế độ dự phòng. Gợi ý: bổ sung nhân lực cho khoa tải cao nhất, "
            "ưu tiên ca sáng ở giờ cao điểm và chuyển ca nhẹ sang khoa tải thấp."
        )

    return envelope(
        "Hospital chat thành công",
        {
            "reply": text,
            "source": "agent3",
            "snapshot": {
                "peak_hours": prediction.get("peak_hours", []),
                "overloaded_departments": analysis.get("overloaded_departments", []),
            },
        },
    )


@router.get("/hospital/dashboard")
def hospital_dashboard():
    load_rows = get_department_load(0)
    sync_queue_status(load_rows)
    prediction = predict_load(lookahead_hours=3)
    overload = analyze_overload(load_rows)
    overview = build_overview_snapshot(load_rows)
    metric = save_system_metric(
        {
            **overview,
            "peak_hours": prediction.get("peak_hours", []),
            "forecast_overloaded_departments": prediction.get("overloaded_departments", []),
        }
    )
    patient_flows = list_patient_flows()[:20]
    return envelope(
        "Dashboard dữ liệu Agent 3",
        {
            "overview": overview,
            "prediction": prediction,
            "overload": overload,
            "patient_flows": patient_flows,
            "latest_metric": metric,
        },
    )


@router.get("/hospital/patient-flows")
def hospital_patient_flows():
    load_rows = get_department_load(0)
    flows = []
    for item in list_patient_flows()[:40]:
        orders = get_patient_orders(item["patient_id"])
        mapped = map_orders_to_departments(orders["orders"])
        recommended = optimize_route(mapped, load_rows, include_prerequisites=False) if mapped else {}
        completed = set(item.get("completed", []))
        next_step = next((step for step in recommended.get("optimal_route", []) if step not in completed), None)
        flows.append(
            {
                **item,
                "recommended_route": recommended.get("optimal_route", []),
                "estimated_time": recommended.get("estimated_time"),
                "next_step": next_step,
            }
        )
    return envelope("Danh sách điều phối bệnh nhân", flows)


@router.post("/hospital/patient-flows/{appointment_id}/status")
def hospital_patient_flow_status(appointment_id: str, payload: PatientFlowStatusRequest):
    try:
        data = update_patient_flow_status(
            appointment_id,
            status=payload.status,
            current_step=payload.current_step,
            note=payload.note,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return envelope("Đã cập nhật trạng thái bệnh nhân", data)


@router.get("/hospital/staff")
def hospital_staff():
    return envelope("Danh sách nhân sự", list_staff())


@router.post("/hospital/staff")
def hospital_staff_create(payload: StaffUpsertRequest):
    return envelope("Đã tạo nhân sự", create_staff(payload.model_dump()))


@router.put("/hospital/staff/{staff_id}")
def hospital_staff_update(staff_id: str, payload: StaffUpsertRequest):
    return envelope("Đã cập nhật nhân sự", update_staff(staff_id, payload.model_dump()))


@router.delete("/hospital/staff/{staff_id}")
def hospital_staff_delete(staff_id: str):
    delete_staff(staff_id)
    return envelope("Đã xóa nhân sự", {"id": staff_id})


@router.get("/hospital/rooms")
def hospital_rooms():
    return envelope("Danh sách phòng khám", list_hospital_map())


@router.post("/hospital/rooms")
def hospital_room_create(payload: RoomUpsertRequest):
    return envelope("Đã tạo phòng", create_room(payload.model_dump()))


@router.put("/hospital/rooms/{room_id}")
def hospital_room_update(room_id: str, payload: RoomUpsertRequest):
    return envelope("Đã cập nhật phòng", update_room(room_id, payload.model_dump()))


@router.delete("/hospital/rooms/{room_id}")
def hospital_room_delete(room_id: str):
    delete_room(room_id)
    return envelope("Đã xóa phòng", {"id": room_id})


@router.get("/hospital/system-metrics")
def hospital_system_metrics(limit: int = Query(20, ge=1, le=100)):
    return envelope("Danh sách system metrics", list_system_metrics(limit))


@router.get("/hospital/map")
def hospital_map():
    return envelope("Hospital map", list_hospital_map())
