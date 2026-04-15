from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from random import Random
from typing import Dict, List


@dataclass
class DepartmentSeed:
    name: str
    doctors: int
    avg_service_minutes: int
    base_waiting: int
    floor: int


DEPARTMENT_SEEDS: List[DepartmentSeed] = [
    DepartmentSeed("Registration", 6, 5, 8, 1),
    DepartmentSeed("Lab", 7, 12, 24, 1),
    DepartmentSeed("Imaging", 5, 18, 15, 1),
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
    "Lab": "Lab",
    "Imaging": "Imaging",
    "Internal": "Internal",
    "ENT": "ENT",
    "Cardio": "Cardiology",
    "Neuro": "Neurology",
    "Ortho": "Orthopedics",
    "Pediatrics": "Pediatrics",
    "OBGYN": "OBGYN",
}

MEDICAL_PREREQUISITES = {
    "Internal": ["Lab"],
    "Cardiology": ["Lab", "Imaging"],
    "Neurology": ["Imaging"],
    "Orthopedics": ["Imaging"],
    "ENT": ["Lab"],
    "Oncology": ["Lab", "Imaging"],
    "OBGYN": ["Lab"],
}

TRAVEL_MINUTES = {
    ("Registration", "Lab"): 4,
    ("Lab", "Imaging"): 6,
    ("Imaging", "Internal"): 5,
    ("Internal", "Pharmacy"): 4,
}

EMR_MOCK = {
    "P001": {"patient_id": "P001", "orders": ["Lab", "Imaging", "Internal"]},
    "P002": {"patient_id": "P002", "orders": ["Lab", "ENT"]},
    "P003": {"patient_id": "P003", "orders": ["Lab", "Cardio"]},
}

PATIENT_STATE: Dict[str, Dict] = {
    "P001": {"current_step": "Lab", "completed": []},
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

