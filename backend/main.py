"""
MediFlow AI - Backend FastAPI
Agent 1: Triage & Navigation (chat với bệnh nhân)
Agent 2: DocAssist (hỗ trợ bác sĩ)
"""
import os
import json
import uuid
import logging
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from services.fpt_ai import FPTAIService
from services.emr import EMRService
from services.triage_agent import TriageAgentService

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="MediFlow AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Services ─────────────────────────────────────────────────────────────
fpt_service = FPTAIService()
emr_service = EMRService()
triage_service = TriageAgentService()

# ── Pydantic Schemas ──────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str
    content: str

class TriageChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    history: list[ChatMessage] = []
    api_key: Optional[str] = None
    model: Optional[str] = "Llama-3.3-70B-Instruct"

class DocAssistRequest(BaseModel):
    prompt: str
    patient_context: Optional[dict] = None
    api_key: Optional[str] = None
    model: Optional[str] = "Llama-3.3-70B-Instruct"

class VoiceToEMRRequest(BaseModel):
    transcript: str
    patient_id: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = "Llama-3.3-70B-Instruct"

class SaveEMRRequest(BaseModel):
    patient_id: str
    emr_data: dict

class PaymentQRRequest(BaseModel):
    patient_id: str
    amount: float
    description: Optional[str] = ""

# ── Health Check ──────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat(), "service": "MediFlow AI"}

# ═══════════════════════════════════════════════════════════════════════════
# AGENT 1: TRIAGE & NAVIGATION
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/triage/chat")
async def triage_chat(req: TriageChatRequest):
    """Chat với AI Triage Agent - trả về response đầy đủ."""
    logger.info(f"[Triage] session={req.session_id} msg={req.message[:60]}...")
    try:
        api_key = req.api_key or os.getenv("FPT_API_KEY", "")
        result = await triage_service.chat(
            message=req.message,
            history=req.history,
            api_key=api_key,
            model=req.model,
        )
        return {
            "status": "success",
            "session_id": req.session_id or str(uuid.uuid4()),
            "response": result["response"],
            "triage_level": result.get("triage_level"),
            "suggested_department": result.get("suggested_department"),
            "action": result.get("action"),
        }
    except Exception as e:
        logger.error(f"[Triage] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/triage/chat/stream")
async def triage_chat_stream(req: TriageChatRequest):
    """Chat với AI Triage Agent - streaming SSE."""
    logger.info(f"[Triage/stream] msg={req.message[:60]}...")
    api_key = req.api_key or os.getenv("FPT_API_KEY", "")

    async def event_generator():
        try:
            async for chunk in triage_service.chat_stream(
                message=req.message,
                history=[{"role": h.role, "content": h.content} for h in req.history],
                api_key=api_key,
                model=req.model,
            ):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# ═══════════════════════════════════════════════════════════════════════════
