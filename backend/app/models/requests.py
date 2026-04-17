from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class ConstraintModel(BaseModel):
    elderly: bool = Field(default=False)
    wheelchair: bool = Field(default=False)
    priority: str = Field(default="normal")


class PatientStateModel(BaseModel):
    current_step: Optional[str] = Field(default=None)
    completed: List[str] = Field(default_factory=list)


class OptimizeRouteRequest(BaseModel):
    patient_id: str = Field(..., min_length=2)
    departments: List[str] = Field(default_factory=list)
    constraints: ConstraintModel = Field(default_factory=ConstraintModel)
    patient_state: PatientStateModel = Field(default_factory=PatientStateModel)


class SuggestTimeRequest(BaseModel):
    patient_id: str = Field(..., min_length=2)
    departments: List[str] = Field(default_factory=list)
    lookahead_hours: int = Field(default=3, ge=1, le=6)
    constraints: ConstraintModel = Field(default_factory=ConstraintModel)


class NowVsLaterQueryRequest(BaseModel):
    patient_id: str = Field(..., min_length=2)
    departments: List[str] = Field(default_factory=list)
    compare_after_hours: int = Field(default=2, ge=1, le=6)
    constraints: ConstraintModel = Field(default_factory=ConstraintModel)


class PatientProgressUpdateRequest(BaseModel):
    completed_step: str = Field(..., min_length=2)
    current_step: Optional[str] = None


class EmrOrdersRequest(BaseModel):
    patient_id: str
    orders: List[str]
    metadata: Dict[str, str] = Field(default_factory=dict)


class PatientChatMessage(BaseModel):
    role: str = Field(..., description="user | assistant")
    text: str = Field(..., min_length=1, max_length=2000)


class PatientChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: List[PatientChatMessage] = Field(default_factory=list)
    departments_context: List[str] = Field(default_factory=list)


class HospitalChatMessage(BaseModel):
    role: str = Field(..., description="user | assistant")
    text: str = Field(..., min_length=1, max_length=2000)


class HospitalChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: List[HospitalChatMessage] = Field(default_factory=list)
