from __future__ import annotations

from typing import Generic, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiEnvelope(BaseModel, Generic[T]):
    status: str
    message: str
    data: Optional[T] = None


class ConstraintModel(BaseModel):
    elderly: bool = False
    wheelchair: bool = False
    priority: str = "normal"
    auto_include_prerequisites: bool = False


class PatientStateModel(BaseModel):
    current_step: str | None = None
    completed: list[str] = Field(default_factory=list)


class OptimizeRouteRequest(BaseModel):
    patient_id: str = Field(..., min_length=2)
    departments: list[str] = Field(default_factory=list)
    constraints: ConstraintModel = Field(default_factory=ConstraintModel)
    patient_state: PatientStateModel = Field(default_factory=PatientStateModel)


class SuggestTimeRequest(BaseModel):
    patient_id: str = Field(..., min_length=2)
    departments: list[str] = Field(default_factory=list)
    lookahead_hours: int = Field(default=3, ge=1, le=6)
    constraints: ConstraintModel = Field(default_factory=ConstraintModel)


class PatientProgressUpdateRequest(BaseModel):
    completed_step: str = Field(..., min_length=2)
    current_step: str | None = None


class ChatMessage(BaseModel):
    role: str = Field(..., description="user | assistant")
    text: str = Field(..., min_length=1, max_length=2000)


class PatientChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list)
    departments_context: list[str] = Field(default_factory=list)


class HospitalChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list)


class StaffUpsertRequest(BaseModel):
    name: str = Field(..., min_length=2)
    role: str = Field(..., pattern="^(doctor|nurse)$")
    department: str = Field(..., min_length=2)
    shift: str = Field(default="07:00-15:00")
    status: str = Field(default="active")


class RoomUpsertRequest(BaseModel):
    department: str = Field(..., min_length=2)
    room_name: str = Field(..., min_length=2)
    room_code: str = Field(..., min_length=2)
    block: str = Field(..., min_length=2)
    floor: int = Field(default=1, ge=1, le=20)
    capacity: int = Field(default=20, ge=1, le=500)
    room_type: str = Field(default="clinic")
    status: str = Field(default="active")


class PatientFlowStatusRequest(BaseModel):
    status: str = Field(..., min_length=2)
    current_step: str | None = None
    note: str = ""