# AGENT 2: DOC ASSIST
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/ai/diagnosis")
async def ai_diagnosis(req: DocAssistRequest):
    """AI gợi ý chẩn đoán dựa trên triệu chứng."""
    logger.info("[DocAssist] diagnosis request")
    try:
        api_key = req.api_key or os.getenv("FPT_API_KEY", "")
        result = await fpt_service.call(
            api_key=api_key,
            model=req.model,
            system_prompt=DIAGNOSIS_SYSTEM_PROMPT,
            user_message=req.prompt,
            context=req.patient_context,
        )
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/treatment")
async def ai_treatment(req: DocAssistRequest):
    """AI đề xuất phác đồ điều trị."""
    logger.info("[DocAssist] treatment request")
    try:
        api_key = req.api_key or os.getenv("FPT_API_KEY", "")
        result = await fpt_service.call(
            api_key=api_key,
            model=req.model,
            system_prompt=TREATMENT_SYSTEM_PROMPT,
            user_message=req.prompt,
            context=req.patient_context,
        )
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/prescription")
async def ai_prescription(req: DocAssistRequest):
    """AI tạo đơn thuốc mẫu."""
    logger.info("[DocAssist] prescription request")
    try:
        api_key = req.api_key or os.getenv("FPT_API_KEY", "")
        result = await fpt_service.call(
            api_key=api_key,
            model=req.model,
            system_prompt=PRESCRIPTION_SYSTEM_PROMPT,
            user_message=req.prompt,
            context=req.patient_context,
        )
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/lab-suggestions")
async def ai_lab_suggestions(req: DocAssistRequest):
    """AI gợi ý xét nghiệm cần làm."""
    try:
        api_key = req.api_key or os.getenv("FPT_API_KEY", "")
        result = await fpt_service.call(
            api_key=api_key,
            model=req.model,
            system_prompt=LAB_SYSTEM_PROMPT,
            user_message=req.prompt,
            context=req.patient_context,
        )
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/voice-to-emr")
async def voice_to_emr(req: VoiceToEMRRequest):
    """Chuyển transcript hội thoại bác sĩ-bệnh nhân thành cấu trúc EMR."""
    logger.info(f"[DocAssist] voice-to-emr len={len(req.transcript)}")
    try:
        api_key = req.api_key or os.getenv("FPT_API_KEY", "")
        result = await fpt_service.call(
            api_key=api_key,
            model=req.model,
            system_prompt=VOICE_TO_EMR_SYSTEM_PROMPT,
            user_message=f"Transcript hội thoại:\n{req.transcript}",
        )
        # Try to parse JSON from result
        try:
            emr_json = json.loads(result)
        except Exception:
            emr_json = {"raw": result}
        return {"status": "success", "emr": emr_json}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/soap-summary")
async def soap_summary(req: DocAssistRequest):
    """Tóm tắt SOAP từ thông tin bệnh nhân."""
    try:
        api_key = req.api_key or os.getenv("FPT_API_KEY", "")
        result = await fpt_service.call(
            api_key=api_key,
            model=req.model,
            system_prompt=SOAP_SYSTEM_PROMPT,
            user_message=req.prompt,
            context=req.patient_context,
        )
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat/stream")
async def chat_stream(req: DocAssistRequest):
    """AI chat streaming (DocAssist panel)."""
    api_key = req.api_key or os.getenv("FPT_API_KEY", "")

    async def event_generator():
        try:
            async for chunk in fpt_service.stream(
                api_key=api_key,
                model=req.model,
                system_prompt=DOCASSIST_CHAT_SYSTEM_PROMPT,
                user_message=req.prompt,
            ):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ═══════════════════════════════════════════════════════════════════════════
# EMR ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/emr/patients")
def get_patients():
    return {"status": "success", "data": emr_service.get_all_patients()}


@app.get("/api/emr/patient/{patient_id}")
def get_patient(patient_id: str):
    patient = emr_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"status": "success", "data": patient}


@app.post("/api/emr/save")
def save_emr(req: SaveEMRRequest):
    emr_service.save_emr(req.patient_id, req.emr_data)
    return {"status": "success", "message": "EMR saved"}


@app.get("/api/emr/history/{patient_id}")
def get_history(patient_id: str):
    return {"status": "success", "data": emr_service.get_history(patient_id)}


# ═══════════════════════════════════════════════════════════════════════════
# PAYMENT
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/payment/generate-qr")
def generate_payment_qr(req: PaymentQRRequest):
    """Mock QR thanh toán (dùng VietQR format)."""
    qr_data = {
        "bank": "Vietcombank",
        "account": "1234567890",
        "amount": req.amount,
        "description": req.description or f"Thanh toan kham benh BN#{req.patient_id}",
        "qr_url": f"https://img.vietqr.io/image/VCB-1234567890-compact.png?amount={int(req.amount)}&addInfo=MediFlow+{req.patient_id}",
        "created_at": datetime.now().isoformat(),
    }
    return {"status": "success", "data": qr_data}


# ═══════════════════════════════════════════════════════════════════════════
# SYSTEM PROMPTS
# ═══════════════════════════════════════════════════════════════════════════

