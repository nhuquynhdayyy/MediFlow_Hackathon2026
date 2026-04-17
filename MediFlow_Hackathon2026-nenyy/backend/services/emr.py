"""
EMR Service — Mock in-memory store
Production: thay bằng Firebase Firestore hoặc PostgreSQL
"""

import uuid
from datetime import datetime
from typing import Optional


# ── Mock patient queue (từ Agent 1 Triage gửi sang) ──────────────────────────
MOCK_PATIENTS = [
    {
        "id": "P001",
        "name": "Nguyễn Văn An",
        "age": 65,
        "gender": "Nam",
        "room": "K1",
        "visit_no": "2847",
        "chief_complaint": "Đau ngực kèm khó thở xuất hiện từ 2 ngày nay, đau tăng khi gắng sức",
        "history": "THA độ II (điều trị Amlodipine 5mg), ĐTĐ type 2",
        "symptoms": "Đau ngực trái lan vai trái, mức độ 7/10. SpO2: 96%. HA: 155/95 mmHg. Nhịp tim: 92 bpm. Khó thở khi gắng sức. Không sốt.",
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
        "name": "Trần Thị Bích",
        "age": 42,
        "gender": "Nữ",
        "room": "K2",
        "visit_no": "2848",
        "chief_complaint": "Đau đầu vùng trán, chóng mặt khi đứng dậy",
        "history": "Không có tiền sử bệnh nền",
        "symptoms": "Đau đầu âm ỉ 3/10, chóng mặt tư thế. HA: 110/70. Không sốt. Không buồn nôn.",
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
        "name": "Lê Hoàng Minh",
        "age": 28,
        "gender": "Nam",
        "room": "K1",
        "visit_no": "2849",
        "chief_complaint": "Ho lâu ngày khoảng 3 tuần, sốt nhẹ buổi chiều",
        "history": "Không có tiền sử",
        "symptoms": "Ho khan, đôi khi có đờm. Sốt nhẹ 37.8°C buổi chiều. Gầy 2kg trong 1 tháng.",
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
        "name": "Phạm Thị Lan",
        "age": 55,
        "gender": "Nữ",
        "room": "K3",
        "visit_no": "2850",
        "chief_complaint": "Tái khám đái tháo đường định kỳ 3 tháng",
        "history": "ĐTĐ type 2 (Metformin 500mg x2), THA nhẹ",
        "symptoms": "HbA1c: 7.2% (tháng trước 7.8%). HA: 130/80. Không triệu chứng mới.",
        "triage_severity": "low",
        "triage_source": "Agent1",
        "arrived_at": "2026-04-13T09:20:00",
        "diagnosis": "",
        "treatment_plan": "",
        "current_medications": ["Metformin 500mg", "Amlodipine 5mg"],
        "allergies": "Penicillin",
    },
]

# Mock EMR history (bệnh án cũ)
MOCK_HISTORY = {
    "P001": [
        {
            "visit_date": "2026-01-15",
            "chief_complaint": "Kiểm tra huyết áp định kỳ",
            "diagnosis": "THA độ II ổn định",
            "treatment": "Tiếp tục Amlodipine 5mg",
            "follow_up_date": "2026-04-15",
            "doctor": "BS. Nguyễn Minh Tuấn",
        }
    ],
    "P004": [
        {
            "visit_date": "2026-01-13",
            "chief_complaint": "Tái khám ĐTĐ",
            "diagnosis": "ĐTĐ type 2, HbA1c 7.8%",
            "treatment": "Tăng liều Metformin, chế độ ăn",
            "follow_up_date": "2026-04-13",
            "doctor": "BS. Lê Thu Hà",
        }
    ],
}

# In-memory EMR store (production: Firebase Firestore)
EMR_STORE: dict = {}


class EMRService:
    @staticmethod
    def get_patient_queue() -> list:
        return MOCK_PATIENTS

    @staticmethod
    def get_patient(patient_id: str) -> Optional[dict]:
        for p in MOCK_PATIENTS:
            if p["id"] == patient_id:
                return p
        return None

    @staticmethod
    def get_history(patient_id: str) -> list:
        return MOCK_HISTORY.get(patient_id, [])

    @staticmethod
    def save(req) -> str:
        emr_id = str(uuid.uuid4())[:8].upper()
        record = {
            "emr_id": emr_id,
            "patient_id": req.patient_id,
            "patient_name": req.patient_name,
            "chief_complaint": req.chief_complaint,
            "symptoms": req.symptoms,
            "history": req.history,
            "diagnosis": req.diagnosis,
            "treatment_plan": req.treatment_plan,
            "follow_up_date": req.follow_up_date,
            "prescriptions": req.prescriptions,
            "lab_orders": req.lab_orders,
            "notes": req.notes,
            "doctor_id": req.doctor_id,
            "soap": req.soap,
            "created_at": datetime.now().isoformat(),
            "status": "completed",
        }
        EMR_STORE[emr_id] = record
        # Update mock patient
        for p in MOCK_PATIENTS:
            if p["id"] == req.patient_id:
                p["diagnosis"] = req.diagnosis
                p["treatment_plan"] = req.treatment_plan
                break
        history_item = {
            "visit_date": datetime.now().date().isoformat(),
            "chief_complaint": req.chief_complaint,
            "diagnosis": req.diagnosis,
            "treatment": req.treatment_plan,
            "follow_up_date": req.follow_up_date,
            "doctor": req.doctor_id,
        }
        MOCK_HISTORY.setdefault(req.patient_id, []).insert(0, history_item)
        return emr_id
