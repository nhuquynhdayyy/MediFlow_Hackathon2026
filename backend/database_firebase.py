from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore


if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()


def _server_timestamp():
    return firestore.SERVER_TIMESTAMP


def _clean_dict(data):
    return {key: value for key, value in (data or {}).items() if value is not None}


def append_workflow_event(
    event_type,
    *,
    patient_id="",
    appointment_id="",
    medical_record_id="",
    actor_id="system",
    actor_role="system",
    source="backend",
    payload=None,
):
    """Append an audit event without changing existing collections."""
    doc_ref = db.collection("workflow_events").document()
    doc_ref.set(
        _clean_dict(
            {
                "event_type": event_type,
                "patient_id": patient_id,
                "appointment_id": appointment_id,
                "medical_record_id": medical_record_id,
                "actor_id": actor_id,
                "actor_role": actor_role,
                "source": source,
                "payload": payload or {},
                "created_at": _server_timestamp(),
                "created_at_iso": datetime.utcnow().isoformat(),
            }
        )
    )
    return doc_ref.id


def save_ai_recommendation(
    *,
    agent_name,
    recommendation_type,
    request_payload,
    response_payload,
    patient_id="",
    appointment_id="",
    medical_record_id="",
    doctor_id="",
    status="generated",
):
    """Persist AI outputs for future review and Agent 3 analytics."""
    doc_ref = db.collection("ai_recommendations").document()
    doc_ref.set(
        _clean_dict(
            {
                "agent_name": agent_name,
                "recommendation_type": recommendation_type,
                "patient_id": patient_id,
                "appointment_id": appointment_id,
                "medical_record_id": medical_record_id,
                "doctor_id": doctor_id,
                "status": status,
                "request_payload": request_payload or {},
                "response_payload": response_payload,
                "created_at": _server_timestamp(),
                "created_at_iso": datetime.utcnow().isoformat(),
            }
        )
    )
    return doc_ref.id


def update_appointment_status(appointment_id, status, **kwargs):
    """Update appointment state while preserving old documents."""
    doc_ref = db.collection("appointments").document(appointment_id)
    history_entry = {
        "status": status,
        "source": kwargs.get("source", "backend"),
        "actor_role": kwargs.get("actor_role", "system"),
        "actor_id": kwargs.get("actor_id", "system"),
        "timestamp": datetime.utcnow().isoformat(),
    }
    update_payload = _clean_dict(
        {
            "status": status,
            "updated_at": _server_timestamp(),
            "status_history": firestore.ArrayUnion([history_entry]),
            **kwargs,
        }
    )
    doc_ref.set(update_payload, merge=True)
    append_workflow_event(
        "appointment_status_updated",
        patient_id=kwargs.get("patient_id", ""),
        appointment_id=appointment_id,
        actor_id=kwargs.get("actor_id", "system"),
        actor_role=kwargs.get("actor_role", "system"),
        source=kwargs.get("source", "backend"),
        payload={"status": status, **update_payload},
    )
    return appointment_id


def create_appointment(patient_id, dept_name, time, phone, **kwargs):
    """Create a new appointment using the existing appointments collection."""
    doc_ref = db.collection("appointments").document()
    payload = _clean_dict(kwargs)
    status_history = payload.pop("status_history", []) or []
    created_by = payload.get("created_by", "agent1")
    doc_data = {
        "patient_id": patient_id,
        "department_name": dept_name,
        "scheduled_at": time,
        "patient_phone": phone,
        "status": "waiting",
        "queue_number": 0,
        "created_at": _server_timestamp(),
        "updated_at": _server_timestamp(),
        "created_by": created_by,
        "status_history": status_history
        + [
            {
                "status": "waiting",
                "source": payload.get("source", "frontend_agent1"),
                "actor_role": payload.get("actor_role", "patient"),
                "actor_id": payload.get("patient_uid") or patient_id,
                "timestamp": datetime.utcnow().isoformat(),
            }
        ],
        **payload,
    }
    doc_ref.set(doc_data)
    append_workflow_event(
        "appointment_created",
        patient_id=patient_id,
        appointment_id=doc_ref.id,
        actor_id=payload.get("patient_uid") or patient_id,
        actor_role=payload.get("actor_role", "patient"),
        source=payload.get("source", "frontend_agent1"),
        payload={
            "department_name": dept_name,
            "scheduled_at": time,
            "triage_level": payload.get("triage_level"),
            "symptoms": payload.get("symptoms", ""),
            "chief_complaint": payload.get("chief_complaint", ""),
        },
    )
    return doc_ref.id


