from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from random import Random
from typing import Dict, List

from app.services.lab_data import LAB_DATABASE, TEST_DB


@dataclass
class DepartmentSeed:
    name: str
    doctors: int
    avg_service_minutes: int
    base_waiting: int
    floor: int


DEPARTMENT_SEEDS: List[DepartmentSeed] = [
    DepartmentSeed("Registration", 6, 5, 8, 1),
    DepartmentSeed("Internal", 8, 16, 18, 2),
    DepartmentSeed("ENT", 4, 15, 12, 2),
    DepartmentSeed("Cardiology", 6, 20, 17, 5),
    DepartmentSeed("Neurology", 5, 22, 14, 4),
    DepartmentSeed("Orthopedics", 6, 17, 13, 3),
    DepartmentSeed("Gastroenterology", 4, 19, 11, 2),
    DepartmentSeed("Pulmonology", 4, 16, 10, 3),
    DepartmentSeed("Endocrinology", 3, 17, 10, 3),
    DepartmentSeed("Nephrology", 3, 18, 9, 3),
    DepartmentSeed("Oncology", 4, 24, 12, 5),
    DepartmentSeed("Pediatrics", 6, 14, 16, 3),
    DepartmentSeed("OBGYN", 5, 18, 11, 4),
    DepartmentSeed("Dermatology", 3, 11, 9, 2),
    DepartmentSeed("Rehabilitation", 4, 20, 8, 1),
    DepartmentSeed("Pharmacy", 8, 7, 20, 1),
]

ORDER_TO_DEPARTMENT = {
    "Internal": "Internal",
    "ENT": "ENT",
    "Cardio": "Cardiology",
    "Neuro": "Neurology",
    "Ortho": "Orthopedics",
    "Pediatrics": "Pediatrics",
    "OBGYN": "OBGYN",
}
# Dynamically map tests to Lab or Imaging based on category
for test_name, info in TEST_DB.items():
    if info.get("category") == "Chẩn đoán hình ảnh":
        ORDER_TO_DEPARTMENT[test_name] = "Imaging"
    else:
        ORDER_TO_DEPARTMENT[test_name] = "Lab"

MEDICAL_PREREQUISITES = {
    "Internal": ["Công thức máu toàn phần (CBC)", "AST (SGOT)"],
    "Cardiology": ["Đường huyết lúc đói (FBS)", "Điện tâm đồ (ECG)"],
    "Neurology": ["MRI não"],
    "Orthopedics": ["X-quang khớp"],
    "ENT": ["Công thức máu toàn phần (CBC)"],
    "Oncology": ["Sinh hóa", "Chẩn đoán hình ảnh"],
    "OBGYN": ["Beta-hCG định lượng", "Siêu âm thai"],
}

TRAVEL_MINUTES = {
    ("Registration", "Lab"): 4,
    ("Lab", "Imaging"): 6,
    ("Imaging", "Internal"): 5,
    ("Internal", "Pharmacy"): 4,
}

EMR_MOCK = {
    "P001": {"patient_id": "P001", "orders": ["Công thức máu toàn phần (CBC)", "AST (SGOT)", "Điện tâm đồ (ECG)", "Internal"]},
    "P002": {"patient_id": "P002", "orders": ["Xét nghiệm phân (tìm máu ẩn)", "Nội soi dạ dày (Gastroscopy)", "ENT"]},
    "P003": {"patient_id": "P003", "orders": ["Đường huyết lúc đói (FBS)", "HbA1c", "Cardio"]},
}

PATIENT_STATE: Dict[str, Dict] = {
    "P001": {"current_step": "Registration", "completed": []},
    "P002": {"current_step": "Registration", "completed": []},
    "P003": {"current_step": "Registration", "completed": []},
}

HOURLY_PATTERN = {
    8: 1.35,
    9: 1.65,
    10: 1.6,
    11: 1.3,
    12: 1.0,
    13: 0.95,
    14: 1.05,
    15: 1.12,
    16: 1.0,
    17: 0.8,
}


