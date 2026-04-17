"""
utils.py — FlowPredict Core Engine
Mọi logic thông minh nằm ở đây: dependency, cost function, optimizer, forecast, prompts.
"""

from collections import Counter, defaultdict, deque
from datetime import datetime, timedelta
import math
import random
from typing import Any, Dict, List, Optional, Tuple

from app.services.firebase import fetch_collection

# ---------------------------------------------------------------------------
# CONSTANTS
# ---------------------------------------------------------------------------

SPECIALTIES = [
    "Khám bệnh - Cấp cứu", "Hồi sức tích cực chống độc", "Phẫu thuật - gây mê",
    "Nội thần kinh - Cơ xương khớp", "Nội thận - Nội tiết", "Nội hô hấp – miễn dịch",
    "Nội tiêu hóa – Gan mật", "Nội tim mạch", "Nội tổng hợp", "Khoa Lão",
    "Ngoại lồng ngực", "Ngoại can thiệp tim mạch", "Ngoại chấn thương chỉnh hình",
    "Ngoại thần kinh", "Ngoại tiết niệu", "Ngoại tiêu hóa", "Ngoại bỏng tạo hình", "Ngoại tổng hợp",
    "Mắt", "Răng hàm mặt", "Tai mũi họng", "Đông y", "Phục hồi chức năng", "Phụ sản",
    "Thận nhân tạo", "Y học nhiệt đới", "Y học hạt nhân", "Ung bướu",
    "Sinh hóa", "Huyết học - truyền máu", "Giải phẫu bệnh", "Vi sinh", "Thăm dò chức năng",
    "Chẩn đoán hình ảnh", "Dược", "Dinh dưỡng", "Kiểm soát nhiễm khuẩn",
]

CAPACITY_MAP = {
    "Khám bệnh - Cấp cứu": 150, "Hồi sức tích cực chống độc": 40, "Phẫu thuật - gây mê": 60,
    "Nội thần kinh - Cơ xương khớp": 80, "Nội thận - Nội tiết": 70, "Nội hô hấp – miễn dịch": 90,
    "Nội tiêu hóa – Gan mật": 85, "Nội tim mạch": 100, "Nội tổng hợp": 120, "Khoa Lão": 60,
    "Ngoại lồng ngực": 40, "Ngoại can thiệp tim mạch": 50, "Ngoại chấn thương chỉnh hình": 80,
    "Ngoại thần kinh": 50, "Ngoại tiết niệu": 60, "Ngoại tiêu hóa": 70,
    "Ngoại bỏng tạo hình": 40, "Ngoại tổng hợp": 100,
    "Mắt": 60, "Răng hàm mặt": 50, "Tai mũi họng": 70, "Đông y": 40,
    "Phục hồi chức năng": 50, "Phụ sản": 120,
    "Thận nhân tạo": 40, "Y học nhiệt đới": 60, "Y học hạt nhân": 30, "Ung bướu": 80,
    "Sinh hóa": 100, "Huyết học - truyền máu": 80, "Giải phẫu bệnh": 40,
    "Vi sinh": 50, "Thăm dò chức năng": 70,
    "Chẩn đoán hình ảnh": 150, "Dược": 200, "Dinh dưỡng": 40, "Kiểm soát nhiễm khuẩn": 30,
}

