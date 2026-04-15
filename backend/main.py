"""
MediFlow AI — DocAssist Agent 2
Backend: FastAPI + FPT AI Marketplace API
API key được đọc từ .env — frontend không cần gửi key
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json
from typing import AsyncGenerator

load_dotenv()

FPT_API_KEY = os.getenv("FPT_API_KEY", "")
DEFAULT_MODEL = os.getenv("FPT_DEFAULT_MODEL", "Llama-3.3-70B-Instruct")

from models import (
    ChatRequest, EMRData, PrescriptionRequest,
    LabRequest, DrugSuggestRequest, VoiceTranscriptRequest, SaveEMRRequest
)
from services.fpt_ai import FPTAIService
from services.emr import EMRService

app = FastAPI(
    title="MediFlow DocAssist API",
    description="Agent 2 — Trợ lý lâm sàng AI cho bác sĩ",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_svc(model: str = None) -> FPTAIService:
    """Tạo FPTAIService dùng key từ .env"""
    if not FPT_API_KEY:
        raise HTTPException(status_code=500, detail="FPT_API_KEY chưa được cấu hình trong file .env")
    return FPTAIService(FPT_API_KEY, model or DEFAULT_MODEL)

def _clean_json_text(text: str) -> str:
    if not text:
        return ""
    return text.strip().replace("```json", "").replace("```", "").strip()

def _safe_json_loads(text: str):
    """
    Parse JSON returned by LLM robustly.
    If it contains leading/trailing text, try to extract first {...} block.
    """
    cleaned = _clean_json_text(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Best-effort extract JSON object/array substring
        start_obj = cleaned.find("{")
        start_arr = cleaned.find("[")
        if start_obj == -1 and start_arr == -1:
            raise
        start = start_obj if start_arr == -1 else (start_arr if start_obj == -1 else min(start_obj, start_arr))
        end_obj = cleaned.rfind("}")
        end_arr = cleaned.rfind("]")
        end = max(end_obj, end_arr)
        if start >= 0 and end > start:
            return json.loads(cleaned[start:end+1])
        raise


# ─────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "agent": "DocAssist",
        "version": "1.0.0",
        "api_key_configured": bool(FPT_API_KEY),
        "default_model": DEFAULT_MODEL,
    }


# ─────────────────────────────────────────────
# AI Chat (non-streaming)
# ─────────────────────────────────────────────
@app.post("/api/chat")
async def chat(req: ChatRequest):
    svc = get_svc(req.model)
    result = await svc.chat(req.system_prompt, req.user_message, req.history)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API không phản hồi")
    return {"reply": result}


# ─────────────────────────────────────────────
# AI Chat (streaming SSE)
# ─────────────────────────────────────────────
@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    svc = get_svc(req.model)

    async def event_generator() -> AsyncGenerator[str, None]:
        async for chunk in svc.chat_stream(req.system_prompt, req.user_message, req.history):
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


# ─────────────────────────────────────────────
# AI Diagnosis
# ─────────────────────────────────────────────
@app.post("/api/ai/diagnosis")
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
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {"success": True, "data": {"primary_diagnosis": result, "differential": [], "urgency": "bình thường", "reasoning": result, "next_steps": []}}


# ─────────────────────────────────────────────
# AI Treatment Plan
# ─────────────────────────────────────────────
@app.post("/api/ai/treatment")
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
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {"success": True, "data": {"medications": [], "non_pharmacological": [result], "monitoring": [], "follow_up": "", "lifestyle": [], "warnings": []}}


# ─────────────────────────────────────────────
# AI Prescription
# ─────────────────────────────────────────────
@app.post("/api/ai/prescription")
async def ai_prescription(req: PrescriptionRequest):
    svc = get_svc(req.model)
    system = """Bạn là dược sĩ lâm sàng AI tại Việt Nam.
