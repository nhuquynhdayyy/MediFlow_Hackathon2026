from __future__ import annotations

from datetime import datetime
from typing import Dict, List

from app.services.mock_data_store import get_departments_snapshot


def estimate_wait_time(waiting: int, doctors: int, avg_service_minutes: int) -> float:
    """wait_time = (waiting / doctors) * avg_service_time"""
    safe_doctors = max(1, doctors)
    return round((waiting / safe_doctors) * avg_service_minutes, 1)


def get_department_load(hour_offset: int = 0) -> List[Dict]:
    departments = get_departments_snapshot(hour_offset=hour_offset)
    output: List[Dict] = []
    for row in departments:
        wait_time = estimate_wait_time(
            waiting=row["waiting"],
            doctors=row["doctors"],
            avg_service_minutes=row["avg_service_minutes"],
        )
        capacity = max(1, row["doctors"] * 12)
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


def predict_load(lookahead_hours: int = 3) -> Dict:
    points: List[Dict] = []
    overloaded = set()
    for offset in range(lookahead_hours + 1):
        slot = get_department_load(hour_offset=offset)
        avg_load = round(sum(x["load_pct"] for x in slot) / max(1, len(slot)), 1)
        hour = (datetime.now().hour + offset) % 24
        points.append({"hour": f"{hour:02d}:00", "average_load": avg_load, "departments": slot})
        for dep in slot:
            if dep["load_pct"] > 80:
                overloaded.add(dep["department"])

    peak_hours = [p["hour"] for p in sorted(points, key=lambda x: x["average_load"], reverse=True)[:2]]
    return {
        "timeline": points,
        "peak_hours": peak_hours,
        "overloaded_departments": sorted(list(overloaded)),
    }
