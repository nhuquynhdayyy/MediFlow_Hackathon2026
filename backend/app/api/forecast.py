from __future__ import annotations

from fastapi import APIRouter

from app.models.responses import StandardResponse
from app.services.ai_explainer import explain_overload
from app.services.load_predictor import predict_load

router = APIRouter()


@router.get("/predict-load", response_model=StandardResponse[dict])
def predict_load_api():
    data = predict_load(lookahead_hours=3)
    data.update(explain_overload(data["overloaded_departments"], data["peak_hours"]))
    return StandardResponse(status="success", message="Predict load thành công", data=data)