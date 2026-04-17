"""
validator.py — Route validation
Kiểm tra lộ trình hợp lệ: tất cả khoa trong route phải là subset của
(user_departments + auto-added prerequisites).
"""
from typing import List
from app.api.utils import MEDICAL_PREREQUISITES


def validate_route(route: List[str], user_departments: List[str]) -> bool:
    """
    Route hợp lệ nếu mỗi khoa trong route là:
    1. Thuộc user_departments, HOẶC
    2. Là prerequisite hợp lệ của một khoa trong user_departments
    """
    if not route:
        return False

    # Tập hợp tất cả khoa được phép (user + prerequisites)
    allowed = set(user_departments)

    for dept in user_departments:
        for prereq in MEDICAL_PREREQUISITES.get(dept, []):
            allowed.add(prereq)

    for dept in route:
        if dept not in allowed:
            return False

    return True