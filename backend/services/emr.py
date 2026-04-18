"""EMR service with Firestore-first patient queue."""

from datetime import datetime
from typing import Optional

# Mock patient database
MOCK_PATIENTS = [
    {
        "id": "BN001",
        "name": "Nguyễn Văn An",
        "age": 45,
        "gender": "Nam",
        "dob": "1979-03-15",
        "phone": "0901234567",
        "address": "123 Lê Lợi, Đà Nẵng",
        "insurance": "BH1234567890",
        "chief_complaint": "Đau bụng vùng thượng vị, buồn nôn 3 ngày",
        "symptoms": "Đau âm ỉ, tăng sau ăn, ợ chua, không sốt",
        "medical_history": "Viêm dạ dày mạn 2021",
        "allergies": "Không",
        "current_medications": "Omeprazole 20mg",
        "vital_signs": {"bp": "120/80", "hr": 78, "temp": 37.0, "spo2": 98},
        "department": "Khoa Tiêu hóa",
        "doctor": "BS. Trần Thị Mai",
        "status": "waiting",
        "queue_number": 5,
    },
    {
        "id": "BN002",
        "name": "Lê Thị Bình",
        "age": 32,
        "gender": "Nữ",
        "dob": "1992-07-22",
        "phone": "0912345678",
        "address": "456 Hùng Vương, Đà Nẵng",
        "insurance": "BH0987654321",
        "chief_complaint": "Đau đầu, chóng mặt tái phát 1 tuần",
        "symptoms": "Đau nửa đầu, buồn nôn, sợ ánh sáng",
        "medical_history": "Migraine từ 2020",
        "allergies": "Aspirin",
        "current_medications": "Không",
        "vital_signs": {"bp": "110/70", "hr": 82, "temp": 36.8, "spo2": 99},
        "department": "Khoa Thần kinh",
        "doctor": "BS. Phạm Văn Hùng",
        "status": "in_consultation",
        "queue_number": 2,
    },
    {
        "id": "BN003",
        "name": "Trần Văn Cường",
        "age": 58,
        "gender": "Nam",
        "dob": "1966-11-10",
        "phone": "0923456789",
        "address": "789 Nguyễn Tất Thành, Đà Nẵng",
        "insurance": "BH1122334455",
        "chief_complaint": "Hồi hộp, đau tức ngực khi gắng sức",
        "symptoms": "Đau tức ngực lan ra vai trái, khó thở nhẹ khi leo cầu thang",
        "medical_history": "Tăng huyết áp, rối loạn lipid máu",
        "allergies": "Không",
        "current_medications": "Amlodipine 5mg, Atorvastatin 20mg",
        "vital_signs": {"bp": "145/90", "hr": 88, "temp": 37.2, "spo2": 96},
        "department": "Khoa Tim mạch",
        "doctor": "BS. Nguyễn Thị Lan",
        "status": "waiting",
        "queue_number": 8,
    },
]

MOCK_HISTORY = {
    "BN001": [
        {
            "date": "2024-12-10",
            "doctor": "BS. Trần Thị Mai",
            "diagnosis": "Viêm dạ dày cấp",
            "treatment": "Omeprazole 20mg x 4 tuần",
        },
        {
            "date": "2024-06-15",
            "doctor": "BS. Lê Văn Nam",
            "diagnosis": "Đau thượng vị do stress",
            "treatment": "Antacid + nghỉ ngơi",
        },
    ],
    "BN002": [
        {
            "date": "2025-01-20",
            "doctor": "BS. Phạm Văn Hùng",
            "diagnosis": "Migraine không có aura",
            "treatment": "Sumatriptan 50mg PRN",
        },
    ],
    "BN003": [
        {
            "date": "2024-09-05",
            "doctor": "BS. Nguyễn Thị Lan",
            "diagnosis": "Tăng huyết áp độ 1",
            "treatment": "Amlodipine 5mg",
        },
        {
            "date": "2024-03-12",
            "doctor": "BS. Vũ Minh Tuấn",
            "diagnosis": "Rối loạn lipid máu",
            "treatment": "Atorvastatin 20mg",
        },
    ],
}


def _normalize_saved_emr(emr_data: dict) -> dict:
    history = emr_data.get("medical_history") or emr_data.get("history") or ""
    diagnosis = emr_data.get("preliminary_diagnosis") or emr_data.get("diagnosis") or ""
    current_medications = emr_data.get("current_medications") or []
    if isinstance(current_medications, str):
        current_medications = [item.strip() for item in current_medications.split(",") if item.strip()]

    return {
        "chief_complaint": emr_data.get("chief_complaint", ""),
        "symptoms": emr_data.get("symptoms", ""),
        "history": history,
        "medical_history": history,
        "allergies": emr_data.get("allergies", ""),
        "current_medications": current_medications,
        "diagnosis": diagnosis,
        "preliminary_diagnosis": diagnosis,
        "treatment_plan": emr_data.get("treatment_plan", ""),
        "follow_up_date": emr_data.get("follow_up_date", ""),
        "prescriptions": emr_data.get("prescriptions", []) or [],
        "lab_orders": emr_data.get("lab_orders", []) or [],
        "notes": emr_data.get("notes", ""),
        "soap": emr_data.get("soap"),
    }


