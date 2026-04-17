from statistics import mean
from typing import Dict, List


def analyze_overload(snapshot: List[Dict], hour: int) -> Dict:
    overloaded_departments = [dept for dept in snapshot if dept["current_load"] > 80]
    warning_departments = [dept for dept in snapshot if 50 <= dept["current_load"] <= 80]
    recommendations: List[str] = []
    actions: List[str] = []

    for dept in overloaded_departments:
        low_load_targets = [
            candidate["name"]
            for candidate in snapshot
            if candidate["zone"] == dept["zone"] and candidate["current_load"] < 50
        ]
        if low_load_targets:
            recommendations.append(
                f"Divert walk-in patients from {dept['name']} to {low_load_targets[0]} in {dept['zone']}."
            )
        recommendations.append(
            f"Hide {dept['name']} from default patient routing until load drops below 80%."
        )
        actions.append(f"Open an extra consultation desk for {dept['name']}.")
        actions.append(f"Shift non-urgent appointments away from {dept['name']} after {hour}:30.")

    if not overloaded_departments:
        recommendations.append("No red-zone departments. Keep dynamic routing active.")
        actions.append("Maintain current staffing and continue monitoring 30-minute intervals.")

    if warning_departments:
        recommendations.append(
            f"Pre-alert queue managers for {len(warning_departments)} yellow-zone departments."
        )

    average_load = round(mean(dept["current_load"] for dept in snapshot))
    reasoning = [
        f"Hospital average load at {hour}:00 is {average_load}%.",
        f"Detected {len(overloaded_departments)} red-zone departments and {len(warning_departments)} yellow-zone departments.",
    ]

    return {
        "hour": hour,
        "average_load": average_load,
        "overloaded_departments": [
            {
                "department": dept["name"],
                "load": dept["current_load"],
                "wait_time": dept["wait_time"],
                "zone": dept["zone"],
            }
            for dept in overloaded_departments
        ],
        "recommendations": recommendations,
        "actions": actions,
        "heatmap": [
            {
                "department": dept["name"],
                "status": dept["status"],
                "load": dept["current_load"],
            }
            for dept in snapshot
        ],
        "reasoning": reasoning,
    }
