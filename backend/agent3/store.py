from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Any, Callable
from uuid import uuid4
import unicodedata

from agent3.static_data import (
    DEFAULT_HOSPITAL_MAP,
    DEFAULT_STAFF,
    DEPARTMENT_ALIASES,
    DEPARTMENT_META,
    SAMPLE_PATIENT_ORDERS,
    TEST_DB,
)

try:
    from database_firebase import append_workflow_event, db as firebase_db, update_appointment_status

    FIREBASE_AVAILABLE = True
except Exception:
    append_workflow_event = None
    firebase_db = None
    update_appointment_status = None
    FIREBASE_AVAILABLE = False


_memory_patient_state: dict[str, dict[str, Any]] = {
    patient_id: {"current_step": "Registration", "completed": []}
    for patient_id in SAMPLE_PATIENT_ORDERS
}
_memory_navigation_logs: list[dict[str, Any]] = []
_memory_staff: dict[str, dict[str, Any]] = {item["id"]: deepcopy(item) for item in DEFAULT_STAFF}
_memory_hospital_map: dict[str, dict[str, Any]] = {
    item["id"]: deepcopy(item) for item in DEFAULT_HOSPITAL_MAP
}
_memory_queue_status: dict[str, dict[str, Any]] = {}
_memory_system_metrics: list[dict[str, Any]] = []


def now_iso() -> str:
    return datetime.utcnow().isoformat()


def normalize_text(value: str | None) -> str:
    raw = str(value or "").strip().lower()
    raw = raw.replace("đ", "d").replace("Đ", "d")
    no_accents = unicodedata.normalize("NFD", raw)
    no_accents = "".join(ch for ch in no_accents if unicodedata.category(ch) != "Mn")
    return " ".join(no_accents.split())


def safe_doc_id(*parts: str) -> str:
    cleaned = "-".join(normalize_text(part).replace(" ", "-") for part in parts if part)
    return cleaned[:96] or str(uuid4())


def canonical_department_name(value: str | None) -> str:
    text = normalize_text(value)
    if not text:
        return ""
    for department in DEPARTMENT_META:
        if normalize_text(department) == text:
            return department
        if normalize_text(DEPARTMENT_META[department]["vi"]) == text:
            return department
    for test_name in TEST_DB:
        if normalize_text(test_name) == text:
            return test_name
    return DEPARTMENT_ALIASES.get(text, value or "")


def serialize_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: serialize_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    if hasattr(value, "isoformat") and callable(value.isoformat):
        try:
            return value.isoformat()
        except Exception:
            return value
    return value


def serialize_doc(doc: Any) -> dict[str, Any]:
    payload = serialize_value(doc.to_dict() if hasattr(doc, "to_dict") else dict(doc or {}))
    if hasattr(doc, "id"):
        payload.setdefault("id", doc.id)
    return payload


def _stream_collection(name: str) -> list[dict[str, Any]]:
    if not FIREBASE_AVAILABLE or firebase_db is None:
        return []
    try:
        return [serialize_doc(doc) for doc in firebase_db.collection(name).stream()]
    except Exception:
        return []


def _query_collection(name: str, field: str, value: Any) -> list[dict[str, Any]]:
    if not FIREBASE_AVAILABLE or firebase_db is None:
        return []
    try:
        return [serialize_doc(doc) for doc in firebase_db.collection(name).where(field, "==", value).stream()]
    except Exception:
        return []


def _set_document(collection: str, document_id: str, payload: dict[str, Any], merge: bool = True) -> None:
    if not FIREBASE_AVAILABLE or firebase_db is None:
        return
    try:
        firebase_db.collection(collection).document(document_id).set(payload, merge=merge)
    except Exception:
        return


def _delete_document(collection: str, document_id: str) -> None:
    if not FIREBASE_AVAILABLE or firebase_db is None:
        return
    try:
        firebase_db.collection(collection).document(document_id).delete()
    except Exception:
        return


def _append_workflow(event_type: str, **kwargs: Any) -> None:
    if append_workflow_event is None:
        return
    try:
        append_workflow_event(event_type, **kwargs)
    except Exception:
        return


def get_patient_profile(patient_id: str) -> dict[str, Any]:
    if FIREBASE_AVAILABLE and firebase_db is not None:
        try:
            doc = firebase_db.collection("patients").document(patient_id).get()
            if doc.exists:
                return serialize_doc(doc)
        except Exception:
            return {}
    return {}


