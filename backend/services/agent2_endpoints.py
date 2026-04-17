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

load_dotenv()

router = APIRouter(prefix="/api/doctor", tags=["agent2-doctor"])

FPT_API_KEY = os.getenv("FPT_API_KEY", "")
DEFAULT_MODEL = os.getenv("FPT_DEFAULT_MODEL", "Llama-3.3-70B-Instruct")

emr_service = Agent2EMRService()


def get_svc(model: str | None = None) -> Agent2FPTAIService:
    if not FPT_API_KEY:
        raise HTTPException(status_code=500, detail="FPT_API_KEY chua duoc cau hinh trong file .env")
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


@router.post("/chat")
async def chat(req: ChatRequest):
    svc = get_svc(req.model)
    result = await svc.chat(req.system_prompt, req.user_message, req.history)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API khong phan hoi")
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
    system = """Ban la bac si AI chuyen khoa noi tong quat tai Viet Nam.
Phan tich trieu chung va dua ra chan doan theo phac do Bo Y te Viet Nam.
Tra loi JSON (chi JSON, khong text khac):
{
  "primary_diagnosis": "chan doan so bo chinh",
  "differential": ["chan doan phan biet 1", "chan doan phan biet 2"],
  "urgency": "cap cuu|khan|binh thuong",
  "reasoning": "ly giai ngan gon",
  "next_steps": ["buoc 1", "buoc 2"]
}"""

    user = f"""Phan tich benh nhan:
- Ten: {req.patient_name}, {req.patient_info}
- Ly do kham: {req.chief_complaint}
- Tien su: {req.history}
- Trieu chung: {req.symptoms}
- Chan doan hien tai: {req.current_diagnosis or 'Chua co'}"""

    result = await svc.chat(system, user)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API loi")
    try:
        data = _safe_json_loads(result)
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {
            "success": True,
            "data": {
                "primary_diagnosis": result,
                "differential": [],
                "urgency": "binh thuong",
                "reasoning": result,
                "next_steps": [],
            },
        }


