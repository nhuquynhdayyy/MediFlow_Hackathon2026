"""EMR Service - Mock data (có thể thay bằng Firebase Firestore)."""
from datetime import datetime

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
        "medical_history": "Viêm dạ dày mãn 2021",
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
        {"date": "2024-12-10", "doctor": "BS. Trần Thị Mai", "diagnosis": "Viêm dạ dày cấp", "treatment": "Omeprazole 20mg x 4 tuần"},
        {"date": "2024-06-15", "doctor": "BS. Lê Văn Nam", "diagnosis": "Đau thượng vị do stress", "treatment": "Antacid + nghỉ ngơi"},
    ],
    "BN002": [
        {"date": "2025-01-20", "doctor": "BS. Phạm Văn Hùng", "diagnosis": "Migraine không có aura", "treatment": "Sumatriptan 50mg PRN"},
    ],
    "BN003": [
        {"date": "2024-09-05", "doctor": "BS. Nguyễn Thị Lan", "diagnosis": "Tăng huyết áp độ 1", "treatment": "Amlodipine 5mg"},
        {"date": "2024-03-12", "doctor": "BS. Vũ Minh Tuấn", "diagnosis": "Rối loạn lipid máu", "treatment": "Atorvastatin 20mg"},
    ],
}


class EMRService:
    def __init__(self):
        self._patients = {p["id"]: p for p in MOCK_PATIENTS}
        self._emr_updates = {}

    def get_all_patients(self) -> list:
        return list(self._patients.values())

    def get_patient(self, patient_id: str) -> dict | None:
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

    def get_history(self, patient_id: str) -> list:
        return MOCK_HISTORY.get(patient_id, [])
