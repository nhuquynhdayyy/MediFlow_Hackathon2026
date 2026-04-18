"""
Pydantic models — api_key và model KHÔNG còn trong request body.
Backend tự đọc từ .env
"""
from pydantic import BaseModel
from typing import Optional, List


class ChatMessage(BaseModel):
    role: str      # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    system_prompt: str
    user_message:  str
    model:         Optional[str] = None   # override model nếu muốn
    history:       Optional[List[ChatMessage]] = []


class EMRData(BaseModel):
    patient_id:        str  = ""
    appointment_id:    str  = ""
    patient_name:      str
    patient_info:      str  = ""
    department:        str  = ""
    doctor_id:         str  = "DR001"
    chief_complaint:   str  = ""
    symptoms:          str  = ""
    history:           str  = ""
    current_diagnosis: Optional[str] = ""
    treatment_plan:    Optional[str] = ""
    notes:             Optional[str] = ""
    model:             Optional[str] = None


class PrescriptionRequest(BaseModel):
    patient_id:          str  = ""
    appointment_id:      str  = ""
    doctor_id:           str  = "DR001"
    diagnosis:           str
    patient_info:        str  = ""
    history:             str  = ""
    symptoms:            str  = ""
    chief_complaint:     str  = ""
    treatment_plan:      Optional[str] = ""
    current_medications: Optional[List[str]] = []
    allergies:           Optional[str] = ""
    model:               Optional[str] = None


class LabRequest(BaseModel):
    patient_id:    str = ""
    appointment_id: str = ""
    doctor_id:     str = "DR001"
    symptoms:      str
    diagnosis:     str  = ""
    history:       str  = ""
    existing_labs: Optional[List[str]] = []
    model:         Optional[str] = None


class DrugSuggestRequest(BaseModel):
    patient_id:          str = ""
    appointment_id:      str = ""
    doctor_id:           str = "DR001"
    diagnosis:           str = ""
    symptoms:            str = ""
    chief_complaint:     str = ""
    treatment_plan:      str = ""
    patient_info:        str = ""
    history:             str = ""
    current_medications: Optional[List[str]] = []
    allergies:           str = ""
    model:               Optional[str] = None


class VoiceTranscriptRequest(BaseModel):
    transcript: str
    patient_id: str = ""
    appointment_id: str = ""
    doctor_id: str = "DR001"
    model:      Optional[str] = None


class SaveEMRRequest(BaseModel):
    patient_id:     str
    appointment_id: str = ""
    patient_name:   str
    department:     str = ""
    chief_complaint: str = ""
    symptoms:        str = ""
    history:         str = ""
    medical_history: str = ""
    diagnosis:       str = ""
    preliminary_diagnosis: str = ""
    treatment_plan:  str = ""
    allergies:       str = ""
    current_medications: Optional[List[str]] = []
    follow_up_date:  str = ""
    prescriptions:   Optional[List[dict]] = []
    lab_orders:      Optional[List[str]]  = []
    notes:           str  = ""
    doctor_id:       str  = "DR001"
    triage_level:    Optional[int] = None
    soap:            Optional[dict] = None
