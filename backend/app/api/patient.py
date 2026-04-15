from __future__ import annotations

from fastapi import APIRouter

from app.models.requests import PatientChatRequest, PatientProgressUpdateRequest
from app.models.responses import StandardResponse
from app.services.fpt_ai import call_fpt_ai, extract_text_from_response
from app.services.load_predictor import get_department_load
from app.services.mock_data_store import get_emr_orders, get_patient_state, update_patient_state
from app.services.route_optimizer import map_orders_to_departments, optimize_route

router = APIRouter()

DEPT_VI_NAME = {
    "Registration": "Tiếp nhận",
    "Lab": "Xét nghiệm",
    "Imaging": "Chẩn đoán hình ảnh",
    "Pharmacy": "Quầy thuốc",
    "Internal": "Nội tổng quát",
    "Cardiology": "Tim mạch",
    "Neurology": "Thần kinh",
    "Gastroenterology": "Tiêu hóa",
    "Pulmonology": "Hô hấp",
    "Endocrinology": "Nội tiết",
    "Nephrology": "Thận",
    "Oncology": "Ung bướu",
    "Orthopedics": "Chấn thương chỉnh hình",
    "Rehabilitation": "Phục hồi chức năng",
    "ENT": "Tai Mũi Họng",
    "Pediatrics": "Nhi",
    "OBGYN": "Sản phụ khoa",
    "Dermatology": "Da liễu",
}

DEPT_ALIASES = {
    "nhi": "Pediatrics",
    "khoa nhi": "Pediatrics",
    "sản": "OBGYN",
    "khoa sản": "OBGYN",
    "sản phụ khoa": "OBGYN",
    "tai mũi họng": "ENT",
    "xét nghiệm": "Lab",
    "chẩn đoán hình ảnh": "Imaging",
    "nội": "Internal",
    "nội tổng quát": "Internal",
    "tim mạch": "Cardiology",
    "thần kinh": "Neurology",
    "tiêu hóa": "Gastroenterology",
    "hô hấp": "Pulmonology",
    "nội tiết": "Endocrinology",
    "thận": "Nephrology",
    "ung bướu": "Oncology",
    "chấn thương": "Orthopedics",
    "phục hồi chức năng": "Rehabilitation",
    "da liễu": "Dermatology",
    "quầy thuốc": "Pharmacy",
    "tiếp nhận": "Registration",
}


@router.get("/patient/{patient_id}/orders", response_model=StandardResponse[dict])
def get_patient_orders(patient_id: str):
    orders = get_emr_orders(patient_id)
    return StandardResponse(status="success", message="Lấy orders thành công", data=orders)


@router.get("/patient/{patient_id}/state", response_model=StandardResponse[dict])
def get_patient_state_api(patient_id: str):
    return StandardResponse(status="success", message="Lấy trạng thái thành công", data=get_patient_state(patient_id))


@router.post("/patient/{patient_id}/progress", response_model=StandardResponse[dict])
def update_progress(patient_id: str, payload: PatientProgressUpdateRequest):
    updated = update_patient_state(patient_id, payload.completed_step, payload.current_step)
    orders = get_emr_orders(patient_id)
    mapped = map_orders_to_departments(orders["orders"])
    remaining = [d for d in mapped if d not in updated["completed"]]
    reroute = optimize_route(remaining, get_department_load(0)) if remaining else {}
    return StandardResponse(
        status="success",
        message="Đã cập nhật progress và reroute",
        data={"patient_state": updated, "reroute": reroute},
    )


@router.post("/patient/{patient_id}/chat", response_model=StandardResponse[dict])
def patient_chat(patient_id: str, payload: PatientChatRequest):
    patient_state = get_patient_state(patient_id)
    load_rows = get_department_load(0)
    floor_map = {d["department"]: d.get("floor", "?") for d in load_rows}
    all_departments = list(floor_map.keys())

    departments = payload.departments_context or map_orders_to_departments(get_emr_orders(patient_id)["orders"])
    normalized_text = payload.message.lower()
    for alias, canonical in DEPT_ALIASES.items():
        if alias in normalized_text and canonical not in departments:
            departments.append(canonical)
    departments = [d for d in departments if d in all_departments]

    context_lines = []
    for dep in departments:
        floor = floor_map.get(dep, "?")
        context_lines.append(f"- {DEPT_VI_NAME.get(dep, dep)} ({dep}): tầng {floor}")

    full_catalog = []
    for dep in all_departments:
        floor = floor_map.get(dep, "?")
        full_catalog.append(f"- {DEPT_VI_NAME.get(dep, dep)} ({dep}): tầng {floor}")

    history_msgs = []
    for msg in payload.history[-8:]:
        role = "assistant" if msg.role == "assistant" else "user"
        history_msgs.append({"role": role, "content": msg.text})

    system_prompt = (
        "Bạn là trợ lý điều hướng bệnh viện cho bệnh nhân, trả lời tiếng Việt tự nhiên như ChatGPT.\n"
        "Mục tiêu: chỉ đường theo khoa/phòng/tầng, ngắn gọn, dễ hiểu, có bước đi cụ thể.\n"
        "QUAN TRỌNG:\n"
        "- Luôn ưu tiên dùng danh sách khoa có sẵn trong context, kể cả khi người dùng dùng alias tiếng Việt.\n"
        "- Nếu người dùng hỏi đi từ khoa A sang khoa B, trả lời thành các bước ngắn kiểu: đi thẳng -> rẽ trái/phải -> tới tầng.\n"
        "- Nếu khoa không có trong danh mục, mới hỏi lại 1 câu ngắn."
    )
    user_context = (
        f"Patient ID: {patient_id}\n"
        f"Trạng thái hiện tại: {patient_state}\n"
        "Danh sách khoa liên quan hiện có:\n"
        f"{chr(10).join(context_lines)}\n\n"
        "Danh mục khoa toàn viện:\n"
        f"{chr(10).join(full_catalog)}\n\n"
        f"Câu hỏi mới nhất: {payload.message}"
    )

    try:
        response = call_fpt_ai(
            [{"role": "system", "content": system_prompt}, *history_msgs, {"role": "user", "content": user_context}],
            temperature=0.3,
            max_tokens=380,
        )
        text = extract_text_from_response(response).strip()
        if not text:
            text = "Mình chưa nhận được phản hồi từ AI, bạn thử hỏi lại ngắn gọn giúp mình nhé."
        return StandardResponse(
            status="success",
            message="Chat thành công",
            data={"reply": text, "source": "fpt_ai"},
        )
    except Exception:
        fallback = (
            "Mình đang ở chế độ dự phòng. Bạn cho mình biết rõ tên khoa cần đến, "
            "mình sẽ chỉ đường theo tầng và khu."
        )
        return StandardResponse(
            status="success",
            message="Chat fallback",
            data={"reply": fallback, "source": "fallback"},
        )