# Tầng của từng khoa trong bệnh viện — dùng để tính floor_penalty
DEPT_FLOOR_MAP: Dict[str, int] = {
    "Khám bệnh - Cấp cứu": 1, "Hồi sức tích cực chống độc": 1, "Phẫu thuật - gây mê": 2,
    "Nội thần kinh - Cơ xương khớp": 4, "Nội thận - Nội tiết": 3, "Nội hô hấp – miễn dịch": 3,
    "Nội tiêu hóa – Gan mật": 2, "Nội tim mạch": 5, "Nội tổng hợp": 1, "Khoa Lão": 4,
    "Ngoại lồng ngực": 4, "Ngoại can thiệp tim mạch": 4, "Ngoại chấn thương chỉnh hình": 3,
    "Ngoại thần kinh": 4, "Ngoại tiết niệu": 3, "Ngoại tiêu hóa": 3,
    "Ngoại bỏng tạo hình": 2, "Ngoại tổng hợp": 3,
    "Nhi": 3, "Khoa Nhi": 3, "Tim mạch": 5, "Thần kinh": 4, "Tiêu hóa": 2, "Nội tổng quát": 1,
    "Mắt": 2, "Răng hàm mặt": 2, "Tai mũi họng": 2, "Đông y": 1,
    "Phục hồi chức năng": 1, "Phụ sản": 5,
    "Thận nhân tạo": 2, "Y học nhiệt đới": 2, "Y học hạt nhân": 1, "Ung bướu": 5,
    "Sinh hóa": 1, "Huyết học - truyền máu": 1, "Giải phẫu bệnh": 1,
    "Vi sinh": 1, "Thăm dò chức năng": 2,
    "Chẩn đoán hình ảnh": 1, "Dược": 1, "Dinh dưỡng": 1, "Kiểm soát nhiễm khuẩn": 1,
}

# ---------------------------------------------------------------------------
# MEDICAL DEPENDENCY GRAPH
# Key = khoa cần kết quả trước, Value = list các khoa phải đến SAU
# Ý nghĩa: trước khi đến khoa X, bệnh nhân cần đi các khoa trong prerequisites[X]
# ---------------------------------------------------------------------------
MEDICAL_PREREQUISITES: Dict[str, List[str]] = {
    "Nội tim mạch":                    ["Chẩn đoán hình ảnh", "Thăm dò chức năng", "Sinh hóa"],
    "Ngoại can thiệp tim mạch":        ["Chẩn đoán hình ảnh", "Sinh hóa", "Huyết học - truyền máu"],
    "Ngoại chấn thương chỉnh hình":    ["Chẩn đoán hình ảnh"],
    "Ngoại lồng ngực":                 ["Chẩn đoán hình ảnh", "Thăm dò chức năng"],
    "Ngoại thần kinh":                 ["Chẩn đoán hình ảnh"],
    "Ngoại tiết niệu":                 ["Chẩn đoán hình ảnh", "Sinh hóa"],
    "Ngoại tiêu hóa":                  ["Chẩn đoán hình ảnh", "Sinh hóa"],
    "Ngoại bỏng tạo hình":             ["Sinh hóa", "Huyết học - truyền máu"],
    "Nội thần kinh - Cơ xương khớp":  ["Chẩn đoán hình ảnh"],
    "Nội thận - Nội tiết":             ["Sinh hóa"],
    "Nội hô hấp – miễn dịch":          ["Thăm dò chức năng", "Chẩn đoán hình ảnh"],
    "Nội tiêu hóa – Gan mật":          ["Sinh hóa", "Chẩn đoán hình ảnh"],
    "Ung bướu":                        ["Sinh hóa", "Giải phẫu bệnh", "Chẩn đoán hình ảnh"],
    "Phẫu thuật - gây mê":             ["Sinh hóa", "Huyết học - truyền máu", "Chẩn đoán hình ảnh"],
    "Y học hạt nhân":                  ["Chẩn đoán hình ảnh"],
    "Dược":                            [],  # Dược luôn đến CUỐI — xử lý riêng ở optimizer
}

# Các khoa luôn phải đến cuối cùng (sau khi đã khám xong)
ALWAYS_LAST = {"Dược", "Dinh dưỡng"}

