"""
MediFlow AI - Backend FastAPI
Agent 1: Triage & Navigation (chat vá»›i bá»‡nh nhÃ¢n)
Agent 2: DocAssist (há»— trá»£ bÃ¡c sÄ©)
"""
import os
import json
import uuid
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from agent3.router import router as agent3_router
from services.agent2_endpoints import router as agent2_router
from services.fpt_ai import FPTAIService
from services.emr import EMRService
from services.triage_agent import TriageAgentService

# Firebase â€” optional, fallback gracefully if not installed
try:
    from database_firebase import (
        append_workflow_event,
        create_appointment,
        get_patient_info,
        get_appointments_by_uid,
        save_ai_recommendation,
        save_chat_session,
        save_chat_session_enriched,
        save_patient_profile,
    )
    FIREBASE_ENABLED = True
except Exception as _fb_err:
    FIREBASE_ENABLED = False
    append_workflow_event = None
    create_appointment = None
    get_appointments_by_uid = None
    get_patient_info = None
    save_ai_recommendation = None
    save_chat_session = None
    save_chat_session_enriched = None
    save_patient_profile = None

load_dotenv(Path(__file__).resolve().with_name(".env"))
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
app.include_router(agent2_router)
app.include_router(agent3_router, prefix="/api", tags=["Agent3"])

# â”€â”€ Services â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
fpt_service = FPTAIService()
emr_service = EMRService()
triage_service = TriageAgentService()


def _clean_json_text(text: str) -> str:
    if not text:
        return ""
    return text.strip().replace("```json", "").replace("```", "").strip()


def _safe_json_loads(text: str) -> dict:
    cleaned = _clean_json_text(text)
    try:
        return json.loads(cleaned)
    except Exception:
        start_obj = cleaned.find("{")
        end_obj = cleaned.rfind("}")
        if start_obj >= 0 and end_obj > start_obj:
            try:
                return json.loads(cleaned[start_obj:end_obj + 1])
            except Exception:
                return {}
        return {}


def _normalize_voice_emr_fields(raw: dict) -> dict:
    if not isinstance(raw, dict):
        return {}
    return {
        "chief_complaint": raw.get("chief_complaint", "") or raw.get("ly_do_kham", ""),
        "symptoms": raw.get("symptoms", "") or raw.get("trieu_chung", ""),
        "medical_history": raw.get("medical_history", "") or raw.get("history", ""),
        "allergies": raw.get("allergies", "") or raw.get("di_ung", ""),
        "current_medications": raw.get("current_medications", "") or raw.get("thuoc_dang_dung", ""),
        "preliminary_diagnosis": (
            raw.get("preliminary_diagnosis", "")
            or raw.get("assessment", "")
            or raw.get("chan_doan_so_bo", "")
        ),
        "treatment_plan": raw.get("treatment_plan", "") or raw.get("plan", ""),
        "raw": raw.get("raw", ""),
    }


def _extract_patient_id(context: Optional[dict]) -> str:
    if not isinstance(context, dict):
        return ""
    return (
        context.get("patient_id")
        or context.get("id")
        or context.get("patient_uid")
        or ""
    )


def _safe_append_workflow_event(event_type: str, **kwargs):
    if not FIREBASE_ENABLED or append_workflow_event is None:
        return
    try:
        append_workflow_event(event_type, **kwargs)
    except Exception as exc:
        logger.warning("[workflow] event=%s failed: %s", event_type, exc)


def _safe_save_ai_recommendation(
    agent_name: str,
    recommendation_type: str,
    *,
    request_payload: dict,
    response_payload,
    patient_id: str = "",
    appointment_id: str = "",
    medical_record_id: str = "",
    doctor_id: str = "",
):
    if not FIREBASE_ENABLED or save_ai_recommendation is None:
        return
    try:
        save_ai_recommendation(
            agent_name=agent_name,
            recommendation_type=recommendation_type,
            request_payload=request_payload,
            response_payload=response_payload,
            patient_id=patient_id,
            appointment_id=appointment_id,
            medical_record_id=medical_record_id,
            doctor_id=doctor_id,
        )
    except Exception as exc:
        logger.warning("[ai_recommendation] type=%s failed: %s", recommendation_type, exc)