Mục tiêu: tạo đơn thuốc HỢP LÝ, CHÍNH XÁC theo hướng dẫn Bộ Y tế Việt Nam và thực hành an toàn thuốc.

Quy tắc bắt buộc:
- Nếu có "treatment_plan" (kế hoạch điều trị), phải ƯU TIÊN và bám sát các thuốc trong đó; chỉ thêm thuốc hỗ trợ khi thật cần, nêu rõ lý do.
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
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {"success": True, "data": {"prescriptions": [], "interactions": [], "contraindications": [], "warnings": [], "rationale": "", "total_cost_estimate": "N/A", "raw": result}}


# ─────────────────────────────────────────────
# AI Lab Suggestions
# ─────────────────────────────────────────────
@app.post("/api/ai/lab-suggestions")
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
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {"success": True, "data": {"urgent": [], "routine": [], "optional": [], "imaging": [], "raw": result}}


# ─────────────────────────────────────────────
# AI Drug Suggestions (for search popup)
# ─────────────────────────────────────────────
@app.post("/api/ai/drug-suggestions")
async def ai_drug_suggestions(req: DrugSuggestRequest):
    svc = get_svc(req.model)
    system = """Bạn là bác sĩ/dược sĩ lâm sàng AI tại Việt Nam.
Nhiệm vụ: gợi ý danh sách thuốc KHẢ DĨ (không phải đơn hoàn chỉnh) dựa trên chẩn đoán/triệu chứng/kế hoạch điều trị.

Yêu cầu:
- Ưu tiên thuốc phù hợp hướng dẫn điều trị (Bộ Y tế VN); tránh gợi ý sai chỉ định.
- Nếu thiếu dữ kiện quan trọng (tuổi, thai kỳ, chức năng thận/gan...) hãy thêm vào warnings.
- Mỗi gợi ý phải có reason ngắn gọn (vì sao dùng).
- Không bịa tên thuốc không tồn tại; ưu tiên generic phổ biến ở VN.

Trả lời JSON (chỉ JSON):
{
  "suggestions": [
    {
      "name": "Tên thuốc (ưu tiên generic hoặc generic + hàm lượng)",
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
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {"success": True, "data": {"suggestions": [], "warnings": [], "raw": result}}


# ─────────────────────────────────────────────
# Voice-to-EMR
# ─────────────────────────────────────────────
@app.post("/api/ai/voice-to-emr")
async def voice_to_emr(req: VoiceTranscriptRequest):
    svc = get_svc(req.model)
    system = """Bạn là AI trích xuất thông tin lâm sàng từ hội thoại bác sĩ - bệnh nhân tiếng Việt.
