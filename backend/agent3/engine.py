from __future__ import annotations

from datetime import datetime
from itertools import permutations
from pathlib import Path
from random import Random
from typing import Any
import json
import os
import re
import urllib.error
import urllib.request

from dotenv import load_dotenv

from agent3.static_data import (
    DEPARTMENT_META,
    DEPARTMENT_SEEDS,
    HOURLY_PATTERN,
    MEDICAL_PREREQUISITES,
    ORDER_TO_DEPARTMENT,
    TEST_DB,
    TRAVEL_MINUTES,
)
from agent3.store import canonical_department_name, get_appointment_queue_counts, get_room_overrides, get_staff_counts_by_department

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DEFAULT_MODEL = "Llama-3.3-70B-Instruct"


def _get_reference_hour() -> int:
    forced_hour = os.getenv("AGENT3_SIM_HOUR", "").strip()
    if forced_hour:
        try:
            return max(0, min(23, int(forced_hour)))
        except ValueError:
            pass
    return datetime.now().hour


def infer_department_from_order(order: str) -> str:
    normalized = canonical_department_name(order) or order
    if normalized in TEST_DB or normalized in DEPARTMENT_META:
        return normalized
    if normalized in ORDER_TO_DEPARTMENT:
        return ORDER_TO_DEPARTMENT[normalized]
    lowered = normalized.lower()
    imaging_keywords = ("mri", "ct", "x-quang", "x quang", "sieu am", "ecg", "noi soi")
    if any(keyword in lowered for keyword in imaging_keywords):
        return "Imaging"
    lab_keywords = ("xet nghiem", "cbc", "hba1c", "ast", "alt", "hcg", "duong huyet", "nuoc tieu", "sinh hoa")
    if any(keyword in lowered for keyword in lab_keywords):
        return "Lab"
    return normalized


def canonical_route_item(value: str) -> str:
    return canonical_department_name(value) or value


def map_orders_to_departments(orders: list[str]) -> list[str]:
    mapped = [canonical_route_item(infer_department_from_order(item)) for item in orders]
    unique: list[str] = []
    for department in mapped:
        if department and department not in unique:
            unique.append(department)
    return unique


def expand_with_prerequisites(departments: list[str]) -> list[str]:
    output = [canonical_route_item(item) for item in departments]
    for department in list(output):
        canonical_department = canonical_route_item(department)
        for prerequisite in MEDICAL_PREREQUISITES.get(canonical_department, []):
            prerequisite_name = canonical_route_item(prerequisite)
            if prerequisite_name not in output:
                output.insert(0, prerequisite_name)
    unique: list[str] = []
    for department in output:
        if department not in unique:
            unique.append(department)
    return unique


def is_valid_route(route: tuple[str, ...]) -> bool:
    position = {name: index for index, name in enumerate(route)}
    for department in route:
        canonical_department = canonical_route_item(department)
        for prerequisite in MEDICAL_PREREQUISITES.get(canonical_department, []):
            prerequisite_name = canonical_route_item(prerequisite)
            if prerequisite_name in position and position[prerequisite_name] > position[department]:
                return False
    return True


def route_cost(route: tuple[str, ...], load_map: dict[str, dict[str, Any]]) -> float:
    total = 0.0
    for index, department in enumerate(route):
        load = load_map.get(department, {})
        wait = float(load.get("wait_time", 0))
        service = float(load.get("avg_service_minutes", 10))
        load_factor = float(load.get("load_pct", 0)) / 100.0
        total += wait + service * (1.0 + load_factor)
        if index > 0:
            previous = route[index - 1]
            total += TRAVEL_MINUTES.get((previous, department), 5)
    return round(total, 1)


def optimize_route(
    departments: list[str],
    load_rows: list[dict[str, Any]],
    *,
    include_prerequisites: bool = False,
) -> dict[str, Any]:
    expanded = expand_with_prerequisites(departments) if include_prerequisites else [canonical_route_item(item) for item in departments]
    pool = expanded[:7] if len(expanded) > 7 else expanded
    load_map = {row["department"]: row for row in load_rows}

    valid_routes: list[tuple[tuple[str, ...], float]] = []
    for candidate in permutations(pool):
        if not is_valid_route(candidate):
            continue
        valid_routes.append((candidate, route_cost(candidate, load_map)))

    if not valid_routes:
        fallback = tuple(pool)
        fallback_time = route_cost(fallback, load_map) if fallback else 0.0
        return {
            "optimal_route": list(fallback),
            "estimated_time": fallback_time,
            "alternative_route": list(fallback),
            "alternative_time": fallback_time,
            "time_saved": 0.0,
        }

    sorted_routes = sorted(valid_routes, key=lambda item: item[1])
    best_route, best_time = sorted_routes[0]
    alternative_route, alternative_time = sorted_routes[1] if len(sorted_routes) > 1 else sorted_routes[0]
    return {
        "optimal_route": list(best_route),
        "estimated_time": best_time,
        "alternative_route": list(alternative_route),
        "alternative_time": alternative_time,
        "time_saved": round(max(0.0, alternative_time - best_time), 1),
    }


