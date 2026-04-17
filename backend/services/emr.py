"""EMR service with Firestore-first patient queue."""
from datetime import datetime
from typing import Optional

# Mock patient database
MOCK_PATIENTS = [
    {
        "id": "BN001",
        "name": "Nguyá»…n VÄƒn An",
        "age": 45,
        "gender": "Nam",
        "dob": "1979-03-15",
        "phone": "0901234567",
        "address": "123 LÃª Lá»£i, ÄÃ  Náºµng",
        "insurance": "BH1234567890",
        "chief_complaint": "Äau bá»¥ng vÃ¹ng thÆ°á»£ng vá»‹, buá»“n nÃ´n 3 ngÃ y",
        "symptoms": "Äau Ã¢m á»‰, tÄƒng sau Äƒn, á»£ chua, khÃ´ng sá»‘t",
        "medical_history": "ViÃªm dáº¡ dÃ y mÃ£n 2021",
        "allergies": "KhÃ´ng",
        "current_medications": "Omeprazole 20mg",
        "vital_signs": {"bp": "120/80", "hr": 78, "temp": 37.0, "spo2": 98},
        "department": "Khoa TiÃªu hÃ³a",
        "doctor": "BS. Tráº§n Thá»‹ Mai",
        "status": "waiting",
        "queue_number": 5,
    },
    {
        "id": "BN002",
        "name": "LÃª Thá»‹ BÃ¬nh",
        "age": 32,
        "gender": "Ná»¯",
        "dob": "1992-07-22",
        "phone": "0912345678",
        "address": "456 HÃ¹ng VÆ°Æ¡ng, ÄÃ  Náºµng",
        "insurance": "BH0987654321",
        "chief_complaint": "Äau Ä‘áº§u, chÃ³ng máº·t tÃ¡i phÃ¡t 1 tuáº§n",
        "symptoms": "Äau ná»­a Ä‘áº§u, buá»“n nÃ´n, sá»£ Ã¡nh sÃ¡ng",
        "medical_history": "Migraine tá»« 2020",
        "allergies": "Aspirin",
        "current_medications": "KhÃ´ng",
        "vital_signs": {"bp": "110/70", "hr": 82, "temp": 36.8, "spo2": 99},
        "department": "Khoa Tháº§n kinh",
        "doctor": "BS. Pháº¡m VÄƒn HÃ¹ng",
        "status": "in_consultation",
        "queue_number": 2,
    },
    {
        "id": "BN003",
        "name": "Tráº§n VÄƒn CÆ°á»ng",
        "age": 58,
        "gender": "Nam",
        "dob": "1966-11-10",
        "phone": "0923456789",
        "address": "789 Nguyá»…n Táº¥t ThÃ nh, ÄÃ  Náºµng",
        "insurance": "BH1122334455",
        "chief_complaint": "Há»“i há»™p, Ä‘au tá»©c ngá»±c khi gáº¯ng sá»©c",
        "symptoms": "Äau tá»©c ngá»±c lan ra vai trÃ¡i, khÃ³ thá»Ÿ nháº¹ khi leo cáº§u thang",
        "medical_history": "TÄƒng huyáº¿t Ã¡p, rá»‘i loáº¡n lipid mÃ¡u",
        "allergies": "KhÃ´ng",
        "current_medications": "Amlodipine 5mg, Atorvastatin 20mg",
        "vital_signs": {"bp": "145/90", "hr": 88, "temp": 37.2, "spo2": 96},
        "department": "Khoa Tim máº¡ch",
        "doctor": "BS. Nguyá»…n Thá»‹ Lan",
        "status": "waiting",
        "queue_number": 8,
    },
]

MOCK_HISTORY = {
    "BN001": [
        {"date": "2024-12-10", "doctor": "BS. Tráº§n Thá»‹ Mai", "diagnosis": "ViÃªm dáº¡ dÃ y cáº¥p", "treatment": "Omeprazole 20mg x 4 tuáº§n"},
        {"date": "2024-06-15", "doctor": "BS. LÃª VÄƒn Nam", "diagnosis": "Äau thÆ°á»£ng vá»‹ do stress", "treatment": "Antacid + nghá»‰ ngÆ¡i"},
    ],
    "BN002": [
        {"date": "2025-01-20", "doctor": "BS. Pháº¡m VÄƒn HÃ¹ng", "diagnosis": "Migraine khÃ´ng cÃ³ aura", "treatment": "Sumatriptan 50mg PRN"},
    ],
    "BN003": [
        {"date": "2024-09-05", "doctor": "BS. Nguyá»…n Thá»‹ Lan", "diagnosis": "TÄƒng huyáº¿t Ã¡p Ä‘á»™ 1", "treatment": "Amlodipine 5mg"},
        {"date": "2024-03-12", "doctor": "BS. VÅ© Minh Tuáº¥n", "diagnosis": "Rá»‘i loáº¡n lipid mÃ¡u", "treatment": "Atorvastatin 20mg"},
    ],
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
        if patient_id not in self._emr_updates:
            self._emr_updates[patient_id] = {}
        self._emr_updates[patient_id].update({
            **emr_data,
            "updated_at": datetime.now().isoformat(),
        })
        if self._firebase_available:
            try:
                payload = {
                    "patient_id": patient_id,
                    "doctor_id": emr_data.get("doctor_id", "DR001"),
                    "diagnosis": emr_data.get("preliminary_diagnosis") or emr_data.get("diagnosis", ""),
                    "treatment": emr_data.get("treatment_plan", ""),
                    "record_date": datetime.now().isoformat(),
                    "emr_data": emr_data,
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

