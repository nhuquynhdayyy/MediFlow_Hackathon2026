"""
optimizer.py — Smart Route Optimizer API
Endpoint chính cho tính lộ trình bệnh nhân.
Tích hợp: dependency graph + cost function + realtime load + patient profile.
"""

import unicodedata
from fastapi import APIRouter, Body
from typing import Any, Dict, List, Optional

from app.api.utils import (
    get_current_load_by_specialty,
    compute_department_sequence,
    DEPT_FLOOR_MAP,
    MEDICAL_PREREQUISITES,
    ALWAYS_LAST,
)

router = APIRouter()


def normalize_name(name: str) -> str:
    """Normalize tên khoa để fuzzy match (bỏ dấu, lowercase, strip)."""
    nfkd = unicodedata.normalize("NFKD", name.lower().strip())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def fuzzy_match_department(user_input: str, all_data: List[Dict]) -> Optional[Dict]:
    """
    Tìm khoa phù hợp nhất với input của user.
    Ưu tiên: exact > contains > partial word match.
    """
    norm_input = normalize_name(user_input)

    # 1. Exact match
    for item in all_data:
        if normalize_name(item["specialty"]) == norm_input:
            return item

    # 2. Contains match
    for item in all_data:
        if norm_input in normalize_name(item["specialty"]):
            return item

    # 3. Partial word match (bất kỳ từ nào trong input match)
    input_words = norm_input.split()
    best: Optional[Dict] = None
    best_score = 0
    for item in all_data:
        dept_norm = normalize_name(item["specialty"])
        score = sum(1 for w in input_words if w in dept_norm and len(w) >= 3)
        if score > best_score:
            best_score = score
            best = item

    return best if best_score > 0 else None
MEDICAL_ORDER = [
    "Sinh hóa",
    "Chẩn đoán hình ảnh"
]

def enforce_medical_order(route):
    priority = []
    rest = []

    for dep in route:
        if dep in MEDICAL_ORDER:
            priority.append(dep)
        else:
            rest.append(dep)

    return priority + rest

@router.post("/optimize-route")
def optimize_route(payload: Dict[str, Any] = Body(...)):
    """
    Tính lộ trình tối ưu cho bệnh nhân.

    Input:
    {
        "departments": ["Mắt", "Tai mũi họng", "Chẩn đoán hình ảnh"],
        "visited": ["Chẩn đoán hình ảnh"],   // optional: đã đi rồi
        "patient": {                            // optional: profile bệnh nhân
            "elderly": false,
            "wheelchair": false,
            "priority": "normal"               // normal | urgent | emergency
        }
    }

    Output:
    {
        "optimal_route": [...],
        "remaining_route": [...],   // chưa đi
        "visited": [...],
        "total_estimated_minutes": 75,
        "bottleneck": {...},
        "dependency_notes": [...],  // giải thích tại sao thứ tự này
        "reasoning": "...",
        "time_saved_vs_random": 0
    }
    """
    user_departments: List[str] = payload.get("departments", [])
    visited: List[str] = payload.get("visited", [])
    patient: Dict = payload.get("patient", {})

    if not user_departments:
        return {"error": "Vui lòng cung cấp danh sách khoa cần khám."}

    patient_elderly = bool(patient.get("elderly", False))
    patient_wheelchair = bool(patient.get("wheelchair", False))
    patient_priority = patient.get("priority", "normal")

    # 1. Lấy realtime load
    all_data = get_current_load_by_specialty()

    # 2. Match từng khoa user nhập với dữ liệu thực
    selected: List[Dict[str, Any]] = []
    not_found: List[str] = []

    for user_input in user_departments:
        matched = fuzzy_match_department(user_input, all_data)
        if matched:
            selected.append({
                "department": matched["specialty"],
                "current_load": matched["current_patients"],
                "capacity": matched["capacity"],
                "load_pct": matched["load_pct"],
                "wait_time": matched.get("wait_time", 10),
                "floor": matched.get("floor", DEPT_FLOOR_MAP.get(matched["specialty"], 1)),
            })
        else:
            not_found.append(user_input)

    if not selected:
        return {
            "error": "Không tìm thấy khoa nào trong hệ thống.",
            "not_found": not_found,
        }

    # 3. Tự động thêm prerequisites nếu chưa có trong danh sách
    auto_added: List[str] = []
    dept_names_selected = {d["department"] for d in selected}

    for dept_data in list(selected):
        dept = dept_data["department"]
        for prereq in MEDICAL_PREREQUISITES.get(dept, []):
            if prereq not in dept_names_selected and prereq not in visited:
                # Tìm prereq trong realtime data
                matched_prereq = fuzzy_match_department(prereq, all_data)
                if matched_prereq:
                    selected.append({
                        "department": matched_prereq["specialty"],
                        "current_load": matched_prereq["current_patients"],
                        "capacity": matched_prereq["capacity"],
                        "load_pct": matched_prereq["load_pct"],
                        "wait_time": matched_prereq.get("wait_time", 10),
                        "floor": matched_prereq.get("floor", DEPT_FLOOR_MAP.get(matched_prereq["specialty"], 1)),
                    })
                    dept_names_selected.add(matched_prereq["specialty"])
                    auto_added.append(f"{matched_prereq['specialty']} (cần thiết trước {dept})")

    # 4. Tính route tối ưu
    result = compute_department_sequence(
        selected,
        patient_elderly=patient_elderly,
        patient_wheelchair=patient_wheelchair,
    )

    optimal_route = result["route"]
    remaining_route = [d for d in optimal_route if d not in visited]

    # 5. Tính time_saved: so sánh với route đảo ngược (worst case)
    reversed_route = list(reversed(result["details"]))
    time_optimal = result.get("total_estimated_minutes", 0)
    time_reversed = sum(d["wait_time"] for d in reversed_route)
    time_saved = max(0, time_reversed - time_optimal)

    # 6. Sinh dependency notes để explain
    dependency_notes = _build_dependency_notes(optimal_route, dept_names_selected)

    # 7. Sinh reasoning text từ data (không cần gọi LLM cho optimizer)
    reasoning = _build_reasoning_text(
        result["details"],
        result.get("bottleneck"),
        patient_priority,
        auto_added,
    )

    response = {
        "optimal_route": optimal_route,
        "remaining_route": remaining_route,
        "visited": visited,
        "total_estimated_minutes": time_optimal,
        "bottleneck": result.get("bottleneck"),
        "dependency_notes": dependency_notes,
        "reasoning": reasoning,
        "time_saved_vs_worst": time_saved,
        "sequence_detail": result["sequence"],
    }

    if auto_added:
        response["auto_added_prerequisites"] = auto_added
    if not_found:
        response["not_found"] = not_found

    return {"status": "success", "data": response}


