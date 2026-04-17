from statistics import mean
from typing import Dict, List, Optional

from app.models.schemas import NowVsLaterQuery, OptimizeRouteRequest
from app.services.hospital_data import (
    DEFAULT_NAVIGATION_DEPARTMENTS,
    HOSPITAL_DATA,
    get_department_map,
)
from app.services.route_optimizer import optimize_route_plan


def build_prediction_payload(department: Optional[str] = None) -> Dict:
    selected = [dept for dept in HOSPITAL_DATA if department in (None, dept["name"])]
    if not selected:
        raise ValueError("Department not found.")

    departments_payload = []
    hospital_curve: Dict[int, List[int]] = {hour: [] for hour in range(8, 18)}

    for dept in selected:
        hourly_loads = []
        peak_hour = max(dept["hourly_pattern"], key=dept["hourly_pattern"].get)
        for hour, load in dept["hourly_pattern"].items():
            wait_time = round(dept["base_wait"] + (load * 0.35))
            hourly_loads.append(
                {
                    "hour": hour,
                    "load": load,
                    "expected_wait": wait_time,
                }
            )
            hospital_curve[hour].append(load)

        departments_payload.append(
            {
                "department": dept["name"],
                "peak_hour": peak_hour,
                "peak_load": dept["hourly_pattern"][peak_hour],
                "timeline": hourly_loads,
            }
        )

    hospital_timeline = [
        {
            "hour": hour,
            "average_load": round(mean(loads)),
        }
        for hour, loads in hospital_curve.items()
        if loads
    ]
    peak_hours = [item["hour"] for item in hospital_timeline if item["average_load"] >= 75]

    return {
        "department": department or "All Departments",
        "departments": departments_payload,
        "hospital_timeline": hospital_timeline,
        "peak_hours": peak_hours,
        "alerts": [f"Peak congestion expected around {hour}:00." for hour in peak_hours],
    }


def compare_now_vs_later(query: NowVsLaterQuery) -> Dict:
    selected_departments = query.departments or DEFAULT_NAVIGATION_DEPARTMENTS

    now_result = optimize_route_plan(
        OptimizeRouteRequest(
            departments=selected_departments,
            constraints=["avoid_overloaded", "prioritize_low_load", "pharmacy_last"],
            hour=query.now_hour,
        )
    )
    later_result = optimize_route_plan(
        OptimizeRouteRequest(
            departments=selected_departments,
            constraints=["avoid_overloaded", "prioritize_low_load", "pharmacy_last"],
            hour=query.later_hour,
        )
    )

    department_comparison = None
    if query.department:
        now_map = get_department_map(query.now_hour)
        later_map = get_department_map(query.later_hour)
        if query.department not in now_map:
            raise ValueError("Department not found.")
        department_comparison = {
            "department": query.department,
            "now": {
                "hour": query.now_hour,
                "load": now_map[query.department]["current_load"],
                "wait_time": now_map[query.department]["wait_time"],
                "status": now_map[query.department]["status"],
            },
            "later": {
                "hour": query.later_hour,
                "load": later_map[query.department]["current_load"],
                "wait_time": later_map[query.department]["wait_time"],
                "status": later_map[query.department]["status"],
            },
        }

    return {
        "scenario": f"{query.now_hour}:00 vs {query.later_hour}:00",
        "departments": selected_departments,
        "now": now_result,
        "later": later_result,
        "minutes_saved_if_wait": max(0, now_result["estimated_time"] - later_result["estimated_time"]),
        "department_comparison": department_comparison,
    }