def estimate_wait_time(waiting: int, doctors: int, avg_service_minutes: int) -> float:
    safe_doctors = max(1, doctors)
    return round((waiting / safe_doctors) * avg_service_minutes, 1)


def get_departments_snapshot(hour_offset: int = 0) -> list[dict[str, Any]]:
    now_hour = (_get_reference_hour() + hour_offset) % 24
    pattern = HOURLY_PATTERN.get(now_hour, 0.75)
    rng = Random(now_hour + 2026)
    queue_counts = get_appointment_queue_counts()
    staff_counts = get_staff_counts_by_department()
    room_overrides = get_room_overrides()
    rows: list[dict[str, Any]] = []

    for seed in DEPARTMENT_SEEDS:
        meta = DEPARTMENT_META.get(seed.name, {})
        staffing = staff_counts.get(seed.name, {})
        doctors = max(seed.doctors, staffing.get("doctor", 0) or 0) or seed.doctors
        nurses = staffing.get("nurse", 0)
        queue_boost = queue_counts.get(seed.name, 0)
        jitter = 0.85 + rng.random() * 0.35
        waiting = int((seed.base_waiting + queue_boost * 2) * pattern * jitter)
        in_service = max(1, int(doctors * (0.75 + rng.random() * 0.25)))
        if seed.name == "Internal":
            if now_hour == 9:
                waiting = max(waiting, 45)
            if now_hour == 11:
                waiting = min(waiting, 20)
        room = room_overrides.get(seed.name, {})
        rows.append(
            {
                "department": seed.name,
                "waiting": waiting,
                "in_service": in_service,
                "doctors": doctors,
                "nurses": nurses,
                "avg_service_minutes": seed.avg_service_minutes,
                "floor": room.get("floor", meta.get("floor", seed.floor)),
                "block": room.get("block", meta.get("block", "A1 (Khác)")),
                "room_code": room.get("room_code", meta.get("room_code", "")),
            }
        )

    for test_name, info in TEST_DB.items():
        jitter = 0.85 + rng.random() * 0.35
        base_wait = 25 if info.get("category") == "Chan doan hinh anh" else 8
        room = room_overrides.get(test_name, {})
        rows.append(
            {
                "department": test_name,
                "waiting": int(base_wait * pattern * jitter),
                "in_service": max(1, int(3 * (0.75 + rng.random() * 0.25))),
                "doctors": 3,
                "nurses": 2,
                "avg_service_minutes": 10,
                "floor": room.get("floor", info.get("floor", 1)),
                "block": room.get("block", info.get("block", "B1 (Can lam sang)")),
                "room_code": room.get("room_code", info.get("room_code", "")),
                "category": info.get("category", "Xét nghiệm"),
            }
        )

    return rows


def get_department_load(hour_offset: int = 0) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for row in get_departments_snapshot(hour_offset=hour_offset):
        wait_time = estimate_wait_time(
            waiting=row["waiting"],
            doctors=row["doctors"],
            avg_service_minutes=row["avg_service_minutes"],
        )
        capacity = max(1, row["doctors"] * 12 + row.get("nurses", 0) * 6)
        load_pct = round(min(100.0, (row["waiting"] + row["in_service"]) / capacity * 100), 1)
        output.append(
            {
                **row,
                "wait_time": wait_time,
                "load_pct": load_pct,
                "capacity": capacity,
                "alert_level": "red" if load_pct > 80 else "yellow" if load_pct >= 50 else "green",
            }
        )
    return output


def predict_load(lookahead_hours: int = 3) -> dict[str, Any]:
    points: list[dict[str, Any]] = []
    overloaded = set()
    base_hour = _get_reference_hour()
    for offset in range(lookahead_hours + 1):
        slot = get_department_load(hour_offset=offset)
        avg_load = round(sum(item["load_pct"] for item in slot) / max(1, len(slot)), 1)
        hour = (base_hour + offset) % 24
        points.append({"hour": f"{hour:02d}:00", "average_load": avg_load, "departments": slot})
        for department in slot:
            if department["load_pct"] > 80:
                overloaded.add(department["department"])
    peak_hours = [item["hour"] for item in sorted(points, key=lambda entry: entry["average_load"], reverse=True)[:2]]
    return {
        "timeline": points,
        "peak_hours": peak_hours,
        "overloaded_departments": sorted(overloaded),
    }