@router.post("/reroute")
def reroute(payload: Dict[str, Any] = Body(...)):
    """
    Re-optimize lộ trình dựa trên dữ liệu realtime MỚI NHẤT.
    Gọi khi bệnh nhân đã khám xong 1 khoa và cần điều chỉnh route còn lại.

    Input:
    {
        "remaining_departments": ["Tai mũi họng", "Nội tim mạch"],
        "visited": ["Chẩn đoán hình ảnh", "Mắt"],
        "patient": {...}
    }
    """
    remaining: List[str] = payload.get("remaining_departments", [])
    visited: List[str] = payload.get("visited", [])
    patient: Dict = payload.get("patient", {})

    if not remaining:
        return {
            "status": "success",
            "data": {
                "message": "Bệnh nhân đã hoàn thành tất cả các khoa!",
                "remaining_route": [],
                "visited": visited,
            }
        }

    # Re-optimize chỉ với remaining departments + fresh data
    return optimize_route({
        "departments": remaining,
        "visited": visited,
        "patient": patient,
    })


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def _build_dependency_notes(route: List[str], selected_names: set) -> List[str]:
    """Giải thích tại sao thứ tự này — để hiển thị cho bệnh nhân."""
    notes = []
    for i, dept in enumerate(route):
        prereqs_in_route = [
            p for p in MEDICAL_PREREQUISITES.get(dept, [])
            if p in selected_names and route.index(p) < i
        ]
        if prereqs_in_route:
            notes.append(
                f"{dept} đứng sau {', '.join(prereqs_in_route)} "
                f"vì bác sĩ cần kết quả từ đó trước khi khám."
            )
    return notes


def _build_reasoning_text(
    details: List[Dict],
    bottleneck: Optional[Dict],
    priority: str,
    auto_added: List[str],
) -> str:
    """Generate reasoning text không cần LLM."""
    parts = []

    if priority == "emergency":
        parts.append("⚠️ Ưu tiên KHẨN CẤP — đã tính lộ trình ngắn nhất.")
    elif priority == "urgent":
        parts.append("Ưu tiên CẤP THIẾT — các khoa nhanh nhất được xếp trước.")

    if details:
        fastest = min(details, key=lambda x: x["wait_time"])
        parts.append(
            f"Bắt đầu từ {fastest['department']} (chờ {fastest['wait_time']} phút) "
            f"để tận dụng thời gian."
        )

    if bottleneck:
        parts.append(
            f"Điểm tắc nghẽn: {bottleneck['department']} "
            f"({bottleneck['load_pct']}% tải, chờ ~{bottleneck['wait_time']} phút). "
            f"Cân nhắc đến đây sớm nhất có thể."
        )

    if auto_added:
        parts.append(f"Đã tự động thêm: {'; '.join(auto_added)}.")

    return " ".join(parts) if parts else "Lộ trình tối ưu theo thời gian chờ và dependency y tế."