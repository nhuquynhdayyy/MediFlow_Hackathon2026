"""
Isolated Agent 2 router mounted under /api/doctor to preserve the original doctor app.
"""

from __future__ import annotations

import json
import os
import time
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models import (
    ChatRequest,
    DrugSuggestRequest,
    EMRData,
    LabRequest,
    PrescriptionRequest,
    SaveEMRRequest,
    VoiceTranscriptRequest,
)
from services.agent2_emr import Agent2EMRService
from services.agent2_fpt import Agent2FPTAIService

try:
    from database_firebase import save_ai_recommendation  # type: ignore
except Exception:
    save_ai_recommendation = None

load_dotenv()

router = APIRouter(prefix="/api/doctor", tags=["agent2-doctor"])

FPT_API_KEY = os.getenv("FPT_API_KEY", "")
DEFAULT_MODEL = os.getenv("FPT_DEFAULT_MODEL", "Llama-3.3-70B-Instruct")

emr_service = Agent2EMRService()


def get_svc(model: str | None = None) -> Agent2FPTAIService:
    if not FPT_API_KEY:
        raise HTTPException(status_code=500, detail="FPT_API_KEY chưa được cấu hình trong file .env")
    return Agent2FPTAIService(FPT_API_KEY, model or DEFAULT_MODEL)


def _clean_json_text(text: str) -> str:
    if not text:
        return ""
    return text.strip().replace("```json", "").replace("```", "").strip()


