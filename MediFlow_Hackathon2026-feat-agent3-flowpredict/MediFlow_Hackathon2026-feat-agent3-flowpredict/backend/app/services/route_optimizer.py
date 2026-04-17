from itertools import permutations
from typing import Dict, List, Tuple

from app.models.schemas import OptimizeRouteRequest
from app.services.hospital_data import DEPENDENCY_RULES, get_department_map, status_from_load


def _route_valid(route: Tuple[str, ...], constraints: List[str]) -> bool:
    for department, prerequisites in DEPENDENCY_RULES.items():
        if department in route:
            for prerequisite in prerequisites:
                if prerequisite in route and route.index(prerequisite) > route.index(department):
                    return False

    if "lab_first" in constraints and "Laboratory" in route and route[0] != "Laboratory":
        return False
    if "pharmacy_last" in constraints and "Pharmacy" in route and route[-1] != "Pharmacy":
        return False
    return True


def _route_cost(route: Tuple[str, ...], department_map: Dict[str, Dict], constraints: List[str]) -> float:
    total_cost = 0.0
    previous_floor = None
    for department in route:
        details = department_map[department]
        wait_time = details["wait_time"]
        load_factor = details["current_load"] / 100
        total_cost += wait_time * (1 + load_factor)
        if previous_floor is not None:
            total_cost += abs(details["floor"] - previous_floor) * 2
        previous_floor = details["floor"]

    if "avoid_overloaded" in constraints:
        total_cost += sum(12 for department in route if department_map[department]["current_load"] > 80)
    if "prioritize_low_load" in constraints:
        total_cost += sum(department_map[department]["current_load"] * 0.15 for department in route)
    return round(total_cost, 2)


def _build_reasoning(best_route: Tuple[str, ...], department_map: Dict[str, Dict], constraints: List[str]) -> List[str]:
    notes = []
    for department in best_route:
        details = department_map[department]
        notes.append(
            f"{department}: wait {details['wait_time']} min, load {details['current_load']}%, zone {details['zone']}."
        )
    if "avoid_overloaded" in constraints:
        notes.append("Overloaded departments were penalized to keep patients away from red zones.")
    if "prioritize_low_load" in constraints:
        notes.append("Lower-load departments were prioritized to reduce queue risk.")
    return notes


def optimize_route_plan(payload: OptimizeRouteRequest) -> Dict:
    department_map = get_department_map(payload.hour)

    missing_departments = [name for name in payload.departments if name not in department_map]
    if missing_departments:
        raise ValueError(f"Unknown departments: {', '.join(missing_departments)}")

    for name, wait_time in payload.wait_times.items():
        if name in department_map:
            department_map[name]["wait_time"] = wait_time
    for name, load in payload.current_load.items():
        if name in department_map:
            department_map[name]["current_load"] = load
            department_map[name]["status"] = status_from_load(load)

    valid_routes = []
    for route in permutations(payload.departments):
        if _route_valid(route, payload.constraints):
            valid_routes.append(
                {
                    "route": route,
                    "cost": _route_cost(route, department_map, payload.constraints),
                }
            )

    if not valid_routes:
        raise ValueError("No valid route found for the selected constraints.")

    valid_routes.sort(key=lambda item: item["cost"])
    best = valid_routes[0]
    alternative = valid_routes[1] if len(valid_routes) > 1 else valid_routes[0]

    return {
        "optimal_route": list(best["route"]),
        "estimated_time": round(best["cost"]),
        "alternative_route": list(alternative["route"]),
        "alternative_time": round(alternative["cost"]),
        "time_saved": max(0, round(alternative["cost"] - best["cost"])),
        "baseline_time": round(valid_routes[-1]["cost"]),
        "reasoning": _build_reasoning(best["route"], department_map, payload.constraints),
        "route_breakdown": [
            {
                "department": name,
                "wait_time": department_map[name]["wait_time"],
                "current_load": department_map[name]["current_load"],
                "status": department_map[name]["status"],
                "floor": department_map[name]["floor"],
                "zone": department_map[name]["zone"],
            }
            for name in best["route"]
        ],
    }