# â”€â”€ Pydantic Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

class CreateAppointmentRequest(BaseModel):
    patient_uid: str
    patient_name: str = ""
    patient_phone: str
    department: str
    scheduled_date: str
    scheduled_time: str
    triage_level: Optional[int] = None
    symptoms: Optional[str] = ""
    chief_complaint: Optional[str] = ""
    triage_summary: Optional[str] = ""
    recommended_department: Optional[str] = ""
    booking_source: Optional[str] = "agent1"
    actor_role: Optional[str] = "patient"
    chat_excerpt: Optional[list] = []
    session_id: Optional[str] = None

class SavePatientRequest(BaseModel):
    uid: str
    name: str
    phone: str
    email: Optional[str] = ""
    role: Optional[str] = "patient"
    dob: Optional[str] = ""
    gender: Optional[str] = ""
    address: Optional[str] = ""
    insurance: Optional[str] = ""
    medical_history: Optional[str] = ""
    allergies: Optional[str] = ""
    current_medications: Optional[list] = []

class SaveChatSessionRequest(BaseModel):
    session_id: str
    patient_uid: str
    messages: list
    triage_level: Optional[int] = None
    department: Optional[str] = None
    summary: Optional[str] = ""
    chief_complaint: Optional[str] = ""
    recommended_action: Optional[str] = ""

# â”€â”€ Health Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "service": "MediFlow AI",
        "api_key_configured": bool(os.getenv("FPT_API_KEY", "")),
        "default_model": os.getenv("FPT_DEFAULT_MODEL", "Llama-3.3-70B-Instruct"),
    }

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# AGENT 1: TRIAGE & NAVIGATION
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@app.post("/api/triage/chat")
async def triage_chat(req: TriageChatRequest):
    """Chat vá»›i AI Triage Agent - tráº£ vá» response Ä‘áº§y Ä‘á»§."""
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
    """Chat vá»›i AI Triage Agent - streaming SSE."""
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

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# AGENT 2: DOC ASSIST
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@app.post("/api/ai/diagnosis")
async def ai_diagnosis(req: DocAssistRequest):
    """AI gá»£i Ã½ cháº©n Ä‘oÃ¡n dá»±a trÃªn triá»‡u chá»©ng."""
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
        _safe_save_ai_recommendation(
            "agent2_legacy",
            "diagnosis",
            request_payload={
                "prompt": req.prompt,
                "patient_context": req.patient_context or {},
            },
            response_payload=result,
            patient_id=_extract_patient_id(req.patient_context),
        )
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/treatment")
async def ai_treatment(req: DocAssistRequest):
    """AI Ä‘á» xuáº¥t phÃ¡c Ä‘á»“ Ä‘iá»u trá»‹."""
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
        _safe_save_ai_recommendation(
            "agent2_legacy",
            "treatment",
            request_payload={
                "prompt": req.prompt,
                "patient_context": req.patient_context or {},
            },
            response_payload=result,
            patient_id=_extract_patient_id(req.patient_context),
        )
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/prescription")
async def ai_prescription(req: DocAssistRequest):
    """AI táº¡o Ä‘Æ¡n thuá»‘c máº«u."""
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
        _safe_save_ai_recommendation(
            "agent2_legacy",
            "prescription",
            request_payload={
                "prompt": req.prompt,
                "patient_context": req.patient_context or {},
            },
            response_payload=result,
            patient_id=_extract_patient_id(req.patient_context),
        )
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/lab-suggestions")
async def ai_lab_suggestions(req: DocAssistRequest):
    """AI gá»£i Ã½ xÃ©t nghiá»‡m cáº§n lÃ m."""
    try:
        api_key = req.api_key or os.getenv("FPT_API_KEY", "")
        result = await fpt_service.call(
            api_key=api_key,
            model=req.model,
            system_prompt=LAB_SYSTEM_PROMPT,
            user_message=req.prompt,
            context=req.patient_context,
        )
        _safe_save_ai_recommendation(
            "agent2_legacy",
            "lab_suggestions",
            request_payload={
                "prompt": req.prompt,
                "patient_context": req.patient_context or {},
            },
            response_payload=result,
            patient_id=_extract_patient_id(req.patient_context),
        )
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/drug-suggestions")
async def ai_drug_suggestions(req: DocAssistRequest):
    """AI goi y danh sach thuoc phu hop voi bo canh hien tai."""
    try:
        api_key = req.api_key or os.getenv("FPT_API_KEY", "")
        result = await fpt_service.call(
            api_key=api_key,
            model=req.model,
            system_prompt=DRUG_SUGGEST_SYSTEM_PROMPT,
            user_message=req.prompt,
            context=req.patient_context,
        )
        _safe_save_ai_recommendation(
            "agent2_legacy",
            "drug_suggestions",
            request_payload={
                "prompt": req.prompt,
                "patient_context": req.patient_context or {},
            },
            response_payload=result,
            patient_id=_extract_patient_id(req.patient_context),
        )
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/voice-to-emr")
async def voice_to_emr(req: VoiceToEMRRequest):
    """Chuyá»ƒn transcript há»™i thoáº¡i bÃ¡c sÄ©-bá»‡nh nhÃ¢n thÃ nh cáº¥u trÃºc EMR."""
    logger.info(f"[DocAssist] voice-to-emr len={len(req.transcript)}")
    try:
        api_key = req.api_key or os.getenv("FPT_API_KEY", "")
        result = await fpt_service.call(
            api_key=api_key,
            model=req.model,
            system_prompt=VOICE_TO_EMR_SYSTEM_PROMPT,
            user_message=f"Transcript há»™i thoáº¡i:\n{req.transcript}",
        )
        emr_json = _safe_json_loads(result)
        if not emr_json:
            emr_json = {"raw": result}
        normalized = _normalize_voice_emr_fields(emr_json)
        _safe_save_ai_recommendation(
            "agent2_legacy",
            "voice_to_emr",
            request_payload={
                "transcript": req.transcript,
                "patient_id": req.patient_id or "",
            },
            response_payload=normalized,
            patient_id=req.patient_id or "",
        )
        return {"status": "success", "emr": normalized}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/soap-summary")
