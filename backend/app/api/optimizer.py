from __future__ import annotations

from fastapi import APIRouter

from app.models.requests import OptimizeRouteRequest, SuggestTimeRequest
from app.models.responses import StandardResponse
from app.services.ai_explainer import explain_route
from app.services.load_predictor import get_department_load
from app.services.route_optimizer import map_orders_to_departments, optimize_route

router = APIRouter()


@router.post("/optimize-route", response_model=StandardResponse[dict])
def optimize_route_api(payload: OptimizeRouteRequest):
    if not payload.departments:
        return StandardResponse(status="error", message="Danh sách khoa cần khám đang rỗng.", data=None)

    load_rows = get_department_load(hour_offset=0)
    mapped = map_orders_to_departments(payload.departments)
    result = optimize_route(mapped, load_rows)
    result["reasoning"] = explain_route(
        result["optimal_route"], result["estimated_time"], result["alternative_time"]
    )
    result["patient_state"] = payload.patient_state.model_dump()
    return StandardResponse(status="success", message="Tối ưu lộ trình thành công.", data=result)


@router.post("/suggest-time", response_model=StandardResponse[dict])
def suggest_time_api(payload: SuggestTimeRequest):
    if not payload.departments:
        return StandardResponse(status="error", message="Danh sách khoa cần khám đang rỗng.", data=None)

    mapped = map_orders_to_departments(payload.departments)
    options = []
    for hour_offset in range(0, payload.lookahead_hours + 1):
        load_rows = get_department_load(hour_offset=hour_offset)
        computed = optimize_route(mapped, load_rows)
        options.append({"offset_hours": hour_offset, **computed})

    best = sorted(options, key=lambda x: x["estimated_time"])[0]
    return StandardResponse(
        status="success",
        message="Gợi ý thời điểm đi khám thành công.",
        data={
            "recommended_offset_hours": best["offset_hours"],
            "estimated_time": best["estimated_time"],
            "optimal_route": best["optimal_route"],
            "alternatives": options,
        },
    )