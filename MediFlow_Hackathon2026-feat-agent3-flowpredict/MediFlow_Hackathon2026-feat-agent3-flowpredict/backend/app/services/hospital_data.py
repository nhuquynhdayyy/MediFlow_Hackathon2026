from copy import deepcopy
from typing import Dict, List


HOSPITAL_DATA: List[Dict] = [
    {"id": "internal-medicine", "name": "Internal Medicine", "zone": "East Wing", "floor": 3, "capacity": 120, "base_wait": 24, "hourly_pattern": {8: 70, 9: 90, 10: 82, 11: 60, 12: 52, 13: 66, 14: 74, 15: 68, 16: 56, 17: 42}},
    {"id": "cardiology", "name": "Cardiology", "zone": "East Wing", "floor": 4, "capacity": 90, "base_wait": 18, "hourly_pattern": {8: 58, 9: 72, 10: 78, 11: 65, 12: 48, 13: 60, 14: 76, 15: 74, 16: 61, 17: 44}},
    {"id": "neurology", "name": "Neurology", "zone": "North Wing", "floor": 5, "capacity": 70, "base_wait": 20, "hourly_pattern": {8: 40, 9: 52, 10: 60, 11: 58, 12: 46, 13: 50, 14: 64, 15: 67, 16: 59, 17: 41}},
    {"id": "orthopedics", "name": "Orthopedics", "zone": "North Wing", "floor": 2, "capacity": 85, "base_wait": 16, "hourly_pattern": {8: 42, 9: 54, 10: 61, 11: 57, 12: 45, 13: 53, 14: 66, 15: 71, 16: 58, 17: 39}},
    {"id": "pediatrics", "name": "Pediatrics", "zone": "South Wing", "floor": 3, "capacity": 100, "base_wait": 19, "hourly_pattern": {8: 64, 9: 75, 10: 79, 11: 68, 12: 51, 13: 57, 14: 63, 15: 69, 16: 55, 17: 43}},
    {"id": "dermatology", "name": "Dermatology", "zone": "West Wing", "floor": 2, "capacity": 60, "base_wait": 11, "hourly_pattern": {8: 28, 9: 34, 10: 46, 11: 39, 12: 31, 13: 36, 14: 47, 15: 44, 16: 37, 17: 25}},
    {"id": "ent", "name": "ENT", "zone": "West Wing", "floor": 2, "capacity": 70, "base_wait": 13, "hourly_pattern": {8: 36, 9: 48, 10: 56, 11: 52, 12: 40, 13: 49, 14: 57, 15: 63, 16: 54, 17: 33}},
    {"id": "ophthalmology", "name": "Ophthalmology", "zone": "West Wing", "floor": 3, "capacity": 80, "base_wait": 14, "hourly_pattern": {8: 44, 9: 53, 10: 59, 11: 51, 12: 38, 13: 45, 14: 55, 15: 57, 16: 46, 17: 29}},
    {"id": "radiology", "name": "Radiology", "zone": "Central Diagnostics", "floor": 1, "capacity": 65, "base_wait": 17, "hourly_pattern": {8: 52, 9: 67, 10: 74, 11: 58, 12: 44, 13: 51, 14: 60, 15: 64, 16: 50, 17: 36}},
    {"id": "laboratory", "name": "Laboratory", "zone": "Central Diagnostics", "floor": 1, "capacity": 90, "base_wait": 12, "hourly_pattern": {8: 55, 9: 63, 10: 71, 11: 50, 12: 34, 13: 42, 14: 53, 15: 56, 16: 43, 17: 31}},
    {"id": "ultrasound", "name": "Ultrasound", "zone": "Central Diagnostics", "floor": 1, "capacity": 50, "base_wait": 15, "hourly_pattern": {8: 48, 9: 61, 10: 69, 11: 52, 12: 37, 13: 46, 14: 54, 15: 59, 16: 45, 17: 30}},
    {"id": "pharmacy", "name": "Pharmacy", "zone": "Ground Hub", "floor": 1, "capacity": 110, "base_wait": 10, "hourly_pattern": {8: 35, 9: 47, 10: 58, 11: 49, 12: 40, 13: 44, 14: 51, 15: 55, 16: 46, 17: 34}},
    {"id": "emergency", "name": "Emergency", "zone": "Critical Care", "floor": 1, "capacity": 95, "base_wait": 27, "hourly_pattern": {8: 62, 9: 77, 10: 85, 11: 81, 12: 73, 13: 78, 14: 84, 15: 86, 16: 79, 17: 68}},
    {"id": "oncology", "name": "Oncology", "zone": "South Wing", "floor": 5, "capacity": 55, "base_wait": 21, "hourly_pattern": {8: 38, 9: 49, 10: 56, 11: 53, 12: 44, 13: 47, 14: 59, 15: 63, 16: 57, 17: 40}},
    {"id": "obgyn", "name": "Obstetrics & Gynecology", "zone": "South Wing", "floor": 4, "capacity": 75, "base_wait": 18, "hourly_pattern": {8: 51, 9: 66, 10: 73, 11: 59, 12: 42, 13: 55, 14: 67, 15: 71, 16: 60, 17: 45}},
    {"id": "rehab", "name": "Rehabilitation", "zone": "North Wing", "floor": 2, "capacity": 45, "base_wait": 14, "hourly_pattern": {8: 25, 9: 32, 10: 41, 11: 37, 12: 30, 13: 35, 14: 42, 15: 44, 16: 39, 17: 28}},
    {"id": "urology", "name": "Urology", "zone": "East Wing", "floor": 4, "capacity": 50, "base_wait": 16, "hourly_pattern": {8: 33, 9: 44, 10: 52, 11: 48, 12: 37, 13: 41, 14: 49, 15: 53, 16: 47, 17: 35}},
    {"id": "endocrinology", "name": "Endocrinology", "zone": "East Wing", "floor": 3, "capacity": 55, "base_wait": 15, "hourly_pattern": {8: 31, 9: 39, 10: 46, 11: 41, 12: 34, 13: 38, 14: 45, 15: 48, 16: 42, 17: 30}},
]