class EMRService:
    def __init__(self):
        self._patients = {p["id"]: p for p in MOCK_PATIENTS}
        self._emr_updates = {}
        self._firebase_db = None
        self._firebase_available = False
        try:
            from database_firebase import db  # type: ignore

            self._firebase_db = db
            self._firebase_available = True
        except Exception:
            self._firebase_db = None
            self._firebase_available = False

    def _build_patient_from_appointment(self, appointment_id: str, appt: dict) -> dict:
        patient_id = appt.get("patient_id") or appointment_id
        patient_name = appt.get("patient_name") or patient_id
        profile = {}
        if self._firebase_available:
            try:
                profile_doc = self._firebase_db.collection("patients").document(patient_id).get()
                if profile_doc.exists:
                    profile = profile_doc.to_dict() or {}
            except Exception:
                profile = {}

        department = appt.get("department_name", "")
        triage_level = appt.get("triage_level", 0)
        triage_map = {3: "high", 2: "medium", 1: "low"}

        return {
            "id": patient_id,
            "appointment_id": appointment_id,
            "name": patient_name,
            "age": profile.get("age") or profile.get("dob") or "",
            "gender": profile.get("gender", ""),
            "dob": profile.get("dob", ""),
            "phone": appt.get("patient_phone") or profile.get("phone", ""),
            "address": profile.get("address", ""),
            "insurance": profile.get("insurance", ""),
            "chief_complaint": appt.get("symptoms", ""),
            "symptoms": appt.get("symptoms", ""),
            "medical_history": profile.get("medical_history", ""),
            "allergies": profile.get("allergies", ""),
            "current_medications": profile.get("current_medications", ""),
            "vital_signs": profile.get("vital_signs", {}),
            "department": department,
            "doctor": "",
            "status": appt.get("status", "waiting"),
            "queue_number": appt.get("queue_number", 0),
            "triage_level": triage_level,
            "triage_severity": triage_map.get(triage_level, "low"),
            "scheduled_at": appt.get("scheduled_at", ""),
            "session_id": appt.get("session_id", ""),
        }

    def _get_firestore_patients(self) -> list:
        if not self._firebase_available:
            return []
        try:
            docs = self._firebase_db.collection("appointments").limit(200).stream()
            rows = []
            for doc in docs:
                appt = doc.to_dict() or {}
                status = appt.get("status", "waiting")
                if status in {"waiting", "in_consultation"}:
                    rows.append(self._build_patient_from_appointment(doc.id, appt))
            rows.sort(key=lambda x: str(x.get("scheduled_at", "")), reverse=True)
            return rows
        except Exception:
            return []

    def get_all_patients(self) -> list:
        firestore_patients = self._get_firestore_patients()
        if firestore_patients:
            return firestore_patients
        return list(self._patients.values())

    def get_patient(self, patient_id: str) -> dict | None:
        patient = None
        for p in self.get_all_patients():
            if p.get("id") == patient_id:
                patient = p
                break
        if not patient:
            patient = self._patients.get(patient_id)
        if patient and patient_id in self._emr_updates:
            patient = {**patient, **self._emr_updates[patient_id]}
        return patient

    def save_emr(self, patient_id: str, emr_data: dict):
        normalized = _normalize_saved_emr(emr_data)
        if patient_id not in self._emr_updates:
            self._emr_updates[patient_id] = {}
        self._emr_updates[patient_id].update(
            {
                **normalized,
                "updated_at": datetime.now().isoformat(),
            }
        )
        if self._firebase_available:
            try:
                payload = {
                    "patient_id": patient_id,
                    "doctor_id": emr_data.get("doctor_id", "DR001"),
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
                    "record_date": datetime.now().isoformat(),
                    "emr_data": normalized,
                }
                self._firebase_db.collection("medical_records").add(payload)
            except Exception:
                pass

    def get_history(self, patient_id: str) -> list:
        if self._firebase_available:
            try:
                docs = self._firebase_db.collection("medical_records").where("patient_id", "==", patient_id).stream()
                rows = []
                for doc in docs:
                    item = doc.to_dict() or {}
                    rows.append(
                        {
                            "date": str(item.get("record_date", ""))[:10],
                            "doctor": item.get("doctor_id", ""),
                            "diagnosis": item.get("diagnosis", ""),
                            "treatment": item.get("treatment", ""),
                        }
                    )
                rows.sort(key=lambda x: str(x.get("date", "")), reverse=True)
                rows = rows[:20]
                if rows:
                    return rows
            except Exception:
                pass
        return MOCK_HISTORY.get(patient_id, [])