@router.post("/ai/treatment")
async def ai_treatment(req: EMRData):
    svc = get_svc(req.model)
    system = """Ban la bac si AI chuyen khoa noi tai Viet Nam.
De xuat phac do dieu tri theo huong dan Bo Y te Viet Nam.
Tra loi JSON (chi JSON):
{
  "medications": [{"name":"","dose":"","frequency":"","duration":"","note":""}],
  "non_pharmacological": [],
  "monitoring": [],
  "follow_up": "",
  "lifestyle": [],
  "warnings": []
}"""

    user = f"""De xuat dieu tri:
- Benh nhan: {req.patient_name}, {req.patient_info}
- Ly do: {req.chief_complaint}
- Trieu chung: {req.symptoms}
- Tien su: {req.history}
- Chan doan: {req.current_diagnosis or 'Chua xac dinh'}"""

    result = await svc.chat(system, user)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API loi")
    try:
        data = _safe_json_loads(result)
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {
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


@router.post("/ai/prescription")
async def ai_prescription(req: PrescriptionRequest):
    svc = get_svc(req.model)
    system = """Ban la duoc si lam sang AI tai Viet Nam.
Muc tieu: tao don thuoc hop ly, chinh xac theo huong dan Bo Y te Viet Nam va thuc hanh an toan thuoc.

Quy tac bat buoc:
- Neu co "treatment_plan", phai uu tien va bam sat cac thuoc trong do; chi them thuoc ho tro khi that can, neu ro ly do.
- Khong de xuat thuoc mau thuan voi chan doan hoac thieu chi dinh ro rang.
- Kiem tra di ung, thuoc dang dung, nguy co tuong tac va chong chi dinh thuong gap; neu thieu du lieu quan trong thi dua vao "warnings".
- Lieu luong phai thuc te theo nguoi lon (tru khi co thong tin tre em), ghi duong dung, tan suat, so ngay; tranh de xuat lieu nguy hiem.

Tra loi JSON (chi JSON):
{
  "prescriptions": [{"drug":"","generic":"","dose":"","route":"","frequency":"","days":30,"quantity":"","instructions":""}],
  "interactions": [],
  "contraindications": [],
  "warnings": [],
  "rationale": "",
  "total_cost_estimate": ""
}"""

    user = f"""Tao don thuoc:
- Chan doan: {req.diagnosis}
- Ly do kham: {req.chief_complaint or 'Khong ro'}
- Trieu chung: {req.symptoms or 'Khong ro'}
- Ke hoach dieu tri (neu co): {req.treatment_plan or 'Khong co'}
- Thuoc dang dung: {', '.join(req.current_medications) if req.current_medications else 'Khong co'}
- Di ung: {req.allergies or 'Khong co'}
- Tien su: {req.history}
- Benh nhan: {req.patient_info}"""

    result = await svc.chat(system, user)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API loi")
    try:
        data = _safe_json_loads(result)
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {
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


@router.post("/ai/lab-suggestions")
async def ai_lab(req: LabRequest):
    svc = get_svc(req.model)
    system = """Ban la bac si AI chuyen chan doan tai Viet Nam. Goi y xet nghiem theo muc do uu tien.
Nguyen tac:
- Uu tien xet nghiem giup loai tru chan doan nguy hiem va xac nhan chan doan chinh.
- Tranh goi y xet nghiem trung lap/khong lien quan; neu thieu du kien (tuoi, thai ky, benh nen...) hay ghi vao reason ngan gon.
Tra loi JSON (chi JSON):
{
  "urgent":   [{"test":"","reason":"","expected_result":""}],
  "routine":  [{"test":"","reason":""}],
  "optional": [{"test":"","reason":""}],
  "imaging":  [{"test":"","reason":""}]
}"""

    user = f"""Goi y xet nghiem:
- Trieu chung: {req.symptoms}
- Chan doan: {req.diagnosis}
- Tien su: {req.history}
- XN da co: {', '.join(req.existing_labs) if req.existing_labs else 'Chua co'}"""

    result = await svc.chat(system, user)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API loi")
    try:
        data = _safe_json_loads(result)
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {"success": True, "data": {"urgent": [], "routine": [], "optional": [], "imaging": [], "raw": result}}


@router.post("/ai/drug-suggestions")
async def ai_drug_suggestions(req: DrugSuggestRequest):
    svc = get_svc(req.model)
    system = """Ban la bac si/duoc si lam sang AI tai Viet Nam.
Nhiem vu: goi y danh sach thuoc kha di (khong phai don hoan chinh) dua tren chan doan/trieu chung/ke hoach dieu tri.

Yeu cau:
- Uu tien thuoc phu hop huong dan dieu tri (Bo Y te VN); tranh goi y sai chi dinh.
- Neu thieu du kien quan trong (tuoi, thai ky, chuc nang than/gan...) hay them vao warnings.
- Moi goi y phai co reason ngan gon (vi sao dung).
- Khong bia ten thuoc khong ton tai; uu tien generic pho bien o VN.

Tra loi JSON (chi JSON):
{
  "suggestions": [
    {
      "name": "Ten thuoc",
      "class": "nhom thuoc",
      "reason": "vi sao phu hop",
      "priority": "first-line|adjunct|symptomatic|avoid",
      "cautions": ["..."]
    }
  ],
  "warnings": []
}"""

    user = f"""Thong tin lam sang:
- Chan doan: {req.diagnosis or 'Chua co'}
- Ly do kham: {req.chief_complaint or 'Khong ro'}
- Trieu chung: {req.symptoms or 'Khong ro'}
- Ke hoach dieu tri (neu co): {req.treatment_plan or 'Khong co'}
- Thuoc dang dung: {', '.join(req.current_medications) if req.current_medications else 'Khong co'}
- Di ung: {req.allergies or 'Khong co'}
- Tien su: {req.history or 'Khong ro'}
- Benh nhan: {req.patient_info or 'Khong ro'}"""

    result = await svc.chat(system, user)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API loi")
    try:
        data = _safe_json_loads(result)
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {"success": True, "data": {"suggestions": [], "warnings": [], "raw": result}}


@router.post("/ai/voice-to-emr")
async def voice_to_emr(req: VoiceTranscriptRequest):
    svc = get_svc(req.model)
    system = """Ban la AI thu ky y khoa chuyen chuan hoa hoi thoai kham benh tieng Viet thanh du lieu EMR.
Muc tieu: trich xuat thong tin co ich cho bac si, khong phan vai nguoi noi, khong bia du kien.

Nguyen tac:
- Chi dung thong tin xuat hien ro trong transcript.
- Neu thong tin khong co hoac khong chac chan, de chuoi rong.
- Gom cac y roi rac thanh van ban lam sang ngan gon, de dua vao ho so.
- "assessment" la danh gia hoac chan doan so bo neu transcript du du kien.
- "plan" la huong xu tri, chi dinh, thuoc, can lam sang, theo doi neu transcript co de cap.
- "red_flags" ghi cac dau hieu nguy co, canh bao, hoac diem can uu tien lam ro.
- "notes" tong hop cac diem quan trong con lai va thong tin can lam ro.

Tra loi JSON (chi JSON):
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
        raise HTTPException(status_code=502, detail="FPT AI API loi")
    try:
        data = _safe_json_loads(result)
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {
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


@router.post("/ai/soap-summary")
async def soap_summary(req: EMRData):
    svc = get_svc(req.model)
    system = """Ban la bac si AI tom tat ho so benh an theo chuan SOAP cho benh vien Viet Nam.
Tra loi JSON (chi JSON):
{
  "S": "Subjective",
  "O": "Objective",
  "A": "Assessment",
  "P": "Plan",
  "icd10_code": ""
}"""

    user = f"""Tom tat SOAP:
- Benh nhan: {req.patient_name}, {req.patient_info}
- Ly do: {req.chief_complaint}
- Trieu chung: {req.symptoms}
- Tien su: {req.history}
- Chan doan: {req.current_diagnosis}
- Dieu tri: {req.treatment_plan}"""

    result = await svc.chat(system, user)
    if result is None:
        raise HTTPException(status_code=502, detail="FPT AI API loi")
    try:
        data = _safe_json_loads(result)
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {"success": True, "data": {"S": "", "O": "", "A": "", "P": result, "icd10_code": ""}}


@router.get("/emr/patients")
async def get_patients():
    return {"patients": emr_service.get_patient_queue()}


@router.get("/emr/patient/{patient_id}")
async def get_patient(patient_id: str):
    data = emr_service.get_patient(patient_id)
    if not data:
        raise HTTPException(status_code=404, detail="Khong tim thay benh nhan")
    return data


@router.post("/emr/save")
async def save_emr(req: SaveEMRRequest):
    emr_id = emr_service.save(req)
    return {"success": True, "message": "Ho so da luu thanh cong", "emr_id": emr_id}


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
