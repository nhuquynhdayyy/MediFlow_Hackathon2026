from __future__ import annotations

from itertools import permutations
from typing import Dict, List, Tuple

from app.services.mock_data_store import MEDICAL_PREREQUISITES, ORDER_TO_DEPARTMENT, TRAVEL_MINUTES


def map_orders_to_departments(orders: List[str]) -> List[str]:
    mapped = [ORDER_TO_DEPARTMENT.get(order, order) for order in orders]
    dedup: List[str] = []
    for dep in mapped:
        if dep not in dedup:
            dedup.append(dep)
    return dedup


def expand_with_prerequisites(departments: List[str]) -> List[str]:
    output = list(departments)
    for dept in list(output):
        for pre in MEDICAL_PREREQUISITES.get(dept, []):
            if pre not in output:
                output.insert(0, pre)
    # stable unique
    unique: List[str] = []
    for dep in output:
        if dep not in unique:
            unique.append(dep)
    return unique


def is_valid_route(route: Tuple[str, ...]) -> bool:
    pos = {name: idx for idx, name in enumerate(route)}
    for dept in route:
        for pre in MEDICAL_PREREQUISITES.get(dept, []):
            if pre in pos and pos[pre] > pos[dept]:
                return False
    return True


def route_cost(route: Tuple[str, ...], load_map: Dict[str, Dict]) -> float:
    total = 0.0
    for idx, dep in enumerate(route):
        load = load_map.get(dep, {})
        wait = float(load.get("wait_time", 0))
        service = float(load.get("avg_service_minutes", 10))
        load_factor = float(load.get("load_pct", 0)) / 100.0
        total += wait + service * (1.0 + load_factor)
        if idx > 0:
            prev = route[idx - 1]
            total += TRAVEL_MINUTES.get((prev, dep), 5)
    return round(total, 1)


def optimize_route(departments: List[str], load_rows: List[Dict]) -> Dict:
    expanded = expand_with_prerequisites(departments)
    pool = expanded[:7] if len(expanded) > 7 else expanded
    load_map = {row["department"]: row for row in load_rows}

    valid_routes: List[Tuple[Tuple[str, ...], float]] = []
    for candidate in permutations(pool):
        if not is_valid_route(candidate):
            continue
        valid_routes.append((candidate, route_cost(candidate, load_map)))

    if not valid_routes:
        fallback = tuple(pool)
        return {
            "optimal_route": list(fallback),
            "estimated_time": route_cost(fallback, load_map),
            "alternative_route": list(fallback),
            "alternative_time": route_cost(fallback, load_map),
            "time_saved": 0.0,
        }

    sorted_routes = sorted(valid_routes, key=lambda x: x[1])
    best_route, best_time = sorted_routes[0]
    alternative_route, alternative_time = sorted_routes[1] if len(sorted_routes) > 1 else sorted_routes[0]
    saved = round(max(0.0, alternative_time - best_time), 1)
    return {
        "optimal_route": list(best_route),
        "estimated_time": best_time,
        "alternative_route": list(alternative_route),
        "alternative_time": alternative_time,
        "time_saved": saved,
    }
