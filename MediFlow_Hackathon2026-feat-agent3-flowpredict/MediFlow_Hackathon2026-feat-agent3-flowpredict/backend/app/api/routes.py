import logging
from typing import Optional

from fastapi import APIRouter, Query

from app.models.schemas import NowVsLaterQuery, OptimizeRouteRequest
from app.services.ai_explainer import generate_explanation
from app.services.hospital_data import (
    DEFAULT_NAVIGATION_DEPARTMENTS,
    get_department_catalog,
    get_department_snapshot,
)
from app.services.load_predictor import build_prediction_payload, compare_now_vs_later
from app.services.overload_detector import analyze_overload
from app.services.response import success_response
from app.services.route_optimizer import optimize_route_plan

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/departments")
def get_departments(hour: int = Query(9, ge=8, le=17)):
    departments = get_department_catalog(hour=hour)
    return success_response(
        message="Department catalog generated.",
        data={"hour": hour, "departments": departments},
    )


@router.post("/optimize-route")
def optimize_route(payload: OptimizeRouteRequest):
    result = optimize_route_plan(payload)
    result["reasoning"] = generate_explanation(
        mode="navigator",
        context={
            "hour": payload.hour,
            "route": result["optimal_route"],
            "estimated_time": result["estimated_time"],
            "time_saved": result["time_saved"],
        },
        fallback=result["reasoning"],
    )
    return success_response(
        message="Route optimized successfully.",
        data=result,
    )


@router.get("/predict-load")
def predict_load(department: Optional[str] = None):
    payload = build_prediction_payload(department=department)
    return success_response(
        message="Load prediction generated.",
        data=payload,
    )


@router.get("/now-vs-later")
def now_vs_later(
    department: Optional[str] = None,
    departments: Optional[str] = None,
    now_hour: int = Query(9, ge=8, le=17),
    later_hour: int = Query(11, ge=8, le=17),
):
    selected_departments = (
        [item.strip() for item in departments.split(",") if item.strip()]
        if departments
        else DEFAULT_NAVIGATION_DEPARTMENTS
    )
    query = NowVsLaterQuery(
        department=department,
        departments=selected_departments,
        now_hour=now_hour,
        later_hour=later_hour,
    )
    data = compare_now_vs_later(query)
    return success_response(
        message="Current-vs-later comparison generated.",
        data=data,
    )


@router.get("/overload-analysis")
def overload_analysis(hour: int = Query(9, ge=8, le=17)):
    snapshot = get_department_snapshot(hour=hour)
    data = analyze_overload(snapshot=snapshot, hour=hour)
    data["reasoning"] = generate_explanation(
        mode="operations",
        context=data,
        fallback=data["reasoning"],
    )
    return success_response(
        message="Overload analysis completed.",
        data=data,
    )