def list_patient_appointments(patient_id: str | None = None) -> list[dict[str, Any]]:
    if patient_id:
        rows = _query_collection("appointments", "patient_id", patient_id)
    else:
        rows = _stream_collection("appointments")
    if not rows:
        fallback = []
        for patient_key, order_data in SAMPLE_PATIENT_ORDERS.items():
            if patient_id and patient_key != patient_id:
                continue
            dept = next(
                (
                    item
                    for item in order_data["orders"]
                    if item in DEPARTMENT_META or canonical_department_name(item) in DEPARTMENT_META
                ),
                "Internal",
            )
            fallback.append(
                {
                    "id": f"appt-{patient_key.lower()}",
                    "patient_id": patient_key,
                    "patient_name": f"Sample {patient_key}",
                    "department_name": canonical_department_name(dept) or "Internal",
                    "recommended_department": canonical_department_name(dept) or "Internal",
                    "scheduled_at": f"{datetime.utcnow().date().isoformat()} 09:00",
                    "status": "waiting",
                    "queue_number": 0,
                    "created_at_iso": now_iso(),
                }
            )
        rows = fallback
    rows.sort(
        key=lambda item: (
            item.get("updated_at") or item.get("updated_at_iso") or item.get("created_at") or item.get("created_at_iso") or ""
        ),
        reverse=True,
    )
    return rows


def list_patient_medical_records(patient_id: str) -> list[dict[str, Any]]:
    rows = _query_collection("medical_records", "patient_id", patient_id)
    rows.sort(key=lambda item: item.get("record_date") or item.get("updated_at") or "", reverse=True)
    return rows


def get_patient_orders(patient_id: str) -> dict[str, Any]:
    orders: list[str] = []
    appointment_id = ""
    for appt in list_patient_appointments(patient_id):
        appointment_id = appointment_id or appt.get("id", "")
        for field in ("recommended_department", "department_name", "department"):
            candidate = canonical_department_name(appt.get(field))
            if candidate and candidate not in orders:
                orders.append(candidate)

    medical_record_id = ""
    for record in list_patient_medical_records(patient_id):
        medical_record_id = medical_record_id or record.get("id", "") or record.get("emr_id", "")
        for item in record.get("lab_orders", []) or []:
            candidate = canonical_department_name(item)
            if candidate and candidate not in orders:
                orders.append(candidate)
        diagnosis_department = canonical_department_name(record.get("department"))
        if diagnosis_department and diagnosis_department not in orders:
            orders.append(diagnosis_department)

    if not orders and patient_id in SAMPLE_PATIENT_ORDERS:
        sample = SAMPLE_PATIENT_ORDERS[patient_id]
        orders = [canonical_department_name(item) or item for item in sample["orders"]]

    return {
        "patient_id": patient_id,
        "appointment_id": appointment_id,
        "medical_record_id": medical_record_id,
        "orders": orders,
    }


def get_patient_state(patient_id: str) -> dict[str, Any]:
    if FIREBASE_AVAILABLE:
        docs = _query_collection("navigation_logs", "patient_id", patient_id)
        docs = [item for item in docs if isinstance(item.get("state"), dict)]
        docs.sort(key=lambda item: item.get("created_at_iso", ""), reverse=True)
        if docs:
            return docs[0]["state"]
    return deepcopy(_memory_patient_state.setdefault(patient_id, {"current_step": "Registration", "completed": []}))


