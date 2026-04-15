from __future__ import annotations

from fastapi import APIRouter

from app.models.responses import StandardResponse
from app.services.load_predictor import get_department_load

router = APIRouter()


@router.get("/departments", response_model=StandardResponse[list])
def get_departments():
    data = get_department_load(hour_offset=0)
    names = [d["department"] for d in data]
    return StandardResponse(status="success", message="Danh sách khoa", data=names)


@router.get("/department-load", response_model=StandardResponse[list])
def department_load():
    return StandardResponse(status="success", message="Realtime department load", data=get_department_load(0))