DEFAULT_NAVIGATION_DEPARTMENTS = ["Laboratory", "Radiology", "Internal Medicine", "Pharmacy"]
DEPENDENCY_RULES = {
    "Internal Medicine": ["Laboratory", "Radiology"],
    "Cardiology": ["Laboratory"],
    "Neurology": ["Radiology"],
    "Obstetrics & Gynecology": ["Ultrasound"],
    "Oncology": ["Laboratory"],
}


def status_from_load(load: int) -> str:
    if load < 50:
        return "green"
    if load <= 80:
        return "yellow"
    return "red"


def wait_time_from_load(base_wait: int, load: int) -> int:
    return max(6, round(base_wait + (load * 0.35)))


def get_department_snapshot(hour: int) -> List[Dict]:
    snapshot: List[Dict] = []
    for dept in deepcopy(HOSPITAL_DATA):
        load = dept["hourly_pattern"][hour]
        dept["current_load"] = load
        dept["wait_time"] = wait_time_from_load(dept["base_wait"], load)
        dept["status"] = status_from_load(load)
        snapshot.append(dept)
    return snapshot


def get_department_catalog(hour: int) -> List[Dict]:
    snapshot = get_department_snapshot(hour)
    return [
        {
            "id": dept["id"],
            "name": dept["name"],
            "zone": dept["zone"],
            "floor": dept["floor"],
            "capacity": dept["capacity"],
            "current_load": dept["current_load"],
            "wait_time": dept["wait_time"],
            "status": dept["status"],
            "hourly_pattern": dept["hourly_pattern"],
        }
        for dept in snapshot
    ]


def get_department_map(hour: int) -> Dict[str, Dict]:
    return {dept["name"]: dept for dept in get_department_snapshot(hour)}