def _safe_json_loads(text: str):
    cleaned = _clean_json_text(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start_obj = cleaned.find("{")
        start_arr = cleaned.find("[")
        if start_obj == -1 and start_arr == -1:
            raise
        start = start_obj if start_arr == -1 else (start_arr if start_obj == -1 else min(start_obj, start_arr))
        end_obj = cleaned.rfind("}")
        end_arr = cleaned.rfind("]")
        end = max(end_obj, end_arr)
        if start >= 0 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


def _safe_save_ai_recommendation(
    recommendation_type: str,
    *,
    request_payload: dict,
    response_payload,
    patient_id: str = "",
    appointment_id: str = "",
    medical_record_id: str = "",
    doctor_id: str = "",
):
    if save_ai_recommendation is None:
        return
    try:
        save_ai_recommendation(
            agent_name="agent2_doctor",
            recommendation_type=recommendation_type,
            request_payload=request_payload,
            response_payload=response_payload,
            patient_id=patient_id,
            appointment_id=appointment_id,
            medical_record_id=medical_record_id,
            doctor_id=doctor_id,
        )
    except Exception:
        return


@router.post("/chat")
async def chat(req: ChatRequest):
    svc = get_svc(req.model)
    result = await svc.chat(req.system_prompt, req.user_message, req.history)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API không phản hồi")
    return {"reply": result}


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    svc = get_svc(req.model)

    async def event_generator() -> AsyncGenerator[str, None]:
        async for chunk in svc.chat_stream(req.system_prompt, req.user_message, req.history):
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/ai/diagnosis")
async def ai_diagnosis(req: EMRData):
    svc = get_svc(req.model)
    system = """Bạn là bác sĩ AI chuyên khoa nội tổng quát tại Việt Nam.
Phân tích triệu chứng và đưa ra chẩn đoán theo phác đồ Bộ Y tế Việt Nam.
Trả lời JSON (chỉ JSON, không text khác):
{
  "primary_diagnosis": "chẩn đoán sơ bộ chính",
  "differential": ["chẩn đoán phân biệt 1", "chẩn đoán phân biệt 2"],
  "urgency": "cấp cứu|khẩn|bình thường",
  "reasoning": "lý giải ngắn gọn",
  "next_steps": ["bước 1", "bước 2"]
}"""

    user = f"""Phân tích bệnh nhân:
- Tên: {req.patient_name}, {req.patient_info}
- Lý do khám: {req.chief_complaint}
- Tiền sử: {req.history}
- Triệu chứng: {req.symptoms}
- Chẩn đoán hiện tại: {req.current_diagnosis or 'Chưa có'}"""

    result = await svc.chat(system, user)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API lỗi")
    try:
        data = _safe_json_loads(result)
        response = {"success": True, "data": data}
    except json.JSONDecodeError:
        response = {
            "success": True,
            "data": {
                "primary_diagnosis": result,
                "differential": [],
                "urgency": "bình thường",
                "reasoning": result,
                "next_steps": [],
            },
        }
    _safe_save_ai_recommendation(
        "diagnosis",
        request_payload=req.model_dump(),
        response_payload=response["data"],
        patient_id=req.patient_id,
        appointment_id=req.appointment_id,
        doctor_id=req.doctor_id,
    )
    return response


@router.post("/ai/treatment")
async def ai_treatment(req: EMRData):
    svc = get_svc(req.model)
    system = """Bạn là bác sĩ AI chuyên khoa nội tại Việt Nam.
Đề xuất phác đồ điều trị theo hướng dẫn Bộ Y tế Việt Nam.
Trả lời JSON (chỉ JSON):
{
  "medications": [{"name":"","dose":"","frequency":"","duration":"","note":""}],
  "non_pharmacological": [],
  "monitoring": [],
  "follow_up": "",
  "lifestyle": [],
  "warnings": []
}"""

    user = f"""Đề xuất điều trị:
- Bệnh nhân: {req.patient_name}, {req.patient_info}
- Lý do: {req.chief_complaint}
- Triệu chứng: {req.symptoms}
- Tiền sử: {req.history}
- Chẩn đoán: {req.current_diagnosis or 'Chưa xác định'}"""

    result = await svc.chat(system, user)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API lỗi")
    try:
        data = _safe_json_loads(result)
        response = {"success": True, "data": data}
    except json.JSONDecodeError:
        response = {
            "success": True,
            "data": {
                "medications": [],
                "non_pharmacological": [result],
                "monitoring": [],
                "follow_up": "",
                "lifestyle": [],
                "warnings": [],
            },
        }
    _safe_save_ai_recommendation(
        "treatment",
        request_payload=req.model_dump(),
        response_payload=response["data"],
        patient_id=req.patient_id,
        appointment_id=req.appointment_id,
        doctor_id=req.doctor_id,
    )
    return response


@router.post("/ai/prescription")
async def ai_prescription(req: PrescriptionRequest):
    svc = get_svc(req.model)
    system = """Bạn là dược sĩ lâm sàng AI tại Việt Nam.
Mục tiêu: tạo đơn thuốc hợp lý, chính xác theo hướng dẫn Bộ Y tế Việt Nam và thực hành an toàn thuốc.

Quy tắc bắt buộc:
- Nếu có "treatment_plan", phải ưu tiên và bám sát các thuốc trong đó; chỉ thêm thuốc hỗ trợ khi thật cần, nêu rõ lý do.
- Không đề xuất thuốc mâu thuẫn với chẩn đoán hoặc thiếu chỉ định rõ ràng.
- Kiểm tra dị ứng, thuốc đang dùng, nguy cơ tương tác và chống chỉ định thường gặp; nếu thiếu dữ liệu quan trọng thì đưa vào "warnings".
- Liều lượng phải thực tế theo người lớn (trừ khi có thông tin trẻ em), ghi đường dùng, tần suất, số ngày; tránh đề xuất liều nguy hiểm.

Trả lời JSON (chỉ JSON):
{
  "prescriptions": [{"drug":"","generic":"","dose":"","route":"","frequency":"","days":30,"quantity":"","instructions":""}],
  "interactions": [],
  "contraindications": [],
  "warnings": [],
  "rationale": "",
  "total_cost_estimate": ""
}"""

    user = f"""Tạo đơn thuốc:
- Chẩn đoán: {req.diagnosis}
- Lý do khám: {req.chief_complaint or 'Không rõ'}
- Triệu chứng: {req.symptoms or 'Không rõ'}
- Kế hoạch điều trị (nếu có): {req.treatment_plan or 'Không có'}
- Thuốc đang dùng: {', '.join(req.current_medications) if req.current_medications else 'Không có'}
- Dị ứng: {req.allergies or 'Không có'}
- Tiền sử: {req.history}
- Bệnh nhân: {req.patient_info}"""

    result = await svc.chat(system, user)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API lỗi")
    try:
        data = _safe_json_loads(result)
        response = {"success": True, "data": data}
    except json.JSONDecodeError:
        response = {
            "success": True,
            "data": {
                "prescriptions": [],
                "interactions": [],
                "contraindications": [],
                "warnings": [],
                "rationale": "",
                "total_cost_estimate": "N/A",
                "raw": result,
            },
        }
    _safe_save_ai_recommendation(
        "prescription",
        request_payload=req.model_dump(),
        response_payload=response["data"],
        patient_id=req.patient_id,
        appointment_id=req.appointment_id,
        doctor_id=req.doctor_id,
    )
    return response


@router.post("/ai/lab-suggestions")
async def ai_lab(req: LabRequest):
    svc = get_svc(req.model)
    system = """Bạn là bác sĩ AI chuyên chẩn đoán tại Việt Nam. Gợi ý xét nghiệm theo mức độ ưu tiên.
Nguyên tắc:
- Ưu tiên xét nghiệm giúp loại trừ chẩn đoán nguy hiểm và xác nhận chẩn đoán chính.
- Tránh gợi ý xét nghiệm trùng lặp/không liên quan; nếu thiếu dữ kiện (tuổi, thai kỳ, bệnh nền...) hãy ghi vào reason ngắn gọn.
Trả lời JSON (chỉ JSON):
{
  "urgent":   [{"test":"","reason":"","expected_result":""}],
  "routine":  [{"test":"","reason":""}],
  "optional": [{"test":"","reason":""}],
  "imaging":  [{"test":"","reason":""}]
}"""

    user = f"""Gợi ý xét nghiệm:
- Triệu chứng: {req.symptoms}
- Chẩn đoán: {req.diagnosis}
- Tiền sử: {req.history}
- XN đã có: {', '.join(req.existing_labs) if req.existing_labs else 'Chưa có'}"""

    result = await svc.chat(system, user)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API lỗi")
    try:
        data = _safe_json_loads(result)
        response = {"success": True, "data": data}
    except json.JSONDecodeError:
        response = {"success": True, "data": {"urgent": [], "routine": [], "optional": [], "imaging": [], "raw": result}}
    _safe_save_ai_recommendation(
        "lab_suggestions",
        request_payload=req.model_dump(),
        response_payload=response["data"],
        patient_id=req.patient_id,
        appointment_id=req.appointment_id,
        doctor_id=req.doctor_id,
    )
    return response


@router.post("/ai/drug-suggestions")
async def ai_drug_suggestions(req: DrugSuggestRequest):
    svc = get_svc(req.model)
    system = """Bạn là bác sĩ/dược sĩ lâm sàng AI tại Việt Nam.
Nhiệm vụ: gợi ý danh sách thuốc khả dĩ (không phải đơn hoàn chỉnh) dựa trên chẩn đoán/triệu chứng/kế hoạch điều trị.

Yêu cầu:
- Ưu tiên thuốc phù hợp hướng dẫn điều trị (Bộ Y tế VN); tránh gợi ý sai chỉ định.
- Nếu thiếu dữ kiện quan trọng (tuổi, thai kỳ, chức năng thận/gan...) hãy thêm vào warnings.
- Mỗi gợi ý phải có reason ngắn gọn (vì sao dùng).
- Không bịa tên thuốc không tồn tại; ưu tiên generic phổ biến ở VN.

Trả lời JSON (chỉ JSON):
{
  "suggestions": [
    {
      "name": "Tên thuốc",
      "class": "nhóm thuốc",
      "reason": "vì sao phù hợp",
      "priority": "first-line|adjunct|symptomatic|avoid",
      "cautions": ["..."]
    }
  ],
  "warnings": []
}"""

    user = f"""Thông tin lâm sàng:
- Chẩn đoán: {req.diagnosis or 'Chưa có'}
- Lý do khám: {req.chief_complaint or 'Không rõ'}
- Triệu chứng: {req.symptoms or 'Không rõ'}
- Kế hoạch điều trị (nếu có): {req.treatment_plan or 'Không có'}
- Thuốc đang dùng: {', '.join(req.current_medications) if req.current_medications else 'Không có'}
- Dị ứng: {req.allergies or 'Không có'}
- Tiền sử: {req.history or 'Không rõ'}
- Bệnh nhân: {req.patient_info or 'Không rõ'}"""

    result = await svc.chat(system, user)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API lỗi")
    try:
        data = _safe_json_loads(result)
        response = {"success": True, "data": data}
    except json.JSONDecodeError:
        response = {"success": True, "data": {"suggestions": [], "warnings": [], "raw": result}}
    _safe_save_ai_recommendation(
        "drug_suggestions",
        request_payload=req.model_dump(),
        response_payload=response["data"],
        patient_id=req.patient_id,
        appointment_id=req.appointment_id,
        doctor_id=req.doctor_id,
    )
    return response


@router.post("/ai/voice-to-emr")
async def voice_to_emr(req: VoiceTranscriptRequest):
    svc = get_svc(req.model)
    system = """Bạn là AI thư ký y khoa chuyên chuẩn hóa hội thoại khám bệnh tiếng Việt thành dữ liệu EMR.
Mục tiêu: trích xuất thông tin có ích cho bác sĩ, không phân vai người nói, không bịa dữ kiện.

Nguyên tắc:
- Chỉ dùng thông tin xuất hiện rõ trong transcript.
- Nếu thông tin không có hoặc không chắc chắn, để chuỗi rỗng.
- Gom các ý rời rạc thành văn bản lâm sàng ngắn gọn, dễ đưa vào hồ sơ.
- "assessment" là đánh giá hoặc chẩn đoán sơ bộ nếu transcript đủ dữ kiện.
- "plan" là hướng xử trí, chỉ định, thuốc, cận lâm sàng, theo dõi nếu transcript có đề cập.
- "red_flags" ghi các dấu hiệu nguy cơ, cảnh báo, hoặc điểm cần ưu tiên làm rõ.
- "notes" tổng hợp các điểm quan trọng còn lại và thông tin cần làm rõ.

Trả lời JSON (chỉ JSON):
{
  "chief_complaint": "",
  "symptoms": "",
  "history": "",
  "vital_signs": "",
  "allergies": "",
  "current_medications": "",
  "assessment": "",
  "plan": "",
  "red_flags": "",
  "notes": "",
  "confidence": 0.9
}"""

    result = await svc.chat(system, f"Transcript:\n{req.transcript}")
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API lỗi")
    try:
        data = _safe_json_loads(result)
        response = {"success": True, "data": data}
    except json.JSONDecodeError:
        response = {
            "success": True,
            "data": {
                "chief_complaint": "",
                "symptoms": result,
                "history": "",
                "vital_signs": "",
                "allergies": "",
                "current_medications": "",
                "assessment": "",
                "plan": "",
                "red_flags": "",
                "notes": result,
                "confidence": 0.5,
            },
        }
    _safe_save_ai_recommendation(
        "voice_to_emr",
        request_payload=req.model_dump(),
        response_payload=response["data"],
        patient_id=req.patient_id,
        appointment_id=req.appointment_id,
        doctor_id=req.doctor_id,
    )
    return response


@router.post("/ai/soap-summary")
async def soap_summary(req: EMRData):
    svc = get_svc(req.model)
    system = """Bạn là bác sĩ AI tóm tắt hồ sơ bệnh án theo chuẩn SOAP cho bệnh viện Việt Nam.
Trả lời JSON (chỉ JSON):
{
  "S": "Subjective",
  "O": "Objective",
  "A": "Assessment",
  "P": "Plan",
  "icd10_code": ""
}"""

    user = f"""Tóm tắt SOAP:
- Bệnh nhân: {req.patient_name}, {req.patient_info}
- Lý do: {req.chief_complaint}
- Triệu chứng: {req.symptoms}
- Tiền sử: {req.history}
- Chẩn đoán: {req.current_diagnosis}
- Điều trị: {req.treatment_plan}"""

    result = await svc.chat(system, user)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API lỗi")
    try:
        data = _safe_json_loads(result)
        response = {"success": True, "data": data}
    except json.JSONDecodeError:
        response = {"success": True, "data": {"S": "", "O": "", "A": "", "P": result, "icd10_code": ""}}
    _safe_save_ai_recommendation(
        "soap_summary",
        request_payload=req.model_dump(),
        response_payload=response["data"],
        patient_id=req.patient_id,
        appointment_id=req.appointment_id,
        doctor_id=req.doctor_id,
    )
    return response


@router.get("/emr/patients")
async def get_patients():
    return {"patients": emr_service.get_patient_queue()}


@router.get("/emr/patient/{patient_id}")
async def get_patient(patient_id: str):
    data = emr_service.get_patient(patient_id)
    if not data:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh nhân")
    return data


@router.post("/emr/save")
async def save_emr(req: SaveEMRRequest):
    emr_id = emr_service.save(req)
    return {"success": True, "message": "Hồ sơ đã lưu thành công", "emr_id": emr_id}


@router.get("/emr/history/{patient_id}")
async def get_history(patient_id: str):
    return {"history": emr_service.get_history(patient_id)}


@router.post("/payment/generate-qr")
async def generate_qr(data: dict):
    import hashlib

    patient_id = data.get("patient_id", "unknown")
    amount = data.get("amount", 0)
    ref = hashlib.md5(f"{patient_id}{time.time()}".encode()).hexdigest()[:8].upper()
    return {
        "qr_code": f"MEDIFLOW|{ref}|{amount}|{patient_id}",
        "reference": ref,
        "amount": amount,
        "expire_at": int(time.time()) + 900,
        "vietqr_url": f"https://img.vietqr.io/image/970422-1234567890-compact2.png?amount={amount}&addInfo=MediFlow{ref}",
    }