def get_departments_snapshot(hour_offset: int = 0) -> List[Dict]:
    now_hour = (datetime.now().hour + hour_offset) % 24
    pattern = HOURLY_PATTERN.get(now_hour, 0.75)
    rng = Random(now_hour + 2026)
    rows: List[Dict] = []
    
    # Simple block mapping for generic departments not in TEST_DB
    seed_blocks = {
        "Registration": "A1 (Khác)",
        "Internal": "A1 (Nội tổng quát)",
        "Cardiology": "A1 (Nội tổng quát)",
        "Neurology": "A1 (Nội tổng quát)",
        "Gastroenterology": "A1 (Nội tổng quát)",
        "Pulmonology": "A1 (Nội tổng quát)",
        "Endocrinology": "A1 (Nội tổng quát)",
        "Nephrology": "A1 (Nội tổng quát)",
        "Oncology": "A1 (Nội tổng quát)",
        "ENT": "A1 (Nội tổng quát)",
        "Dermatology": "A1 (Nội tổng quát)",
        
        "Lab": "B1 (Cận lâm sàng)",
        "Imaging": "B1 (Cận lâm sàng)",
        "Pharmacy": "B1 (Cận lâm sàng)",
        
        "Orthopedics": "C1 (Sản/Nhi/Khác)",
        "Rehabilitation": "C1 (Sản/Nhi/Khác)",
        "Pediatrics": "C1 (Sản/Nhi/Khác)",
        "OBGYN": "C1 (Sản/Nhi/Khác)"
    }
    
    for seed in DEPARTMENT_SEEDS:
        jitter = 0.85 + rng.random() * 0.35
        waiting = int(seed.base_waiting * pattern * jitter)
        in_service = max(1, int(seed.doctors * (0.75 + rng.random() * 0.25)))
        # Hackathon scenario: Internal overloaded at 9h, lower at 11h
        if seed.name == "Internal":
            if now_hour == 9:
                waiting = max(waiting, 45)
            if now_hour == 11:
                waiting = min(waiting, 20)
        rows.append(
            {
                "department": seed.name,
                "waiting": waiting,
                "in_service": in_service,
                "doctors": seed.doctors,
                "avg_service_minutes": seed.avg_service_minutes,
                "floor": seed.floor,
                "block": seed_blocks.get(seed.name, "A1 (Khác)"),
            }
        )
    
    # Add dynamic lab departments
    for test_name, info in TEST_DB.items():
        jitter = 0.85 + rng.random() * 0.35
        cat = info.get("category", "")
        if cat == "Chẩn đoán hình ảnh":
            base_wait = 25
        elif ORDER_TO_DEPARTMENT.get(test_name) == "Lab":
            base_wait = 8
        else:
            base_wait = 15
            
        waiting = int(base_wait * pattern * jitter)
        in_service = max(1, int(3 * (0.75 + rng.random() * 0.25)))
        rows.append(
            {
                "department": test_name,
                "waiting": waiting,
                "in_service": in_service,
                "doctors": 3,
                "avg_service_minutes": 10,
                "floor": info.get("floor", 1),
                "block": info.get("block", "A1 (Khác)"),
                "category": info.get("category", "General")
            }
        )

    return rows


def get_emr_orders(patient_id: str) -> Dict:
    return deepcopy(EMR_MOCK.get(patient_id, {"patient_id": patient_id, "orders": ["Lab", "Internal"]}))


def update_patient_state(patient_id: str, completed_step: str, current_step: str | None) -> Dict:
    current = PATIENT_STATE.setdefault(patient_id, {"current_step": None, "completed": []})
    if completed_step and completed_step not in current["completed"]:
        current["completed"].append(completed_step)
    if current_step is not None:
        current["current_step"] = current_step
    return deepcopy(current)


def get_patient_state(patient_id: str) -> Dict:
    return deepcopy(PATIENT_STATE.setdefault(patient_id, {"current_step": None, "completed": []}))

