from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class OptimizeRouteRequest(BaseModel):
    departments: List[str] = Field(..., min_length=2, max_length=6)
    wait_times: Dict[str, int] = Field(default_factory=dict)
    current_load: Dict[str, int] = Field(default_factory=dict)
    constraints: List[str] = Field(default_factory=list)
    hour: int = Field(default=9, ge=8, le=17)

    @field_validator("departments")
    @classmethod
    def unique_departments(cls, value: List[str]) -> List[str]:
        deduplicated = list(dict.fromkeys(item.strip() for item in value if item.strip()))
        if len(deduplicated) < 2:
            raise ValueError("At least two unique departments are required.")
        return deduplicated


class DepartmentSnapshot(BaseModel):
    id: str
    name: str
    zone: str
    floor: int
    capacity: int
    current_load: int = Field(ge=0, le=100)
    wait_time: int = Field(ge=0)
    status: Literal["green", "yellow", "red"]
    hourly_pattern: Dict[int, int]


class NowVsLaterQuery(BaseModel):
    department: Optional[str] = None
    departments: List[str] = Field(default_factory=list)
    now_hour: int = Field(default=9, ge=8, le=17)
    later_hour: int = Field(default=11, ge=8, le=17)