# ---------------------------------------------------------------------------
# REALISTIC HOURLY LOAD PATTERN (Vietnam hospital)
# Dựa trên pattern thực tế bệnh viện VN — tỷ lệ so với baseline
# ---------------------------------------------------------------------------
HOURLY_LOAD_PATTERN: Dict[int, float] = {
    0: 0.20, 1: 0.18, 2: 0.15, 3: 0.14, 4: 0.14, 5: 0.18,
    6: 0.40, 7: 1.00, 8: 1.80, 9: 2.00, 10: 1.90, 11: 1.70,
    12: 1.30, 13: 1.10, 14: 1.60, 15: 1.70, 16: 1.40, 17: 1.00,
    18: 0.70, 19: 0.50, 20: 0.40, 21: 0.30, 22: 0.25, 23: 0.22,
}

STATUS_ORDER = ["waiting", "in_progress", "completed"]


# ---------------------------------------------------------------------------
# FIREBASE / DATA LAYER
# ---------------------------------------------------------------------------

def get_patient_sessions() -> List[Dict[str, Any]]:
    sessions = fetch_collection("triage_sessions")
    if not sessions:
        sessions = fetch_collection("doctor_sessions")
    return sessions or []


def get_today_counts() -> Dict[str, Any]:
    sessions = get_patient_sessions()
    totals = {"waiting": 0, "in_progress": 0, "completed": 0}
    for session in sessions:
        status = (session.get("status") or "waiting").lower()
        if status not in totals:
            status = "waiting"
        totals[status] += 1
    return {
        "total_patients": sum(totals.values()),
        "waiting": totals["waiting"],
        "in_progress": totals["in_progress"],
        "completed": totals["completed"],
    }


def get_patient_count_by_specialty() -> List[Dict[str, Any]]:
    sessions = get_patient_sessions()
    counter: Counter = Counter()
    for session in sessions:
        specialty = session.get("specialty") or "Khác"
        counter[specialty] += 1

    result = [
        {"specialty": s, "patient_count": c}
        for s, c in counter.most_common()
    ]
    if not result:
        for specialty in SPECIALTIES:
            result.append({"specialty": specialty, "patient_count": random.randint(10, 40)})
    return result


def get_current_load_by_specialty() -> List[Dict[str, Any]]:
    sessions = get_patient_sessions()
    active = [s for s in sessions if s.get("status") in ("waiting", "in_progress")]
    counter: Counter = Counter()
    for session in active:
        specialty = session.get("specialty") or "Khác"
        counter[specialty] += 1

    data = []
    for specialty in SPECIALTIES:
        current = counter.get(specialty, 0)
        capacity = CAPACITY_MAP.get(specialty, 50)
        load_pct = round(min(100.0, current / capacity * 100), 1)
        wait_time = _estimate_wait_time(load_pct)
        data.append({
            "specialty": specialty,
            "current_patients": current,
            "capacity": capacity,
            "load_pct": load_pct,
            "wait_time": wait_time,
            "floor": DEPT_FLOOR_MAP.get(specialty, 1),
        })

    for specialty, count in counter.items():
        if specialty not in SPECIALTIES:
            capacity = CAPACITY_MAP.get(specialty, max(45, count + 20))
            load_pct = round(min(100.0, count / capacity * 100), 1)
            data.append({
                "specialty": specialty,
                "current_patients": count,
                "capacity": capacity,
                "load_pct": load_pct,
                "wait_time": _estimate_wait_time(load_pct),
                "floor": DEPT_FLOOR_MAP.get(specialty, 1),
            })

    return sorted(data, key=lambda x: x["load_pct"], reverse=True)


def _estimate_wait_time(load_pct: float) -> int:
    """
    Ước tính thời gian chờ dựa trên % tải — phi tuyến.
    0-50%: 5-15 phút | 50-85%: 15-40 phút | 85-100%: 40-90 phút
    """
    if load_pct <= 50:
        return int(5 + load_pct * 0.2)
    elif load_pct <= 85:
        return int(15 + (load_pct - 50) * 0.71)
    else:
        return int(40 + (load_pct - 85) ** 1.5)