def save_medical_record(patient_id, doctor_id, diagnosis, treatment):
    """Save a medical record using the existing medical_records collection."""
    doc_ref = db.collection("medical_records").document()
    doc_data = {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "diagnosis": diagnosis,
        "treatment": treatment,
        "record_date": _server_timestamp(),
    }
    doc_ref.set(doc_data)
    append_workflow_event(
        "medical_record_created",
        patient_id=patient_id,
        medical_record_id=doc_ref.id,
        actor_id=doctor_id,
        actor_role="doctor",
        source="backend_agent2",
        payload={"diagnosis": diagnosis, "treatment": treatment},
    )
    return doc_ref.id


def get_patient_info(patient_id):
    """Read a patient profile from the existing patients collection."""
    doc = db.collection("patients").document(patient_id).get()
    if doc.exists:
        return doc.to_dict()
    return None


def save_patient_profile(uid, name, phone, **kwargs):
    """Upsert patient profile fields without replacing the whole document."""
    doc_ref = db.collection("patients").document(uid)
    payload = _clean_dict(kwargs)
    doc_data = {
        "name": name,
        "phone": phone,
        "updated_at": _server_timestamp(),
        **payload,
    }
    doc_ref.set(doc_data, merge=True)
    append_workflow_event(
        "patient_profile_upserted",
        patient_id=uid,
        actor_id=uid,
        actor_role=payload.get("actor_role", "patient"),
        source=payload.get("source", "frontend"),
        payload={"name": name, "phone": phone, **payload},
    )
    return uid


def get_appointments_by_uid(uid):
    """Fetch the latest appointments for a patient uid."""
    docs = (
        db.collection("appointments")
        .where("patient_id", "==", uid)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(20)
        .stream()
    )
    results = []
    for doc in docs:
        data = doc.to_dict()
        if data.get("created_at"):
            data["created_at"] = str(data["created_at"])
        if data.get("updated_at"):
            data["updated_at"] = str(data["updated_at"])
        results.append({"id": doc.id, **data})
    return results


def save_chat_session(session_id, uid, messages, triage_level=None, department=None):
    """Backwards-compatible triage chat persistence."""
    save_chat_session_enriched(
        session_id=session_id,
        uid=uid,
        messages=messages,
        triage_level=triage_level,
        department=department,
    )


def save_chat_session_enriched(
    *,
    session_id,
    uid,
    messages,
    triage_level=None,
    department=None,
    summary="",
    chief_complaint="",
    recommended_action="",
    source="frontend_agent1",
):
    """Persist triage chat history with richer metadata."""
    doc_ref = db.collection("chat_sessions").document(session_id)
    doc_ref.set(
        _clean_dict(
            {
                "patient_uid": uid,
                "messages": messages,
                "triage_level": triage_level,
                "department": department,
                "summary": summary,
                "chief_complaint": chief_complaint,
                "recommended_action": recommended_action,
                "updated_at": _server_timestamp(),
                "source": source,
            }
        ),
        merge=True,
    )
    append_workflow_event(
        "triage_session_saved",
        patient_id=uid,
        actor_id=uid,
        actor_role="patient",
        source=source,
        payload={
            "session_id": session_id,
            "triage_level": triage_level,
            "department": department,
            "message_count": len(messages or []),
        },
    )