async def soap_summary(req: DocAssistRequest):
    """TÃ³m táº¯t SOAP tá»« thÃ´ng tin bá»‡nh nhÃ¢n."""
    try:
        api_key = req.api_key or os.getenv("FPT_API_KEY", "")
        result = await fpt_service.call(
            api_key=api_key,
            model=req.model,
            system_prompt=SOAP_SYSTEM_PROMPT,
            user_message=req.prompt,
            context=req.patient_context,
        )
        _safe_save_ai_recommendation(
            "agent2_legacy",
            "soap_summary",
            request_payload={
                "prompt": req.prompt,
                "patient_context": req.patient_context or {},
            },
            response_payload=result,
            patient_id=_extract_patient_id(req.patient_context),
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


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# EMR ENDPOINTS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# APPOINTMENTS & PATIENT PROFILE (Firestore)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@app.post("/api/appointments/create")
def api_create_appointment(req: CreateAppointmentRequest):
    """Äáº·t lá»‹ch khÃ¡m tá»« káº¿t quáº£ chat triage."""
    if not FIREBASE_ENABLED:
        raise HTTPException(status_code=503, detail="Firebase chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh")
    try:
        symptoms = req.symptoms or req.chief_complaint or ""
        resolved_patient_name = req.patient_name or req.patient_uid
        if get_patient_info is not None:
            try:
                patient_profile = get_patient_info(req.patient_uid) or {}
                resolved_patient_name = (
                    patient_profile.get("name")
                    or patient_profile.get("full_name")
                    or resolved_patient_name
                )
            except Exception:
                pass
        appt_id = create_appointment(
            patient_id=req.patient_uid,
            dept_name=req.department,
            time=f"{req.scheduled_date} {req.scheduled_time}",
            phone=req.patient_phone,
            patient_name=resolved_patient_name,
            triage_level=req.triage_level,
            symptoms=symptoms,
            chief_complaint=req.chief_complaint or symptoms,
            triage_summary=req.triage_summary,
            recommended_department=req.recommended_department or req.department,
            booking_source=req.booking_source,
            source=req.booking_source,
            actor_role=req.actor_role,
            patient_uid=req.patient_uid,
            chat_excerpt=req.chat_excerpt or [],
            session_id=req.session_id,
        )
        try:
            save_patient_profile(
                req.patient_uid,
                resolved_patient_name,
                req.patient_phone,
                source="api_appointments_create",
                role="patient",
                last_appointment_id=appt_id,
                last_department=req.department,
                last_triage_level=req.triage_level,
                latest_symptoms=symptoms,
            )
        except Exception as exc:
            logger.warning("[Appointment] patient profile sync failed: %s", exc)
        logger.info(f"[Appointment] Created: {appt_id} for {req.department}")
        return {"status": "success", "appointment_id": appt_id,
                "message": f"ÄÃ£ Ä‘áº·t lá»‹ch táº¡i {req.department}"}
    except Exception as e:
        logger.error(f"[Appointment] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/appointments/{uid}")
def api_get_appointments(uid: str):
    """Láº¥y danh sÃ¡ch lá»‹ch háº¹n cá»§a bá»‡nh nhÃ¢n."""
    if not FIREBASE_ENABLED:
        raise HTTPException(status_code=503, detail="Firebase chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh")
    return {"status": "success", "data": get_appointments_by_uid(uid)}


@app.post("/api/patients/save")
def api_save_patient(req: SavePatientRequest):
    """LÆ°u há»“ sÆ¡ bá»‡nh nhÃ¢n."""
    if not FIREBASE_ENABLED:
        raise HTTPException(status_code=503, detail="Firebase chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh")
    save_patient_profile(
        req.uid,
        req.name,
        req.phone,
        email=req.email,
        role=req.role,
        dob=req.dob,
        gender=req.gender,
        address=req.address,
        insurance=req.insurance,
        medical_history=req.medical_history,
        allergies=req.allergies,
        current_medications=req.current_medications,
        source="api_patients_save",
        actor_role=req.role or "patient",
    )
    return {"status": "success", "message": "ÄÃ£ lÆ°u há»“ sÆ¡ bá»‡nh nhÃ¢n"}


@app.post("/api/chat-sessions/save")
def api_save_session(req: SaveChatSessionRequest):
    """LÆ°u phiÃªn chat triage."""
    if not FIREBASE_ENABLED:
        raise HTTPException(status_code=503, detail="Firebase chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh")
    if save_chat_session_enriched is not None:
        save_chat_session_enriched(
            session_id=req.session_id,
            uid=req.patient_uid,
            messages=req.messages,
            triage_level=req.triage_level,
            department=req.department,
            summary=req.summary,
            chief_complaint=req.chief_complaint,
            recommended_action=req.recommended_action,
            source="api_chat_sessions_save",
        )
    else:
        save_chat_session(req.session_id, req.patient_uid,
                          req.messages, req.triage_level, req.department)
    return {"status": "success"}


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# PAYMENT
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@app.post("/api/payment/generate-qr")
def generate_payment_qr(req: PaymentQRRequest):
    """Mock QR thanh toÃ¡n (dÃ¹ng VietQR format)."""
    qr_data = {
        "bank": "Vietcombank",
        "account": "1234567890",
        "amount": req.amount,
        "description": req.description or f"Thanh toan kham benh BN#{req.patient_id}",
        "qr_url": f"https://img.vietqr.io/image/VCB-1234567890-compact.png?amount={int(req.amount)}&addInfo=MediFlow+{req.patient_id}",
        "created_at": datetime.now().isoformat(),
    }
    return {"status": "success", "data": qr_data}


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SYSTEM PROMPTS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

DIAGNOSIS_SYSTEM_PROMPT = """Ban la tro ly AI ho tro bac si tai benh vien MediFlow.
Phan tich du lieu benh nhan va de xuat:
1. 3-5 chan doan phan biet theo thu tu uu tien
2. Ly do ngan gon cho tung chan doan
3. Cac xet nghiem can lam de xac nhan
Luu y: day la goi y ho tro, quyet dinh cuoi cung thuoc ve bac si."""

TREATMENT_SYSTEM_PROMPT = """Ban la tro ly AI ho tro bac si tai benh vien MediFlow.
Dua tren chan doan va thong tin lam sang, de xuat:
1. Huong dieu tri chinh
2. Thuoc goi y neu can
3. Che do theo doi va cham soc
4. Dau hieu can tai kham gap
Luu y: day la goi y ho tro, bac si quyet dinh phac do cuoi cung."""

PRESCRIPTION_SYSTEM_PROMPT = """Ban la tro ly AI ho tro ke don tai benh vien MediFlow.
Tra ve ket qua theo JSON:
{
  "medications": [
    {"name":"", "dosage":"", "frequency":"", "duration":"", "notes":""}
  ],
  "instructions": "",
  "follow_up": ""
}
Chi tra ve JSON, khong them text ngoai JSON."""

LAB_SYSTEM_PROMPT = """Ban la tro ly AI goi y xet nghiem cho bac si.
Dua tren trieu chung va chan doan, de xuat:
1. Xet nghiem can thiet
2. Chan doan hinh anh neu can
3. Ly do ngan gon cho moi de xuat
Chi tra ve noi dung chuyen mon ngan gon va ro rang."""

DRUG_SUGGEST_SYSTEM_PROMPT = """Ban la bac si/duoc si lam sang AI tai Viet Nam.
Nhiem vu: goi y danh sach thuoc kha thi dua tren chan doan/trieu chung/ke hoach dieu tri.
Tra ve JSON:
{
  "suggestions": [
    {
      "name": "Ten thuoc",
      "class": "Nhom thuoc",
      "reason": "Ly do goi y",
      "priority": "first-line|adjunct|symptomatic|avoid",
      "cautions": []
    }
  ],
  "warnings": []
}
Chi tra ve JSON, khong kem noi dung ngoai JSON."""

VOICE_TO_EMR_SYSTEM_PROMPT = """Ban la AI chuyen doi hoi thoai bac si-benh nhan thanh ho so benh an dien tu.
Phan tich transcript va trich xuat thong tin theo JSON:
{
  "chief_complaint": "Ly do kham",
  "symptoms": "Trieu chung chi tiet",
  "duration": "Thoi gian xuat hien",
  "medical_history": "Tien su benh",
  "allergies": "Di ung",
  "current_medications": "Thuoc dang dung",
  "physical_exam": "Kham lam sang",
  "preliminary_diagnosis": "Chan doan so bo",
  "treatment_plan": "Ke hoach dieu tri"
}
Chi tra ve JSON. Neu thieu thong tin, de trong hoac ghi 'Khong co thong tin'."""

SOAP_SYSTEM_PROMPT = """Ban la tro ly AI ho tro bac si.
Tom tat thong tin benh nhan theo SOAP:
- S (Subjective): trieu chung chu quan
- O (Objective): dau hieu khach quan va ket qua can lam sang
- A (Assessment): danh gia va chan doan
- P (Plan): huong dieu tri va theo doi"""

DOCASSIST_CHAT_SYSTEM_PROMPT = """Ban la DocAssist - tro ly AI ho tro bac si tai MediFlow.
Ban co the:
- Tra loi cau hoi y khoa chuyen sau
- Goi y chan doan va dieu tri
- Giai thich ket qua xet nghiem
- Ho tro lap ke hoach dieu tri
Van phong: tieng Viet, ro rang, chuyen nghiep.
Luon nhac rang day la goi y AI, quyet dinh cuoi cung thuoc ve bac si."""