# ---------------------------------------------------------------------------
# SMART COST FUNCTION
# ---------------------------------------------------------------------------

def compute_dept_cost(
    dept: Dict[str, Any],
    current_hour: int,
    patient_elderly: bool = False,
    patient_wheelchair: bool = False,
) -> float:
    """
    Cost càng thấp → ưu tiên đến trước trong cùng dependency level.

    Thành phần:
    - wait_time       : thực tế (phút) — trọng số cao nhất
    - load_factor     : phi tuyến, tăng mạnh khi >85%
    - forecast_surge  : dự báo tăng 1h tới theo pattern bệnh viện VN
    - floor_penalty   : penalty nếu bệnh nhân cao tuổi/xe lăn mà khoa ở tầng cao
    """
    load = dept.get("load_pct", 0)
    wait = dept.get("wait_time", 0)

    # Phi tuyến: vượt 85% thì penalty tăng nhanh
    if load <= 85:
        load_factor = load
    else:
        load_factor = load + (load - 85) ** 1.6

    # Forecast: nếu 1h tới sẽ đông hơn → tăng cost ngay bây giờ
    next_hour = (current_hour + 1) % 24
    cur_pattern = HOURLY_LOAD_PATTERN.get(current_hour, 1.0)
    nxt_pattern = HOURLY_LOAD_PATTERN.get(next_hour, 1.0)
    if cur_pattern > 0:
        surge_ratio = nxt_pattern / cur_pattern
        forecast_surge = max(0.0, load * (surge_ratio - 1.0) * 20)  # scale → phút
    else:
        forecast_surge = 0.0

    # Floor penalty: mỗi tầng thêm = +5 phút với bệnh nhân cần hỗ trợ
    floor = dept.get("floor", DEPT_FLOOR_MAP.get(dept.get("specialty", dept.get("department", "")), 1))
    floor_penalty = 0.0
    if (patient_elderly or patient_wheelchair) and floor > 1:
        floor_penalty = (floor - 1) * 5.0

    cost = (
        wait * 1.0
        + load_factor * 0.30
        + forecast_surge * 0.50
        + floor_penalty
    )
    return round(cost, 2)


# ---------------------------------------------------------------------------
# TOPOLOGICAL ROUTE OPTIMIZER (Kahn's algorithm + cost-aware)
# ---------------------------------------------------------------------------

