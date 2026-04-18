"""
Agent 2 EMR service isolated from Agent 1 logic while still mapping to the same DB.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from uuid import uuid4

try:
    from database_firebase import (  # type: ignore
        append_workflow_event,
        create_medical_record as create_firebase_medical_record,
        db as firebase_db,
        get_doctor_queue_appointments,
        get_medical_records_by_patient as get_firebase_medical_records_by_patient,
        update_appointment_status,
    )

    FIREBASE_AVAILABLE = True
except Exception:
    append_workflow_event = None
    create_firebase_medical_record = None
    firebase_db = None
    get_doctor_queue_appointments = None
    get_firebase_medical_records_by_patient = None
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


def _int_or_default(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


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


def _display_gender(value: str) -> str:
    normalized = _norm_key(value)
    if normalized in {"nam", "male", "m"}:
        return "Nam"
    if normalized in {"nu", "female", "f"}:
        return "Nu"
    return str(value or "").strip()


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

    def _get_profile(self, patient_id: str) -> dict:
        if not self._firebase_available:
            return {}
        try:
            doc = self._db.collection("patients").document(patient_id).get()
            return doc.to_dict() if doc.exists else {}
        except Exception:
            return {}

    def _get_medical_records(
        self,
        patient_id: str,
        cache: dict[str, list[dict]] | None = None,
    ) -> list[dict]:
        if not self._firebase_available or get_firebase_medical_records_by_patient is None:
            return []
        if cache is not None and patient_id in cache:
            return cache[patient_id]
        try:
            rows = get_firebase_medical_records_by_patient(patient_id, limit=20)
        except Exception:
            rows = []
        if cache is not None:
            cache[patient_id] = rows
        return rows

    def _pick_relevant_medical_record(
        self,
        records: list[dict],
        appointment_id: str = "",
    ) -> dict:
        if appointment_id:
            for item in records:
                if item.get("appointment_id") == appointment_id:
                    return item
        return records[0] if records else {}

    def _normalize_doctor_prescriptions(self, value) -> list[dict]:
        items = value if isinstance(value, list) else [value]
        normalized = []
        for item in items:
            if isinstance(item, dict):
                drug = str(item.get("drug") or item.get("name") or item.get("generic") or "").strip()
                generic = str(item.get("generic") or item.get("name") or "").strip()
                dose = str(item.get("dose") or item.get("dosage") or item.get("quantity") or "").strip()
                route = str(item.get("route") or "").strip()
                frequency = str(item.get("frequency") or "").strip()
                days = item.get("days") if item.get("days") not in (None, "") else ""
                instructions = str(
                    item.get("instructions")
                    or item.get("usage")
                    or item.get("note")
                    or item.get("notes")
                    or ""
                ).strip()
                if drug or dose or instructions:
                    normalized.append(
                        {
                            "drug": drug,
                            "generic": generic,
                            "dose": dose,
                            "route": route,
                            "frequency": frequency,
                            "days": days,
                            "instructions": instructions,
                        }
                    )
                continue

            text = str(item or "").strip()
            if text:
                normalized.append(
                    {
                        "drug": text,
                        "generic": "",
                        "dose": "",
                        "route": "",
                        "frequency": "",
                        "days": "",
                        "instructions": "",
                    }
                )
        return normalized

    def _merge_patient_with_medical_record(
        self,
        patient: dict,
        medical_record: dict,
        *,
        records_count: int = 0,
    ) -> dict:
        if not medical_record:
            patient["records_count"] = records_count
            return patient

        emr_data = medical_record.get("emr_data") or {}
        treatment = medical_record.get("treatment") if isinstance(medical_record.get("treatment"), dict) else {}
        treatment_plan = (
            treatment.get("description")
            or medical_record.get("treatment_plan")
            or emr_data.get("treatment_plan")
            or patient.get("treatment_plan", "")
        )
        current_medications = _to_list(
            medical_record.get("current_medications")
            or emr_data.get("current_medications")
            or patient.get("current_medications")
        )
        prescriptions = self._normalize_doctor_prescriptions(
            treatment.get("medications")
            or medical_record.get("prescriptions")
            or emr_data.get("prescriptions")
            or []
        )

        return {
            **patient,
            "name": medical_record.get("full_name") or medical_record.get("patient_name") or patient.get("name", ""),
            "age": medical_record.get("age", patient.get("age", "")) or patient.get("age", ""),
            "gender": _display_gender(medical_record.get("gender") or patient.get("gender", "")),
            "chief_complaint": (
                medical_record.get("chief_complaint")
                or emr_data.get("chief_complaint")
                or patient.get("chief_complaint", "")
            ),
            "history": (
                medical_record.get("medical_history")
                or medical_record.get("history")
                or emr_data.get("medical_history")
                or emr_data.get("history")
                or patient.get("history", "")
            ),
            "symptoms": medical_record.get("symptoms") or emr_data.get("symptoms") or patient.get("symptoms", ""),
            "diagnosis": (
                medical_record.get("diagnosis")
                or medical_record.get("preliminary_diagnosis")
                or emr_data.get("diagnosis")
                or emr_data.get("preliminary_diagnosis")
                or patient.get("diagnosis", "")
            ),
            "treatment_plan": treatment_plan,
            "follow_up_date": (
                medical_record.get("follow_up_date")
                or emr_data.get("follow_up_date")
                or patient.get("follow_up_date", "")
            ),
            "notes": medical_record.get("notes") or emr_data.get("notes") or patient.get("notes", ""),
            "allergies": medical_record.get("allergies") or emr_data.get("allergies") or patient.get("allergies", ""),
            "current_medications": current_medications,
            "prescriptions": prescriptions,
            "lab_orders": (
                medical_record.get("lab_orders")
                or emr_data.get("lab_orders")
                or patient.get("lab_orders", [])
            ),
            "soap": medical_record.get("soap") or emr_data.get("soap") or patient.get("soap"),
            "doctor_id": medical_record.get("doctor_id") or patient.get("doctor_id", ""),
            "current_date": str(
                medical_record.get("current_date") or medical_record.get("record_date") or patient.get("current_date", "")
            )[:10],
            "medical_record_id": medical_record.get("medical_record_id", ""),
            "record_updated_at": medical_record.get("updated_at_iso") or medical_record.get("updated_at") or "",
            "records_count": records_count,
        }

    def _build_patient_from_appointment(
        self,
        appointment_id: str,
        appt: dict,
        *,
        record_cache: dict[str, list[dict]] | None = None,
    ) -> dict:
        patient_id = appt.get("patient_id") or appt.get("patient_uid") or appointment_id
        profile = self._get_profile(patient_id)
        patient_name = (
            appt.get("patient_name")
            or appt.get("full_name")
            or profile.get("name")
            or profile.get("full_name")
            or patient_id
        )
        triage_level = _int_or_default(appt.get("triage_level"), 0)
        triage_map = {3: "high", 2: "medium", 1: "low"}
        queue_number = _int_or_default(appt.get("queue_number"), 0)
        visit_no = str(queue_number if queue_number > 0 else appointment_id[-4:]).upper()
        room_department = appt.get("recommended_department") or appt.get("department_name", "")
        history = (
            profile.get("medical_history")
            or profile.get("history")
            or appt.get("medical_history")
            or appt.get("history")
            or ""
        )
        chief_complaint = (
            appt.get("chief_complaint") or appt.get("triage_summary") or appt.get("symptoms") or ""
        )
        symptoms = appt.get("symptoms") or appt.get("triage_summary") or chief_complaint
        age = _age_from_profile(profile)
        if age in ("", None):
            age = appt.get("age", "")
        record = {
            "id": patient_id,
            "patient_id": patient_id,
            "queue_item_id": appointment_id,
            "appointment_id": appointment_id,
            "name": patient_name,
            "age": age,
            "gender": _display_gender(profile.get("gender") or appt.get("gender", "")),
            "room": profile.get("room") or appt.get("room") or _room_from_department(room_department),
            "visit_no": visit_no,
            "chief_complaint": chief_complaint,
            "history": history,
            "symptoms": symptoms,
            "triage_severity": triage_map.get(triage_level, "low"),
            "triage_source": "Agent1",
            "arrived_at": _iso_or_empty(appt.get("created_at") or appt.get("scheduled_at")),
            "current_date": "",
            "diagnosis": "",
            "treatment_plan": "",
            "follow_up_date": "",
            "notes": "",
            "current_medications": _to_list(profile.get("current_medications") or appt.get("current_medications")),
            "prescriptions": [],
            "lab_orders": [],
            "soap": None,
            "allergies": profile.get("allergies", "") or appt.get("allergies", ""),
            "department": appt.get("department_name", ""),
            "recommended_department": appt.get("recommended_department", ""),
            "triage_level": triage_level,
            "triage_summary": appt.get("triage_summary", ""),
            "queue_number": queue_number,
            "patient_phone": appt.get("patient_phone", ""),
            "session_id": appt.get("session_id", ""),
            "status": str(appt.get("status") or "waiting").strip().lower(),
            "booking_source": appt.get("booking_source", ""),
            "medical_record_id": "",
            "doctor_id": "",
            "records_count": 0,
        }

        records = self._get_medical_records(patient_id, cache=record_cache)
        merged_record = self._merge_patient_with_medical_record(
            record,
            self._pick_relevant_medical_record(records, appointment_id),
            records_count=len(records),
        )

        if patient_id in self._saved_records:
            saved = self._saved_records[patient_id]
            merged_record["diagnosis"] = saved.get("diagnosis", merged_record["diagnosis"])
            merged_record["treatment_plan"] = saved.get("treatment_plan", merged_record["treatment_plan"])
            merged_record["follow_up_date"] = saved.get("follow_up_date", merged_record["follow_up_date"])
            merged_record["notes"] = saved.get("notes", merged_record["notes"])
        return merged_record

    def _firebase_patients(self) -> list[dict]:
        if not self._firebase_available or get_doctor_queue_appointments is None:
            return []
        try:
            appointments = get_doctor_queue_appointments(limit=200)
            record_cache: dict[str, list[dict]] = {}
            rows = [
                self._build_patient_from_appointment(item["id"], item, record_cache=record_cache)
                for item in appointments
            ]
            rows.sort(key=lambda item: item.get("arrived_at", ""), reverse=False)
            return rows
        except Exception:
            return []

    def get_patient_queue(self) -> list[dict]:
        return self._firebase_patients()

    def get_patient(self, patient_id: str, appointment_id: str = "") -> Optional[dict]:
        matched_patient = None
        for patient in self.get_patient_queue():
            if patient["id"] == patient_id and (not appointment_id or patient["appointment_id"] == appointment_id):
                return patient
            if patient["appointment_id"] == patient_id:
                return patient
            if patient["id"] == patient_id and matched_patient is None:
                matched_patient = patient
        if matched_patient:
            return matched_patient

        profile = self._get_profile(patient_id)
        records = self._get_medical_records(patient_id)
        if not profile and not records:
            return None

        base_patient = {
            "id": patient_id,
            "patient_id": patient_id,
            "queue_item_id": appointment_id,
            "appointment_id": appointment_id,
            "name": profile.get("name") or profile.get("full_name") or patient_id,
            "age": _age_from_profile(profile),
            "gender": _display_gender(profile.get("gender", "")),
            "room": profile.get("room") or "",
            "visit_no": str(appointment_id[-4:] if appointment_id else patient_id[-4:]).upper(),
            "chief_complaint": "",
            "history": profile.get("medical_history") or profile.get("history") or "",
            "symptoms": "",
            "triage_severity": "low",
            "triage_source": "Agent1",
            "arrived_at": "",
            "current_date": "",
            "diagnosis": "",
            "treatment_plan": "",
            "follow_up_date": "",
            "notes": "",
            "current_medications": _to_list(profile.get("current_medications")),
            "prescriptions": [],
            "lab_orders": [],
            "soap": None,
            "allergies": profile.get("allergies", ""),
            "department": "",
            "recommended_department": "",
            "triage_level": 0,
            "triage_summary": "",
            "queue_number": 0,
            "patient_phone": profile.get("phone", ""),
            "session_id": "",
            "status": "",
            "booking_source": "",
            "medical_record_id": "",
            "doctor_id": "",
            "records_count": len(records),
        }
        return self._merge_patient_with_medical_record(
            base_patient,
            self._pick_relevant_medical_record(records, appointment_id),
            records_count=len(records),
        )

    def get_history(self, patient_id: str) -> list[dict]:
        if self._firebase_available and get_firebase_medical_records_by_patient is not None:
            try:
                records = get_firebase_medical_records_by_patient(patient_id, limit=20)
                rows = []
                for item in records:
                    emr_data = item.get("emr_data") or {}
                    treatment = item.get("treatment") or {}
                    treatment_text = (
                        treatment.get("description", "")
                        if isinstance(treatment, dict)
                        else str(treatment or "")
                    )
                    rows.append(
                        {
                            "visit_date": str(item.get("current_date") or item.get("record_date") or "")[:10],
                            "chief_complaint": emr_data.get("chief_complaint", "") or item.get("chief_complaint", ""),
                            "diagnosis": item.get("diagnosis", "") or emr_data.get("diagnosis", ""),
                            "treatment": treatment_text or item.get("treatment_plan", "") or emr_data.get("treatment_plan", ""),
                            "follow_up_date": item.get("follow_up_date", "") or emr_data.get("follow_up_date", ""),
                            "doctor": item.get("doctor_id", "DR001"),
                        }
                    )
                if rows:
                    return rows
            except Exception:
                pass
        return []

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

        if self._firebase_available and create_firebase_medical_record is not None:
            try:
                create_firebase_medical_record(
                    {
                        **req.model_dump(),
                        "full_name": req.full_name or req.patient_name,
                        "age": req.age,
                        "gender": req.gender,
                        "current_date": req.current_date or datetime.now().date().isoformat(),
                        "source_agent": "agent2_doctor",
                        "emr_data": emr_payload,
                    },
                    medical_record_id=emr_id,
                    actor_id=req.doctor_id,
                    actor_role="doctor",
                    source="backend_agent2",
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
        return emr_id