Trả lời JSON (chỉ JSON):
{
  "chief_complaint": "",
  "symptoms": "",
  "history": "",
  "vital_signs": "",
  "allergies": "",
  "current_medications": "",
  "notes": "",
  "confidence": 0.9
}"""

    result = await svc.chat(system, f"Transcript:\n{req.transcript}")
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API lỗi")
    try:
        data = _safe_json_loads(result)
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {"success": True, "data": {"chief_complaint": "", "symptoms": result, "history": "", "vital_signs": "", "notes": result, "confidence": 0.5}}


# ─────────────────────────────────────────────
# SOAP Summary
# ─────────────────────────────────────────────
@app.post("/api/ai/soap-summary")
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
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {"success": True, "data": {"S": "", "O": "", "A": "", "P": result, "icd10_code": ""}}


# ─────────────────────────────────────────────
# EMR CRUD
# ─────────────────────────────────────────────
@app.get("/api/emr/patients")
async def get_patients():
    return {"patients": EMRService.get_patient_queue()}

@app.get("/api/emr/patient/{patient_id}")
async def get_patient(patient_id: str):
    data = EMRService.get_patient(patient_id)
    if not data:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh nhân")
    return data

@app.post("/api/emr/save")
async def save_emr(req: SaveEMRRequest):
    result = EMRService.save(req)
    return {"success": True, "message": "Hồ sơ đã lưu thành công", "emr_id": result}

@app.get("/api/emr/history/{patient_id}")
async def get_history(patient_id: str):
    return {"history": EMRService.get_history(patient_id)}


# ─────────────────────────────────────────────
# QR Payment
# ─────────────────────────────────────────────
@app.post("/api/payment/generate-qr")
async def generate_qr(data: dict):
    import hashlib, time
    patient_id = data.get("patient_id", "unknown")
    amount = data.get("amount", 0)
    ref = hashlib.md5(f"{patient_id}{time.time()}".encode()).hexdigest()[:8].upper()
    return {
        "qr_code": f"MEDIFLOW|{ref}|{amount}|{patient_id}",
        "reference": ref,
        "amount": amount,
        "expire_at": int(time.time()) + 900,
        "vietqr_url": f"https://img.vietqr.io/image/970422-1234567890-compact2.png?amount={amount}&addInfo=MediFlow{ref}"
    }


# ─────────────────────────────────────────────
# AI Role Detection — phân tích ai là bác sĩ, ai là bệnh nhân
# ─────────────────────────────────────────────
@app.post("/api/ai/detect-roles")
async def detect_roles(data: dict):
    """
    Nhận list utterances [{id, text}], trả về roleMap {id: 'doctor'|'patient'}
    """
    utterances = data.get("utterances", [])
    if not utterances:
        return {"roleMap": {}}

    svc = get_svc()

    system = """Bạn là AI phân tích hội thoại y tế tiếng Việt.
Nhiệm vụ: xác định từng câu là do BÁC SĨ hay BỆNH NHÂN nói.

Đặc điểm câu của BÁC SĨ:
- Hỏi về triệu chứng: "Bạn/anh/chị đau ở đâu?", "Từ bao giờ?", "Mức độ thế nào?"
- Ra chỉ định: "Tôi sẽ kê đơn...", "Cần xét nghiệm...", "Cho anh uống..."
- Giải thích bệnh: "Đây là dấu hiệu của...", "Huyết áp cao do..."
- Dùng thuật ngữ y tế chuyên sâu
- Câu ngắn, hỏi trực tiếp

Đặc điểm câu của BỆNH NHÂN:
- Mô tả cảm giác: "Tôi bị đau...", "Tôi cảm thấy...", "Dạ em bị..."
- Trả lời câu hỏi: "Dạ được 3 ngày rồi", "Đau lắm ạ", "Khoảng 7 điểm"
- Kể lịch sử: "Trước đây tôi có bị...", "Gia đình tôi..."
- Dùng từ ngữ thông thường, không chuyên môn
- Thường có "dạ", "ạ", "thưa bác sĩ"

Trả về JSON (chỉ JSON, không text khác):
{
  "roles": {
    "<id>": "doctor",
    "<id>": "patient"
  }
}"""

    # Format utterances for the prompt
    formatted = "\n".join([f'[{u["id"]}] {u["text"]}' for u in utterances])
    user = f"Phân tích các câu sau:\n{formatted}"

    result = await svc.chat(system, user)
    if result is None:
        # Fallback: simple heuristic
        role_map = {}
        for u in utterances:
            t = u["text"].lower()
            is_doctor = any([
                "?" in t,
                any(w in t for w in ["bạn ", "anh ", "chị ", "ông ", "bà ", "em có", "từ bao", "mức độ", "cần ", "sẽ kê", "xét nghiệm", "huyết áp", "nhiệt độ"]),
            ])
            role_map[u["id"]] = "doctor" if is_doctor else "patient"
        return {"roleMap": role_map}

    try:
        parsed = _safe_json_loads(result)
        return {"roleMap": parsed.get("roles", {})}
    except json.JSONDecodeError:
        return {"roleMap": {u["id"]: "unknown" for u in utterances}}