def compute_department_sequence(
    departments: List[Dict[str, Any]],
    patient_elderly: bool = False,
    patient_wheelchair: bool = False,
) -> Dict[str, Any]:
    """
    Tính lộ trình tối ưu có tính đến:
    1. Medical dependency (xét nghiệm / chụp chiếu trước khám chuyên sâu)
    2. Cost function thông minh (wait + load_phi_tuyen + forecast + floor)
    3. Dược/Dinh dưỡng luôn đến cuối
    4. Fallback về sort đơn giản nếu không có đủ dữ liệu
    """
    if not departments:
        return {"route": [], "sequence": [], "details": [], "bottleneck": None}

    current_hour = datetime.now().hour

    # Normalize input
    normalized: List[Dict[str, Any]] = []
    for item in departments:
        dept_name = item.get("department") or item.get("specialty") or "Không tên"
        current_load = float(item.get("current_load", item.get("current_patients", 0)) or 0)
        capacity = float(item.get("capacity", 1) or 1)
        load_pct = item.get("load_pct") or round(min(100.0, current_load / capacity * 100), 1)
        wait_time = item.get("wait_time") or _estimate_wait_time(load_pct)
        floor = item.get("floor", DEPT_FLOOR_MAP.get(dept_name, 1))

        d = {
            "department": dept_name,
            "current_load": int(current_load),
            "capacity": int(capacity),
            "load_pct": load_pct,
            "wait_time": int(wait_time),
            "floor": floor,
        }
        d["cost"] = compute_dept_cost(d, current_hour, patient_elderly, patient_wheelchair)
        normalized.append(d)

    dept_names = {d["department"] for d in normalized}
    dept_by_name = {d["department"]: d for d in normalized}

    # Tách nhóm cuối
    last_group = [d for d in normalized if d["department"] in ALWAYS_LAST]
    main_group = [d for d in normalized if d["department"] not in ALWAYS_LAST]

    # Build dependency graph (chỉ trong phạm vi selected depts)
    in_degree: Dict[str, int] = defaultdict(int)
    graph: Dict[str, List[str]] = defaultdict(list)

    for dept_data in main_group:
        dept = dept_data["department"]
        prereqs = [
            p for p in MEDICAL_PREREQUISITES.get(dept, [])
            if p in dept_names and p not in ALWAYS_LAST
        ]
        for prereq in prereqs:
            graph[prereq].append(dept)
            in_degree[dept] += 1

    # Kahn's algorithm — trong mỗi frontier, sort theo cost
    frontier = sorted(
        [d for d in main_group if in_degree[d["department"]] == 0],
        key=lambda x: x["cost"],
    )
    queue: deque = deque(frontier)
    ordered: List[Dict[str, Any]] = []

    while queue:
        item = queue.popleft()
        ordered.append(item)
        neighbors = sorted(
            [dept_by_name[n] for n in graph[item["department"]] if n in dept_by_name],
            key=lambda x: x["cost"],
        )
        for neighbor in neighbors:
            in_degree[neighbor["department"]] -= 1
            if in_degree[neighbor["department"]] == 0:
                queue.append(neighbor)

    # Nếu có cycle / node không kết nối được → thêm vào cuối theo cost
    remaining = [d for d in main_group if d not in ordered]
    remaining.sort(key=lambda x: x["cost"])
    ordered.extend(remaining)

    # Dược / Dinh dưỡng luôn cuối
    last_group.sort(key=lambda x: x["cost"])
    ordered.extend(last_group)

    route = [d["department"] for d in ordered]

    # Bottleneck = khoa có cost cao nhất
    bottleneck = max(ordered, key=lambda x: x["cost"]) if ordered else None

    sequence_lines = [
        f"{i+1}. {d['department']}: chờ ~{d['wait_time']} phút, "
        f"tải {d['load_pct']}% ({d['current_load']}/{d['capacity']}), "
        f"tầng {d['floor']}"
        for i, d in enumerate(ordered)
    ]

    return {
        "route": route,
        "sequence": sequence_lines,
        "details": ordered,
        "bottleneck": {
            "department": bottleneck["department"],
            "wait_time": bottleneck["wait_time"],
            "load_pct": bottleneck["load_pct"],
        } if bottleneck else None,
        "total_estimated_minutes": sum(d["wait_time"] for d in ordered),
    }


# ---------------------------------------------------------------------------
# REALISTIC FORECAST (pattern-based, không dùng random thuần)
# ---------------------------------------------------------------------------

def build_forecast_points() -> List[Dict[str, Any]]:
    """
    Forecast dựa trên:
    1. Base load từ dữ liệu realtime hiện tại
    2. Nhân với hourly pattern bệnh viện VN
    3. Thêm noise nhỏ ±5% cho realistic
    """
    load_data = get_current_load_by_specialty()
    if load_data:
        base_load = sum(d["load_pct"] for d in load_data) / len(load_data)
    else:
        base_load = 40.0
    base_load = max(20.0, min(90.0, base_load))

    now = datetime.now()
    current_hour = now.hour
    current_pattern = HOURLY_LOAD_PATTERN.get(current_hour, 1.0)

    points: List[Dict[str, Any]] = []
    for offset in range(24):
        ts = now + timedelta(hours=offset)
        hour = ts.hour
        pattern = HOURLY_LOAD_PATTERN.get(hour, 0.5)

        # Tỷ lệ thay đổi so với giờ hiện tại
        ratio = pattern / current_pattern if current_pattern > 0 else 1.0
        predicted = base_load * ratio

        # Noise nhỏ ±5% (không random hoàn toàn như cũ)
        noise = base_load * random.uniform(-0.05, 0.05)
        value = round(max(10.0, min(99.0, predicted + noise)), 1)

        # Cảnh báo mức
        if value >= 90:
            alert_level = "critical"
        elif value >= 75:
            alert_level = "warning"
        else:
            alert_level = "normal"

        points.append({
            "hour": ts.strftime("%H:%M"),
            "load_pct": value,
            "expected_patients": int(max(10, value * 1.2)),
            "alert_level": alert_level,
        })

    return points