DIAGNOSIS_SYSTEM_PROMPT = """Bạn là trợ lý AI hỗ trợ bác sĩ tại bệnh viện MediFlow.
Dựa trên triệu chứng và thông tin bệnh nhân được cung cấp, hãy:
1. Liệt kê 3-5 chẩn đoán phân biệt khả năng cao (theo thứ tự ưu tiên)
2. Giải thích ngắn gọn lý do cho mỗi chẩn đoán
3. Đề xuất các xét nghiệm cần làm để xác nhận
Lưu ý: Đây CHỈ là gợi ý hỗ trợ, bác sĩ phải quyết định cuối cùng."""

TREATMENT_SYSTEM_PROMPT = """Bạn là trợ lý AI hỗ trợ bác sĩ tại bệnh viện MediFlow.
Dựa trên thông tin bệnh nhân và chẩn đoán, đề xuất phác đồ điều trị bao gồm:
1. Hướng điều trị chính
2. Thuốc gợi ý (nếu có)
3. Chế độ sinh hoạt và theo dõi
4. Các dấu hiệu cần tái khám ngay
Lưu ý: Đây CHỈ là gợi ý, bác sĩ phải xem xét và quyết định."""

PRESCRIPTION_SYSTEM_PROMPT = """Bạn là trợ lý AI hỗ trợ bác sĩ kê đơn thuốc tại bệnh viện MediFlow.
Tạo đơn thuốc mẫu theo định dạng JSON:
{
  "medications": [
    {"name": "Tên thuốc", "dosage": "Liều lượng", "frequency": "Tần suất", "duration": "Thời gian", "notes": "Ghi chú"}
  ],
  "instructions": "Hướng dẫn chung",
  "follow_up": "Lịch tái khám"
}
Chỉ trả về JSON, không thêm text khác."""

LAB_SYSTEM_PROMPT = """Bạn là trợ lý AI hỗ trợ bác sĩ tại bệnh viện MediFlow.
Dựa trên triệu chứng và chẩn đoán, gợi ý các xét nghiệm cần thiết:
1. Xét nghiệm máu/nước tiểu
2. Chẩn đoán hình ảnh (X-quang, siêu âm, CT...)
3. Xét nghiệm đặc hiệu khác
Giải thích ngắn lý do cần làm từng loại."""

VOICE_TO_EMR_SYSTEM_PROMPT = """Bạn là AI chuyển đổi hội thoại bác sĩ-bệnh nhân thành hồ sơ bệnh án điện tử.
Phân tích transcript và trích xuất thông tin theo JSON:
{
  "chief_complaint": "Lý do khám",
  "symptoms": "Triệu chứng chi tiết",
  "duration": "Thời gian xuất hiện",
  "medical_history": "Tiền sử bệnh",
  "allergies": "Dị ứng",
  "current_medications": "Thuốc đang dùng",
  "physical_exam": "Khám lâm sàng",
  "preliminary_diagnosis": "Chẩn đoán sơ bộ",
  "treatment_plan": "Kế hoạch điều trị"
}
Chỉ trả về JSON. Điền "Không có thông tin" nếu không tìm thấy."""

SOAP_SYSTEM_PROMPT = """Bạn là trợ lý AI hỗ trợ bác sĩ tại bệnh viện MediFlow.
Tóm tắt thông tin bệnh nhân theo định dạng SOAP chuẩn y khoa:
- S (Subjective): Triệu chứng chủ quan bệnh nhân mô tả
- O (Objective): Dấu hiệu khách quan, kết quả xét nghiệm
- A (Assessment): Đánh giá, chẩn đoán
- P (Plan): Kế hoạch điều trị"""

DOCASSIST_CHAT_SYSTEM_PROMPT = """Bạn là DocAssist - Trợ lý AI hỗ trợ bác sĩ tại bệnh viện MediFlow.
Bạn có thể:
- Trả lời câu hỏi y khoa chuyên sâu
- Gợi ý chẩn đoán và điều trị
- Giải thích kết quả xét nghiệm
- Hỗ trợ tư vấn phác đồ điều trị
Ngôn ngữ: Tiếng Việt, chuyên nghiệp.
Luôn nhắc bác sĩ rằng đây là gợi ý AI, quyết định cuối cùng thuộc về bác sĩ."""
