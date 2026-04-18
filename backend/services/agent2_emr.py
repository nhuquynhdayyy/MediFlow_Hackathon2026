"""
Agent 2 EMR service isolated from Agent 1 logic while still mapping to the same DB.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from uuid import uuid4

try:
    from database_firebase import append_workflow_event, db as firebase_db, update_appointment_status  # type: ignore

    FIREBASE_AVAILABLE = True
except Exception:
    append_workflow_event = None
    firebase_db = None
    update_appointment_status = None
    FIREBASE_AVAILABLE = False

ROOM_BY_DEPARTMENT = {
    "Khoa Tim mach": "K1",
    "Khoa Than kinh": "K2",
    "Khoa Tieu hoa": "K1",
    "Khoa Noi tong quat": "K3",
    "Khoa Nhi": "K4",
    "Khoa Mat": "K2",
    "Khoa Tai Mui Hong": "K3",
    "Khoa Da lieu": "K4",
}

MOCK_PATIENTS = [
    {
        "id": "P001",
        "name": "Nguyen Van An",
        "age": 65,
        "gender": "Nam",
        "room": "K1",
        "visit_no": "2847",
        "chief_complaint": "Dau nguc kem kho tho xuat hien tu 2 ngay nay, dau tang khi gang suc",
        "history": "THA do II (dieu tri Amlodipine 5mg), DTD type 2",
        "symptoms": "Dau nguc trai lan vai trai, muc do 7/10. SpO2: 96%. HA: 155/95 mmHg. Nhip tim: 92 bpm. Kho tho khi gang suc. Khong sot.",
        "triage_severity": "high",
        "triage_source": "Agent1",
        "arrived_at": "2026-04-13T08:15:00",
        "diagnosis": "",
        "treatment_plan": "",
        "current_medications": ["Amlodipine 5mg", "Metformin 500mg"],
        "allergies": "",
    },
    {
        "id": "P002",
        "name": "Tran Thi Bich",
        "age": 42,
        "gender": "Nu",
        "room": "K2",
        "visit_no": "2848",
        "chief_complaint": "Dau dau vung tran, chong mat khi dung day",
        "history": "Khong co tien su benh nen",
        "symptoms": "Dau dau am i 3/10, chong mat tu the. HA: 110/70. Khong sot. Khong buon non.",
        "triage_severity": "medium",
        "triage_source": "Agent1",
        "arrived_at": "2026-04-13T08:40:00",
        "diagnosis": "",
        "treatment_plan": "",
        "current_medications": [],
        "allergies": "",
    },
    {
        "id": "P003",
        "name": "Le Hoang Minh",
        "age": 28,
        "gender": "Nam",
        "room": "K1",
        "visit_no": "2849",
        "chief_complaint": "Ho lau ngay khoang 3 tuan, sot nhe buoi chieu",
        "history": "Khong co tien su",
        "symptoms": "Ho khan, doi khi co dom. Sot nhe 37.8C buoi chieu. Gay 2kg trong 1 thang.",
        "triage_severity": "low",
        "triage_source": "Agent1",
        "arrived_at": "2026-04-13T09:05:00",
        "diagnosis": "",
        "treatment_plan": "",
        "current_medications": [],
        "allergies": "",
    },
    {
        "id": "P004",
        "name": "Pham Thi Lan",
        "age": 55,
        "gender": "Nu",
        "room": "K3",
        "visit_no": "2850",
        "chief_complaint": "Tai kham dai thao duong dinh ky 3 thang",
        "history": "DTD type 2 (Metformin 500mg x2), THA nhe",
        "symptoms": "HbA1c: 7.2% (thang truoc 7.8%). HA: 130/80. Khong trieu chung moi.",
        "triage_severity": "low",
        "triage_source": "Agent1",
        "arrived_at": "2026-04-13T09:20:00",
        "diagnosis": "",
        "treatment_plan": "",
        "current_medications": ["Metformin 500mg", "Amlodipine 5mg"],
        "allergies": "Penicillin",
    },
]

MOCK_HISTORY = {
    "P001": [
        {
            "visit_date": "2026-01-15",
            "chief_complaint": "Kiem tra huyet ap dinh ky",
            "diagnosis": "THA do II on dinh",
            "treatment": "Tiep tuc Amlodipine 5mg",
            "follow_up_date": "2026-04-15",
            "doctor": "BS. Nguyen Minh Tuan",
        }
    ],
    "P004": [
        {
            "visit_date": "2026-01-13",
            "chief_complaint": "Tai kham DTD",
            "diagnosis": "DTD type 2, HbA1c 7.8%",
            "treatment": "Tang lieu Metformin, che do an",
            "follow_up_date": "2026-04-13",
            "doctor": "BS. Le Thu Ha",
        }
    ],
}


def _parse_date(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if hasattr(value, "to_datetime"):
        try:
            return value.to_datetime()
        except Exception:
            return None
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        for candidate in (normalized, normalized.replace(" ", "T")):
            try:
                return datetime.fromisoformat(candidate)
            except ValueError:
                continue
    return None


def _iso_or_empty(value) -> str:
    parsed = _parse_date(value)
    return parsed.isoformat() if parsed else (str(value) if value else "")


def _to_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def _norm_key(value: str) -> str:
    return (
        str(value or "")
        .lower()
        .replace("đ", "d")
        .replace("Đ", "D")
        .replace("ơ", "o")
        .replace("ô", "o")
        .replace("á", "a")
        .replace("à", "a")
        .replace("ả", "a")
        .replace("ã", "a")
        .replace("ạ", "a")
        .replace("â", "a")
        .replace("ă", "a")
        .replace("ê", "e")
        .replace("é", "e")
        .replace("è", "e")
        .replace("í", "i")
        .replace("ì", "i")
        .replace("ó", "o")
        .replace("ò", "o")
        .replace("ú", "u")
        .replace("ù", "u")
        .replace("ư", "u")
    )


def _room_from_department(department: str) -> str:
    normalized = _norm_key(department)
    for key, room in ROOM_BY_DEPARTMENT.items():
        if _norm_key(key) == normalized:
            return room
    return "K1"


def _age_from_profile(profile: dict) -> str | int:
    age = profile.get("age")
    if age not in (None, ""):
        return age
    dob = profile.get("dob")
    if not dob:
        return ""
    if isinstance(dob, datetime):
        dob_date = dob.date()
    elif isinstance(dob, date):
        dob_date = dob
    else:
        try:
            dob_date = datetime.fromisoformat(str(dob)).date()
        except ValueError:
            return ""
    today = date.today()
    return today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))


def _normalize_saved_emr(payload: dict) -> dict:
    history = payload.get("medical_history") or payload.get("history") or ""
    diagnosis = payload.get("preliminary_diagnosis") or payload.get("diagnosis") or ""
    current_medications = payload.get("current_medications") or []
    if isinstance(current_medications, str):
        current_medications = _to_list(current_medications)

    return {
        "patient_name": payload.get("patient_name", ""),
        "chief_complaint": payload.get("chief_complaint", ""),
        "symptoms": payload.get("symptoms", ""),
        "history": history,
        "medical_history": history,
        "allergies": payload.get("allergies", ""),
        "current_medications": current_medications,
        "diagnosis": diagnosis,
        "preliminary_diagnosis": diagnosis,
        "treatment_plan": payload.get("treatment_plan", ""),
        "follow_up_date": payload.get("follow_up_date", ""),
        "prescriptions": payload.get("prescriptions", []) or [],
        "lab_orders": payload.get("lab_orders", []) or [],
        "notes": payload.get("notes", ""),
        "soap": payload.get("soap"),
    }


def _safe_append_workflow_event(event_type: str, **kwargs):
    if append_workflow_event is None:
        return
    try:
        append_workflow_event(event_type, **kwargs)
    except Exception:
        return


def _safe_update_appointment_status(appointment_id: str, status: str, **kwargs):
    if not appointment_id or update_appointment_status is None:
        return
    try:
        update_appointment_status(appointment_id, status, **kwargs)
    except Exception:
        return


class Agent2EMRService:
    def __init__(self):
        self._db = firebase_db
        self._firebase_available = FIREBASE_AVAILABLE
        self._saved_records: dict[str, dict] = {}
        self._mock_patients = {patient["id"]: dict(patient) for patient in MOCK_PATIENTS}
        self._mock_history = {key: [dict(item) for item in value] for key, value in MOCK_HISTORY.items()}

    def _get_profile(self, patient_id: str) -> dict:
        if not self._firebase_available:
            return {}
        try:
            doc = self._db.collection("patients").document(patient_id).get()
            return doc.to_dict() if doc.exists else {}
        except Exception:
            return {}

    def _build_patient_from_appointment(self, appointment_id: str, appt: dict) -> dict:
        patient_id = appt.get("patient_id") or appointment_id
        patient_name = appt.get("patient_name") or patient_id
        profile = self._get_profile(patient_id)
        triage_level = appt.get("triage_level") or 0
        triage_map = {3: "high", 2: "medium", 1: "low"}
        visit_no = str(appt.get("queue_number") or appointment_id[-4:]).upper()
        room_department = appt.get("recommended_department") or appt.get("department_name", "")
        history = (
            profile.get("medical_history")
            or profile.get("history")
            or appt.get("medical_history")
            or ""
        )
        chief_complaint = appt.get("chief_complaint") or appt.get("symptoms") or appt.get("triage_summary") or ""
        symptoms = appt.get("symptoms") or appt.get("triage_summary") or ""
        record = {
            "id": patient_id,
            "appointment_id": appointment_id,
            "name": patient_name,
            "age": _age_from_profile(profile),
            "gender": profile.get("gender", ""),
            "room": profile.get("room") or _room_from_department(room_department),
            "visit_no": visit_no,
            "chief_complaint": chief_complaint,
            "history": history,
            "symptoms": symptoms,
            "triage_severity": triage_map.get(triage_level, "low"),
            "triage_source": "Agent1",
            "arrived_at": _iso_or_empty(appt.get("created_at") or appt.get("scheduled_at")),
            "diagnosis": "",
            "treatment_plan": "",
            "current_medications": _to_list(profile.get("current_medications") or appt.get("current_medications")),
            "allergies": profile.get("allergies", "") or appt.get("allergies", ""),
            "department": appt.get("department_name", ""),
            "recommended_department": appt.get("recommended_department", ""),
            "triage_level": triage_level,
            "triage_summary": appt.get("triage_summary", ""),
            "queue_number": appt.get("queue_number", 0),
            "patient_phone": appt.get("patient_phone", ""),
            "session_id": appt.get("session_id", ""),
        }
        if patient_id in self._saved_records:
            saved = self._saved_records[patient_id]
            record["diagnosis"] = saved.get("diagnosis", record["diagnosis"])
            record["treatment_plan"] = saved.get("treatment_plan", record["treatment_plan"])
        return record

    def _firebase_patients(self) -> list[dict]:
        if not self._firebase_available:
            return []
        try:
            docs = self._db.collection("appointments").limit(200).stream()
            rows = []
            for doc in docs:
                appt = doc.to_dict() or {}
                if appt.get("status", "waiting") not in {"waiting", "in_consultation"}:
                    continue
                rows.append(self._build_patient_from_appointment(doc.id, appt))
            rows.sort(key=lambda item: item.get("arrived_at", ""), reverse=False)
            return rows
        except Exception:
            return []

    def get_patient_queue(self) -> list[dict]:
        return self._firebase_patients() or list(self._mock_patients.values())

    def get_patient(self, patient_id: str) -> Optional[dict]:
        for patient in self.get_patient_queue():
            if patient["id"] == patient_id:
                return patient
        return self._mock_patients.get(patient_id)

    def get_history(self, patient_id: str) -> list[dict]:
        if self._firebase_available:
            try:
                docs = self._db.collection("medical_records").where("patient_id", "==", patient_id).stream()
                rows = []
                for doc in docs:
                    item = doc.to_dict() or {}
                    emr_data = item.get("emr_data") or {}
                    rows.append(
                        {
                            "visit_date": str(item.get("record_date", ""))[:10],
                            "chief_complaint": emr_data.get("chief_complaint", "") or item.get("chief_complaint", ""),
                            "diagnosis": item.get("diagnosis", "") or emr_data.get("diagnosis", ""),
                            "treatment": item.get("treatment", "") or emr_data.get("treatment_plan", ""),
                            "follow_up_date": emr_data.get("follow_up_date", ""),
                            "doctor": item.get("doctor_id", "DR001"),
                        }
                    )
                rows.sort(key=lambda item: item.get("visit_date", ""), reverse=True)
                if rows:
                    return rows[:20]
            except Exception:
                pass
        return self._mock_history.get(patient_id, [])

    def save(self, req) -> str:
        emr_id = str(uuid4())[:8].upper()
        normalized = _normalize_saved_emr(req.model_dump())
        recorded_at = datetime.now().isoformat()
        emr_payload = {
            **normalized,
            "appointment_id": req.appointment_id,
            "department": req.department,
            "triage_level": req.triage_level,
        }
        record = {
            "emr_id": emr_id,
            "patient_id": req.patient_id,
            "patient_name": req.patient_name,
            **emr_payload,
            "doctor_id": req.doctor_id,
            "created_at": recorded_at,
            "status": "completed",
        }
        self._saved_records[req.patient_id] = record

        if self._firebase_available:
            try:
                self._db.collection("medical_records").document(emr_id).set(
                    {
                        "patient_id": req.patient_id,
                        "patient_name": req.patient_name,
                        "appointment_id": req.appointment_id,
                        "department": req.department,
                        "triage_level": req.triage_level,
                        "doctor_id": req.doctor_id,
                        "chief_complaint": normalized["chief_complaint"],
                        "symptoms": normalized["symptoms"],
                        "history": normalized["history"],
                        "medical_history": normalized["medical_history"],
                        "allergies": normalized["allergies"],
                        "current_medications": normalized["current_medications"],
                        "diagnosis": normalized["diagnosis"],
                        "preliminary_diagnosis": normalized["preliminary_diagnosis"],
                        "treatment": normalized["treatment_plan"],
                        "treatment_plan": normalized["treatment_plan"],
                        "follow_up_date": normalized["follow_up_date"],
                        "prescriptions": normalized["prescriptions"],
                        "lab_orders": normalized["lab_orders"],
                        "notes": normalized["notes"],
                        "soap": normalized["soap"],
                        "status": "completed",
                        "source_agent": "agent2_doctor",
                        "record_date": recorded_at,
                        "updated_at": recorded_at,
                        "emr_data": emr_payload,
                    }
                )
            except Exception:
                pass

        _safe_append_workflow_event(
            "doctor_emr_saved",
            patient_id=req.patient_id,
            appointment_id=req.appointment_id,
            medical_record_id=emr_id,
            actor_id=req.doctor_id,
            actor_role="doctor",
            source="backend_agent2",
            payload={
                "department": req.department,
                "triage_level": req.triage_level,
                "diagnosis": normalized["diagnosis"],
                "treatment_plan": normalized["treatment_plan"],
            },
        )
        _safe_update_appointment_status(
            req.appointment_id,
            "completed",
            patient_id=req.patient_id,
            actor_id=req.doctor_id,
            actor_role="doctor",
            doctor_id=req.doctor_id,
            source="backend_agent2",
            completed_at=recorded_at,
            last_medical_record_id=emr_id,
            last_diagnosis=normalized["diagnosis"],
            last_treatment_plan=normalized["treatment_plan"],
        )

        if req.patient_id in self._mock_patients:
            self._mock_patients[req.patient_id]["diagnosis"] = normalized["diagnosis"]
            self._mock_patients[req.patient_id]["treatment_plan"] = normalized["treatment_plan"]

        history_item = {
            "visit_date": datetime.now().date().isoformat(),
            "chief_complaint": normalized["chief_complaint"],
            "diagnosis": normalized["diagnosis"],
            "treatment": normalized["treatment_plan"],
            "follow_up_date": normalized["follow_up_date"],
            "doctor": req.doctor_id,
        }
        self._mock_history.setdefault(req.patient_id, []).insert(0, history_item)
        return emr_id