def get_forecast_summary() -> Dict[str, Any]:
    points = build_forecast_points()
    peak = max(points, key=lambda x: x["load_pct"])
    trough = min(points, key=lambda x: x["load_pct"])
    return {
        "forecast": points,
        "threshold_pct": 85,
        "peak_hour": peak["hour"],
        "peak_load_pct": peak["load_pct"],
        "trough_hour": trough["hour"],
        "trough_load_pct": trough["load_pct"],
        "last_updated": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# SMART ALERT PROMPT (với phân tích tự động trước khi gửi LLM)
# ---------------------------------------------------------------------------

def build_alert_prompt(
    load_data: List[Dict[str, Any]],
    forecast_data: List[Dict[str, Any]],
) -> str:
    """
    Phân tích tự động trước để LLM tập trung vào insight, không tóm tắt lại số.
    """
    # Pre-analysis
    critical = [d for d in load_data if d.get("load_pct", 0) >= 90]
    warning = [d for d in load_data if 75 <= d.get("load_pct", 0) < 90]

    # Forecast trend
    if len(forecast_data) >= 3:
        loads = [p.get("load_pct", 0) for p in forecast_data[:6]]
        avg_now = sum(loads[:2]) / 2
        avg_later = sum(loads[3:6]) / 3
        trend = "tăng" if avg_later > avg_now + 5 else ("giảm" if avg_later < avg_now - 5 else "ổn định")
    else:
        trend = "chưa đủ dữ liệu"

    lines = [
        "Bạn là FlowPredict Agent — trợ lý vận hành bệnh viện.",
        "DỮ LIỆU PHÂN TÍCH ĐÃ XỬ LÝ:",
        f"- Khoa NGUY HIỂM (>=90%): {', '.join(d['specialty'] for d in critical) or 'Không có'}",
        f"- Khoa CẢNH BÁO (75-89%): {', '.join(d['specialty'] for d in warning) or 'Không có'}",
        f"- Xu hướng tải 3h tới: {trend}",
        "",
        "DỮ LIỆU CHI TIẾT:",
    ]
    for item in sorted(load_data, key=lambda x: -x.get("load_pct", 0))[:10]:
        lines.append(
            f"- {item['specialty']}: {item['current_patients']}/{item['capacity']} "
            f"({item['load_pct']}%)"
        )

    lines += [
        "",
        "DỰ BÁO 6h tới (mỗi giờ):",
    ]
    for p in forecast_data[:6]:
        lvl = p.get("alert_level", "")
        lines.append(f"- {p['hour']}: {p['load_pct']}% [{lvl}]")

    lines += [
        "",
        "YÊU CẦU: Dựa trên phân tích trên, trả về JSON:",
        "{",
        '  "alert": "Cảnh báo ngắn gọn 1-2 câu, nêu rõ khoa nào nguy hiểm nhất và tại sao",',
        '  "recommendations": ["Hành động cụ thể 1 (ai làm gì, ở đâu)", "Hành động cụ thể 2"]',
        "}",
        "Không tóm tắt lại số liệu. Tập trung vào quyết định hành động.",
    ]
    return "\n".join(lines)


def build_hospital_operations_prompt(
    message: str,
    load_data: List[Dict[str, Any]],
    forecast_data: List[Dict[str, Any]],
    admin_note: Optional[str] = None,
) -> str:
    critical = [d for d in load_data if d.get("load_pct", 0) >= 90]
    warning = [d for d in load_data if 75 <= d.get("load_pct", 0) < 90]

    lines = [
        "Bạn là Hospital Operations AI — trợ lý điều hành bệnh viện.",
        "Ngôn ngữ trả lời: tiếng Việt, thân thiện nhưng chuyên nghiệp.",
        "Mục tiêu: điều phối bác sĩ và phòng khám, giảm quá tải, tối ưu nguồn lực.",
        "",
        "=== TÌNH HÌNH HIỆN TẠI ===",
        f"- Khoa nguy hiểm (>=90%): {', '.join(d['specialty'] for d in critical) or 'Không có'}",
        f"- Khoa cảnh báo (75-89%): {', '.join(d['specialty'] for d in warning) or 'Không có'}",
        "",
        "=== DỮ LIỆU CHI TIẾT ===",
    ]
    for item in sorted(load_data, key=lambda x: -x.get("load_pct", 0))[:10]:
        lines.append(
            f"- {item['specialty']}: {item['current_patients']}/{item['capacity']} "
            f"({item['load_pct']}%)"
        )

    lines += ["", "=== DỰ BÁO 6h TIẾP THEO ==="]
    for p in forecast_data[:6]:
        lines.append(f"- {p['hour']}: {p['load_pct']}% [{p.get('alert_level', 'unknown')}]")

    if admin_note:
        lines += ["", "=== GHI CHÚ QUẢN LÝ ===", admin_note]

    lines += [
        "",
        "=== YÊU CẦU ===",
        "1. Giải thích tình hình hiện tại ngắn gọn.",
        "2. Đề xuất ít nhất 2 hành động cụ thể để giảm tải và phân bổ nguồn lực.",
        "3. Nếu cần, đề xuất cách chuyển bệnh nhân hoặc đổi ca bác sĩ.",
        "4. Trả về JSON thuần với các trường: assistant_message, recommendations, action_items, summary.",
        "5. Nếu không thể trả JSON, vẫn trả nội dung bằng tiếng Việt rõ ràng.",
        "",
        "OUTPUT BẮT BUỘC — JSON thuần, không markdown:",
        "{",
        '  "assistant_message": "Thông điệp trả lời quản lý",',
        '  "recommendations": ["Nên làm A", "Nên làm B"],',
        '  "action_items": ["Hành động 1", "Hành động 2"],',
        '  "summary": "Tóm tắt ngắn gọn"',
        "}",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# SMART TRIAGE PROMPT (stateful, dependency-aware)
# ---------------------------------------------------------------------------

def build_patient_triage_prompt(
    patient_record: str,
    departments: List[Dict[str, Any]],
    forecast_data: List[Dict[str, Any]],
    visited_departments: Optional[List[str]] = None,
) -> str:
    """
    Prompt cho AI chat với bệnh nhân.
    - Truyền vào route ĐÃ TÍNH TOÁN bởi optimizer (không để AI tự sort)
    - AI chỉ cần: parse intent + diễn đạt tự nhiên + phát hiện dept mới
    """
    visited = visited_departments or []

    # Pre-compute route bằng optimizer để AI không cần tự sort
    optimized = compute_department_sequence(departments)
    route_computed = optimized["route"]
    remaining = [d for d in route_computed if d not in visited]

    dep_lines = []
    for item in departments:
        dept = item.get("department") or item.get("specialty") or "Không tên"
        wait = item.get("wait_time", 0)
        current = item.get("current_load", item.get("current_patients", 0))
        cap = item.get("capacity", 0)
        floor = item.get("floor", DEPT_FLOOR_MAP.get(dept, 1))
        dep_lines.append(f"- {dept}: Chờ {wait} phút | Tải {current}/{cap} | Tầng {floor}")

    # Bottleneck warning
    bottleneck_info = ""
    if optimized.get("bottleneck"):
        bn = optimized["bottleneck"]
        bottleneck_info = (
            f"\nĐIỂM TẮC NGHẼN: {bn['department']} "
            f"({bn['load_pct']}%, chờ ~{bn['wait_time']} phút)"
        )

    lines = [
        "Bạn là FlowPredict Navigator — trợ lý điều hướng bệnh viện.",
        "Bạn đang CHAT TRỰC TIẾP với bệnh nhân qua Zalo/app.",
        "",
        "=== DỮ LIỆU REALTIME CÁC KHOA ===",
        "\n".join(dep_lines),
        bottleneck_info,
        "",
        "=== LỘ TRÌNH TỐI ƯU ĐÃ TÍNH (theo y tế + thời gian chờ) ===",
        " → ".join(remaining) if remaining else "Chưa có lộ trình",
        f"Tổng thời gian ước tính: ~{optimized.get('total_estimated_minutes', 0)} phút",
        "",
        "=== ĐÃ KHÁM ===",
        ", ".join(visited) if visited else "Chưa có",
        "",
        "=== LỊCH SỬ CHAT ===",
        patient_record.strip(),
        "",
        "=== QUY ĐỊNH VÀ LỊCH LÀM VIỆC BỆNH VIỆN MEDIFLOW ===",
        "- Bệnh viện KHÔNG làm việc buổi Tối và Đêm.",
        "- KHOA TIM MẠCH: Tầng 5, Khu A. Chỉ làm việc buổi Sáng.",
        "- KHOA THẦN KINH: Tầng 4, Khu C. Sáng và Chiều.",
        "- KHOA TIÊU HÓA: Tầng 2, Khu B. Sáng và Chiều.",
        "- KHOA NHI: Tầng 3, Khu D. Sáng và Chiều.",
        "- KHOA NỘI TỔNG QUÁT: Tầng 1, Khu A. Sáng và Chiều.",
        "- KHOA MẮT: Tầng 2, Khu C. Sáng và Chiều.",
        "- KHI ĐẶT LỊCH: Phải yêu cầu cung cấp ĐỦ 3 thông tin: Tên khoa, Thời gian, và Số điện thoại.",
        "  Nếu phiếu của Zalo/Chat còn thiếu thông tin (số điện thoại, giờ), PHẢI hỏi thêm cho tới khi đủ.",
        "",
        "=== NHIỆM VỤ ===",
        "1. Đọc tin nhắn MỚI NHẤT của bệnh nhân.",
        "2. Nếu là người mới → chào và hỏi cần khám khoa nào.",
        "3. Nếu bệnh nhân nêu các khoa cần đi → DÙNG LỘ TRÌNH ĐÃ TÍNH ở trên để hướng dẫn.",
        "   QUAN TRỌNG: Không tự sắp xếp lại. Lộ trình đã tính đúng thứ tự y tế.",
        "   Giải thích ngắn gọn tại sao đi theo thứ tự này (ví dụ: xét nghiệm cần có kết quả trước).",
        "4. Nếu bệnh nhân báo đã khám xong một khoa → cập nhật và hướng dẫn khoa tiếp theo.",
        "5. Tông: Thân thiện, ngắn gọn như nhắn tin Zalo. Không dài dòng.",
        "",
        "OUTPUT BẮT BUỘC — JSON thuần, không markdown:",
        "{",
        '  "chat_response": "Tin nhắn trả lời bệnh nhân",',
        '  "optimal_route": ["Khoa A", "Khoa B"],',
        '  "visited": ["Khoa đã xong"],',
        '  "recommendations": ["Lưu ý 1", "Lưu ý 2"]',
        "}",
    ]
    return "\n".join(lines)