def analyze_overload(departments: list[dict[str, Any]]) -> dict[str, Any]:
    red = [item for item in departments if item["load_pct"] > 80]
    yellow = [item for item in departments if 50 <= item["load_pct"] <= 80]
    recommendations: list[str] = []
    actions: list[str] = []

    if red:
        hottest = red[0]["department"]
        recommendations.extend(
            [
                f"Bổ sung 1 bác sĩ tại {hottest}",
                "Chuyển bệnh nhân không khẩn cấp sang khung giờ tải thấp",
                "Mở thêm bàn khám tạm trong 2 giờ tới",
            ]
        )
        actions.extend(["kích hoạt red-zone staffing", "điều phối bệnh nhân sang khoa yellow/green"])
    elif yellow:
        recommendations.extend(
            [
                "Theo dõi sát các khoa tải trung bình-cao mỗi 15 phút",
                "Ưu tiên xử lý hồ sơ đã đủ xét nghiệm trước",
            ]
        )
        actions.append("preemptive staffing")
    else:
        recommendations.append("Hệ thống ổn định, duy trì nhân sự hiện tại")
        actions.append("monitor")

    return {
        "overloaded_departments": [item["department"] for item in red],
        "recommendations": recommendations,
        "actions": actions,
        "yellow_departments": [item["department"] for item in yellow],
    }


def _get_fpt_api_url() -> str:
    base_url = os.getenv("FPT_AI_URL") or os.getenv("FPT_API_URL") or "https://mkp-api.fptcloud.com"
    if base_url.endswith("/chat/completions") or base_url.endswith("/v1/chat/completions") or base_url.endswith("/completions"):
        return base_url
    return f"{base_url.rstrip('/')}/chat/completions"


def _get_fpt_api_key() -> str:
    api_key = os.getenv("FPT_API_KEY", "")
    if not api_key:
        raise RuntimeError("FPT_API_KEY is not configured.")
    return api_key


def call_fpt_ai(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 1024,
) -> Any:
    url = _get_fpt_api_url()
    payload = {
        "model": model or os.getenv("FPT_AI_MODEL", os.getenv("FPT_DEFAULT_MODEL", DEFAULT_MODEL)),
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {_get_fpt_api_key()}",
            "User-Agent": "MediFlow-Agent3/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"FPT API {exc.code}: {body[:200]}")
    except urllib.error.URLError as exc:
        raise RuntimeError(f"FPT network error: {exc.reason}")


def extract_text_from_response(data: Any) -> str:
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        choices = data.get("choices")
        if isinstance(choices, list) and choices:
            message = choices[0].get("message", {})
            if isinstance(message, dict):
                return str(message.get("content", "")).strip()
            return str(choices[0].get("text", "")).strip()
        for key in ("text", "result"):
            if isinstance(data.get(key), str):
                return str(data[key]).strip()
    return ""


def generate_text(prompt: str, *, system_prompt: str | None = None, temperature: float = 0.2, max_tokens: int = 220) -> str:
    response = call_fpt_ai(
        [
            {
                "role": "system",
                "content": system_prompt
                or "Bạn là trợ lý vận hành bệnh viện súc tích. Trả lời bằng tiếng Việt có dấu, ngắn gọn, không markdown.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return extract_text_from_response(response)


def explain_route(optimal_route: list[str], estimated_time: float, alternative_time: float) -> list[str]:
    if not optimal_route:
        return ["Không có route khả dụng tại thời điểm này."]
    saving = round(max(0.0, alternative_time - estimated_time), 1)
    fallback = [
        f"Lộ trình ưu tiên: {' -> '.join(optimal_route)}.",
        "Thuật toán cộng thời gian chờ, xử lý và di chuyển giữa các khoa.",
        f"Phương án này tiết kiệm khoảng {saving} phút so với lộ trình thay thế.",
    ]
    prompt = (
        "Trả về đúng 3 gạch đầu dòng giải thích lộ trình bệnh nhân.\n"
        f"Lộ trình tối ưu: {' -> '.join(optimal_route)}\n"
        f"Tổng thời gian tối ưu: {estimated_time} phút\n"
        f"Tổng thời gian thay thế: {alternative_time} phút\n"
        f"Tiết kiệm: {saving} phút"
    )
    try:
        text = generate_text(prompt, temperature=0.2, max_tokens=180)
        lines = [line.strip("-* \t") for line in text.splitlines() if line.strip()]
        if len(lines) >= 2:
            return lines[:3]
    except Exception:
        return fallback
    return fallback


def explain_overload(overloaded_departments: list[str], peak_hours: list[str]) -> dict[str, Any]:
    if overloaded_departments:
        fallback = (
            f"Hệ thống ghi nhận quá tải tại {', '.join(overloaded_departments[:3])}. "
            f"Giờ cao điểm: {', '.join(peak_hours[:2]) or 'chưa rõ'}."
        )
    else:
        fallback = "Chưa có khoa vượt ngưỡng đỏ. Tiếp tục theo dõi realtime."
    prompt = (
        "Tóm tắt tình hình quá tải bệnh viện thành 1-2 câu ngắn.\n"
        f"Khoa quá tải: {', '.join(overloaded_departments) or 'Không có'}\n"
        f"Giờ cao điểm: {', '.join(peak_hours) or 'Chưa xác định'}"
    )
    try:
        text = generate_text(prompt, temperature=0.2, max_tokens=90).strip()
        if text:
            return {"reasoning": text}
    except Exception:
        return {"reasoning": fallback}
    return {"reasoning": fallback}


def clean_ai_lines(text: str) -> list[str]:
    lines = [line.strip() for line in re.split(r"[\r\n]+", text or "") if line.strip()]
    return lines
