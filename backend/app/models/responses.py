from typing import TypeVar, Generic, Optional, Any
from pydantic import BaseModel

T = TypeVar("T")

class StandardResponse(BaseModel, Generic[T]):
    '''
    Chuẩn Response format theo PRD:
    {
      "status": "success" | "error",
      "message": "string",
      "data": {} hay []
    }
    '''
    status: str
    message: str
    data: Optional[T] = None
