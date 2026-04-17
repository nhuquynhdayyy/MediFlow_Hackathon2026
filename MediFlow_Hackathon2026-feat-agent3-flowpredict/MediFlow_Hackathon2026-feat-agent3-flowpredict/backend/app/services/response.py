from typing import Any, Dict


def success_response(message: str, data: Any) -> Dict[str, Any]:
    return {"status": "success", "message": message, "data": data}


def error_response(message: str, data: Any = None) -> Dict[str, Any]:
    return {"status": "error", "message": message, "data": data or {}}