def log_navigation_event(
    patient_id: str,
    *,
    event_type: str,
    appointment_id: str = "",
    medical_record_id: str = "",
    route: list[str] | None = None,
    state: dict[str, Any] | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    entry = {
        "id": f"nav-{uuid4().hex[:12]}",
        "patient_id": patient_id,
        "appointment_id": appointment_id,
        "medical_record_id": medical_record_id,
        "event_type": event_type,
        "route": route or [],
        "state": deepcopy(state or {}),
        "payload": deepcopy(payload or {}),
        "created_at_iso": now_iso(),
    }
    _memory_navigation_logs.append(entry)
    _set_document("navigation_logs", entry["id"], entry, merge=False)
    _append_workflow(
        "agent3_navigation_event",
        patient_id=patient_id,
        appointment_id=appointment_id,
        medical_record_id=medical_record_id,
        actor_id=patient_id,
        actor_role="patient",
        source="backend_agent3",
        payload={"event_type": event_type, **(payload or {})},
    )
    return deepcopy(entry)


def update_patient_state(
    patient_id: str,
    completed_step: str,
    current_step: str | None,
    *,
    appointment_id: str = "",
    note: str = "",
) -> dict[str, Any]:
    current = get_patient_state(patient_id)
    normalized_completed = canonical_department_name(completed_step) or completed_step
    if normalized_completed and normalized_completed not in current["completed"]:
        current["completed"].append(normalized_completed)
    if current_step is not None:
        current["current_step"] = canonical_department_name(current_step) or current_step
    elif normalized_completed:
        current["current_step"] = normalized_completed
    _memory_patient_state[patient_id] = deepcopy(current)
    log_navigation_event(
        patient_id,
        event_type="progress_updated",
        appointment_id=appointment_id,
        state=current,
        payload={"completed_step": normalized_completed, "note": note},
    )
    return deepcopy(current)


def list_staff() -> list[dict[str, Any]]:
    rows = _stream_collection("hospital_staff")
    if not rows:
        rows = [deepcopy(item) for item in _memory_staff.values()]
    rows.sort(key=lambda item: (item.get("department", ""), item.get("name", "")))
    return rows


def create_staff(payload: dict[str, Any]) -> dict[str, Any]:
    staff_id = payload.get("id") or f"staff-{uuid4().hex[:10]}"
    item = {"id": staff_id, **payload, "updated_at_iso": now_iso()}
    _memory_staff[staff_id] = deepcopy(item)
    _set_document("hospital_staff", staff_id, item, merge=False)
    _append_workflow("agent3_staff_created", actor_id=staff_id, actor_role="benhvien", source="backend_agent3", payload=item)
    return deepcopy(item)


def update_staff(staff_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    existing = next((item for item in list_staff() if item["id"] == staff_id), {"id": staff_id})
    item = {**existing, **payload, "id": staff_id, "updated_at_iso": now_iso()}
    _memory_staff[staff_id] = deepcopy(item)
    _set_document("hospital_staff", staff_id, item, merge=True)
    _append_workflow("agent3_staff_updated", actor_id=staff_id, actor_role="benhvien", source="backend_agent3", payload=item)
    return deepcopy(item)


def delete_staff(staff_id: str) -> None:
    _memory_staff.pop(staff_id, None)
    _delete_document("hospital_staff", staff_id)
    _append_workflow("agent3_staff_deleted", actor_id=staff_id, actor_role="benhvien", source="backend_agent3")


def list_hospital_map() -> list[dict[str, Any]]:
    rows = _stream_collection("hospital_map")
    if not rows:
        rows = [deepcopy(item) for item in _memory_hospital_map.values()]
        for item in rows:
            _set_document("hospital_map", item["id"], item, merge=False)
    rows.sort(key=lambda item: (str(item.get("floor", 0)), item.get("department", "")))
    return rows


def create_room(payload: dict[str, Any]) -> dict[str, Any]:
    room_id = payload.get("id") or f"room-{uuid4().hex[:10]}"
    item = {"id": room_id, **payload, "updated_at_iso": now_iso()}
    _memory_hospital_map[room_id] = deepcopy(item)
    _set_document("hospital_map", room_id, item, merge=False)
    _append_workflow("agent3_room_created", actor_id=room_id, actor_role="benhvien", source="backend_agent3", payload=item)
    return deepcopy(item)


def update_room(room_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    existing = next((item for item in list_hospital_map() if item["id"] == room_id), {"id": room_id})
    item = {**existing, **payload, "id": room_id, "updated_at_iso": now_iso()}
    _memory_hospital_map[room_id] = deepcopy(item)
    _set_document("hospital_map", room_id, item, merge=True)
    _append_workflow("agent3_room_updated", actor_id=room_id, actor_role="benhvien", source="backend_agent3", payload=item)
    return deepcopy(item)


def delete_room(room_id: str) -> None:
    _memory_hospital_map.pop(room_id, None)
    _delete_document("hospital_map", room_id)
    _append_workflow("agent3_room_deleted", actor_id=room_id, actor_role="benhvien", source="backend_agent3")


def get_staff_counts_by_department() -> dict[str, dict[str, int]]:
    counts: dict[str, dict[str, int]] = {}
    for item in list_staff():
        department = canonical_department_name(item.get("department")) or item.get("department", "")
        if not department:
            continue
        role = item.get("role", "doctor")
        department_counts = counts.setdefault(department, {"doctor": 0, "nurse": 0})
        if role == "doctor":
            department_counts["doctor"] += 1
        elif role == "nurse":
            department_counts["nurse"] += 1
    return counts


def get_room_overrides() -> dict[str, dict[str, Any]]:
    overrides: dict[str, dict[str, Any]] = {}
    for item in list_hospital_map():
        department = canonical_department_name(item.get("department")) or item.get("department", "")
        if department and department not in overrides:
            overrides[department] = item
    return overrides


def get_appointment_queue_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for appt in list_patient_appointments():
        if appt.get("status") in {"completed", "cancelled"}:
            continue
        department = canonical_department_name(
            appt.get("current_department") or appt.get("recommended_department") or appt.get("department_name")
        )
        if not department:
            continue
        counts[department] = counts.get(department, 0) + 1
    return counts


def sync_queue_status(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    snapshot = []
    for item in rows:
        entry = {
            "id": safe_doc_id(item["department"]),
            "department": item["department"],
            "load_pct": item["load_pct"],
            "wait_time": item["wait_time"],
            "alert_level": item["alert_level"],
            "waiting": item["waiting"],
            "in_service": item["in_service"],
            "capacity": item["capacity"],
            "updated_at_iso": now_iso(),
        }
        _memory_queue_status[entry["id"]] = deepcopy(entry)
        _set_document("queue_status", entry["id"], entry, merge=True)
        snapshot.append(entry)
    return snapshot


def list_queue_status() -> list[dict[str, Any]]:
    rows = _stream_collection("queue_status")
    if not rows:
        rows = [deepcopy(item) for item in _memory_queue_status.values()]
    rows.sort(key=lambda item: item.get("department", ""))
    return rows


def save_system_metric(payload: dict[str, Any]) -> dict[str, Any]:
    metric = {"id": f"metric-{uuid4().hex[:12]}", **payload, "created_at_iso": now_iso()}
    _memory_system_metrics.insert(0, deepcopy(metric))
    _set_document("system_metrics", metric["id"], metric, merge=False)
    return deepcopy(metric)


def list_system_metrics(limit: int = 20) -> list[dict[str, Any]]:
    rows = _stream_collection("system_metrics")
    if not rows:
        rows = [deepcopy(item) for item in _memory_system_metrics]
    rows.sort(key=lambda item: item.get("created_at_iso", ""), reverse=True)
    return rows[:limit]


def list_patient_flows() -> list[dict[str, Any]]:
    flows = []
    for appt in list_patient_appointments():
        patient_id = appt.get("patient_id", "")
        patient_state = get_patient_state(patient_id)
        orders = get_patient_orders(patient_id)
        flow = {
            "appointment_id": appt.get("id", ""),
            "patient_id": patient_id,
            "patient_name": appt.get("patient_name") or get_patient_profile(patient_id).get("name") or patient_id,
            "status": appt.get("status", "waiting"),
            "department_name": canonical_department_name(appt.get("department_name")) or appt.get("department_name", ""),
            "recommended_department": canonical_department_name(appt.get("recommended_department"))
            or appt.get("recommended_department", ""),
            "scheduled_at": appt.get("scheduled_at", ""),
            "current_step": patient_state.get("current_step"),
            "completed": patient_state.get("completed", []),
            "order_count": len(orders.get("orders", [])),
            "appointment_payload": appt,
        }
        flows.append(flow)
    flows.sort(key=lambda item: item.get("scheduled_at", ""))
    return flows


def update_patient_flow_status(
    appointment_id: str,
    *,
    status: str,
    current_step: str | None,
    note: str = "",
) -> dict[str, Any]:
    appointment = next((item for item in list_patient_appointments() if item.get("id") == appointment_id), None)
    if appointment is None:
        raise KeyError("Appointment not found")

    patient_id = appointment.get("patient_id", "")
    if current_step is not None:
        current_state = get_patient_state(patient_id)
        _memory_patient_state[patient_id] = {
            "current_step": canonical_department_name(current_step) or current_step,
            "completed": current_state.get("completed", []),
        }
        log_navigation_event(
            patient_id,
            event_type="patient_flow_status_updated",
            appointment_id=appointment_id,
            state=_memory_patient_state[patient_id],
            payload={"status": status, "note": note},
        )

    if FIREBASE_AVAILABLE and update_appointment_status is not None:
        update_appointment_status(
            appointment_id,
            status,
            patient_id=patient_id,
            actor_id="hospital_operator",
            actor_role="benhvien",
            current_department=current_step or appointment.get("current_department", ""),
            status_note=note,
            source="backend_agent3",
        )

    return {
        "appointment_id": appointment_id,
        "patient_id": patient_id,
        "status": status,
        "current_step": canonical_department_name(current_step) or current_step,
        "note": note,
    }


def build_overview_snapshot(load_rows: list[dict[str, Any]]) -> dict[str, Any]:
    staff_rows = list_staff()
    rooms = list_hospital_map()
    active_flows = [item for item in list_patient_flows() if item.get("status") != "completed"]
    return {
        "average_load": round(sum(item["load_pct"] for item in load_rows) / max(1, len(load_rows)), 1),
        "critical_departments": [item["department"] for item in load_rows if item["alert_level"] == "red"],
        "staff_total": len(staff_rows),
        "doctor_total": sum(1 for item in staff_rows if item.get("role") == "doctor"),
        "nurse_total": sum(1 for item in staff_rows if item.get("role") == "nurse"),
        "room_total": len(rooms),
        "active_patient_flows": len(active_flows),
        "waiting_patients": sum(1 for item in active_flows if item.get("status") == "waiting"),
    }
