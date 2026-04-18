from datetime import date, datetime

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


def _is_blank(value):
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) == 0
    return False


def _first_present(*values):
    for value in values:
        if not _is_blank(value):
            return value
    return ""


def _parse_datetime(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if hasattr(value, "to_datetime"):
        try:
            return value.to_datetime()
        except Exception:
            return None
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        for candidate in (normalized, normalized.replace(" ", "T")):
            try:
                return datetime.fromisoformat(candidate)
            except ValueError:
                continue
        try:
            return datetime.combine(date.fromisoformat(value), datetime.min.time())
        except ValueError:
            return None
    return None


def _to_iso_string(value):
    parsed = _parse_datetime(value)
    if parsed:
        return parsed.isoformat()
    if value in (None, ""):
        return ""
    return str(value)


def _record_sort_key(record):
    for key in (
        "updated_at_iso",
        "created_at_iso",
        "current_date",
        "record_date",
        "updated_at",
        "created_at",
    ):
        parsed = _parse_datetime(record.get(key))
        if parsed:
            return parsed
    return datetime.min


def _normalize_age(value):
    if value in (None, ""):
        return ""
    if isinstance(value, bool):
        return ""
    if isinstance(value, int):
        return value
    text = str(value).strip()
    if text.isdigit():
        return int(text)
    return text


def _normalize_medication_item(item):
    if not isinstance(item, dict):
        text = str(item).strip()
        if not text:
            return None
        return {"name": text, "dosage": "", "usage": ""}

    name = _first_present(item.get("name"), item.get("drug"), item.get("generic"))
    dosage = _first_present(item.get("dosage"), item.get("dose"), item.get("quantity"))
    usage_parts = [
        item.get("usage"),
        item.get("instructions"),
        " ".join(
            str(part).strip()
            for part in (item.get("route"), item.get("frequency"))
            if str(part or "").strip()
        ).strip(),
        f"{item.get('days')} ngay" if item.get("days") not in (None, "") else "",
        item.get("note"),
        item.get("notes"),
    ]
    usage = " | ".join(part for part in usage_parts if str(part or "").strip())

    if _is_blank(name) and _is_blank(dosage) and _is_blank(usage):
        return None
    return {
        "name": str(name or "").strip(),
        "dosage": str(dosage or "").strip(),
        "usage": str(usage or "").strip(),
    }


def _normalize_medications(value):
    if _is_blank(value):
        return []
    items = value if isinstance(value, list) else [value]
    normalized = []
    for item in items:
        medication = _normalize_medication_item(item)
        if medication:
            normalized.append(medication)
    return normalized


def _normalize_string_list(value):
    if _is_blank(value):
        return []
    items = value if isinstance(value, list) else [value]
    normalized = []
    for item in items:
        if isinstance(item, dict):
            text = " ".join(
                part
                for part in (
                    str(item.get("name") or item.get("drug") or item.get("generic") or "").strip(),
                    str(item.get("dosage") or item.get("dose") or "").strip(),
                )
                if part
            ).strip()
        else:
            text = str(item).strip()
        if text:
            normalized.append(text)
    return normalized


def _normalize_treatment(value, *, fallback_description="", fallback_medications=None):
    if isinstance(value, dict):
        description = _first_present(
            value.get("description"),
            value.get("plan"),
            value.get("treatment_plan"),
            fallback_description,
        )
        medications = _normalize_medications(
            _first_present(value.get("medications"), value.get("prescriptions"), fallback_medications)
        )
        return {
            "description": str(description or "").strip(),
            "medications": medications,
        }

    description = _first_present(value, fallback_description)
    return {
        "description": str(description or "").strip(),
        "medications": _normalize_medications(fallback_medications),
    }


def _build_medical_record_payload(data, *, existing=None):
    existing = existing or {}
    patient_id = _first_present(data.get("patient_id"), existing.get("patient_id"))
    if not patient_id:
        raise ValueError("patient_id is required")

    profile = get_patient_info(patient_id) or {}
    existing_treatment = existing.get("treatment") if isinstance(existing.get("treatment"), dict) else {}
    existing_emr = existing.get("emr_data") if isinstance(existing.get("emr_data"), dict) else {}

    full_name = _first_present(
        data.get("full_name"),
        data.get("patient_name"),
        existing.get("full_name"),
        existing.get("patient_name"),
        profile.get("full_name"),
        profile.get("name"),
        patient_id,
    )
    age = _normalize_age(
        _first_present(
            data.get("age"),
            existing.get("age"),
            profile.get("age"),
        )
    )
    gender = _first_present(
        data.get("gender"),
        existing.get("gender"),
        profile.get("gender"),
    )

    diagnosis = _first_present(
        data.get("diagnosis"),
        data.get("preliminary_diagnosis"),
        existing.get("diagnosis"),
        existing.get("preliminary_diagnosis"),
        existing_emr.get("diagnosis"),
        existing_emr.get("preliminary_diagnosis"),
    )
    follow_up_date = _first_present(
        data.get("follow_up_date"),
        existing.get("follow_up_date"),
        existing_emr.get("follow_up_date"),
    )
    current_date = _first_present(
        data.get("current_date"),
        data.get("record_date"),
        existing.get("current_date"),
        existing.get("record_date"),
        date.today().isoformat(),
    )
    notes = _first_present(data.get("notes"), existing.get("notes"), existing_emr.get("notes"))

    chief_complaint = _first_present(
        data.get("chief_complaint"),
        existing.get("chief_complaint"),
        existing_emr.get("chief_complaint"),
    )
    symptoms = _first_present(data.get("symptoms"), existing.get("symptoms"), existing_emr.get("symptoms"))
    medical_history = _first_present(
        data.get("medical_history"),
        data.get("history"),
        existing.get("medical_history"),
        existing.get("history"),
        existing_emr.get("medical_history"),
        existing_emr.get("history"),
        profile.get("medical_history"),
    )
    allergies = _first_present(
        data.get("allergies"),
        existing.get("allergies"),
        existing_emr.get("allergies"),
        profile.get("allergies"),
    )
    current_medications = _normalize_string_list(
        _first_present(
            data.get("current_medications"),
            existing.get("current_medications"),
            existing_emr.get("current_medications"),
            profile.get("current_medications"),
        )
    )
    lab_orders = _first_present(
        data.get("lab_orders"),
        existing.get("lab_orders"),
        existing_emr.get("lab_orders"),
        [],
    )
    soap = _first_present(
        data.get("soap"),
        existing.get("soap"),
        existing_emr.get("soap"),
        None,
    )

    treatment = _normalize_treatment(
        data.get("treatment"),
        fallback_description=_first_present(
            data.get("treatment_plan"),
            existing.get("treatment_plan"),
            existing.get("treatment") if not isinstance(existing.get("treatment"), dict) else "",
            existing_treatment.get("description"),
            existing_emr.get("treatment_plan"),
        ),
        fallback_medications=_first_present(
            data.get("prescriptions"),
            existing.get("prescriptions"),
            existing_treatment.get("medications"),
            existing_emr.get("prescriptions"),
        ),
    )

    return _clean_dict(
        {
            "patient_id": patient_id,
            "full_name": str(full_name or "").strip(),
            "patient_name": str(full_name or "").strip(),
            "age": age,
            "gender": str(gender or "").strip(),
            "diagnosis": str(diagnosis or "").strip(),
            "preliminary_diagnosis": str(diagnosis or "").strip(),
            "treatment": treatment,
            "treatment_plan": treatment["description"],
            "prescriptions": treatment["medications"],
            "current_date": str(current_date or "").strip(),
            "record_date": str(current_date or "").strip(),
            "follow_up_date": str(follow_up_date or "").strip(),
            "notes": str(notes or "").strip(),
            "chief_complaint": str(chief_complaint or "").strip(),
            "symptoms": str(symptoms or "").strip(),
            "history": str(medical_history or "").strip(),
            "medical_history": str(medical_history or "").strip(),
            "allergies": str(allergies or "").strip(),
            "current_medications": current_medications,
            "lab_orders": lab_orders if isinstance(lab_orders, list) else [],
            "soap": soap if isinstance(soap, dict) else None,
            "doctor_id": _first_present(data.get("doctor_id"), existing.get("doctor_id")),
            "appointment_id": _first_present(data.get("appointment_id"), existing.get("appointment_id")),
            "department": _first_present(data.get("department"), existing.get("department")),
            "triage_level": _first_present(data.get("triage_level"), existing.get("triage_level")),
            "source_agent": _first_present(data.get("source_agent"), existing.get("source_agent"), "agent2_doctor"),
            "status": _first_present(data.get("status"), existing.get("status"), "completed"),
            "emr_data": {
                "patient_name": str(full_name or "").strip(),
                "chief_complaint": str(chief_complaint or "").strip(),
                "symptoms": str(symptoms or "").strip(),
                "history": str(medical_history or "").strip(),
                "medical_history": str(medical_history or "").strip(),
                "allergies": str(allergies or "").strip(),
                "current_medications": current_medications,
                "diagnosis": str(diagnosis or "").strip(),
                "preliminary_diagnosis": str(diagnosis or "").strip(),
                "treatment_plan": treatment["description"],
                "follow_up_date": str(follow_up_date or "").strip(),
                "prescriptions": treatment["medications"],
                "lab_orders": lab_orders if isinstance(lab_orders, list) else [],
                "notes": str(notes or "").strip(),
                "soap": soap if isinstance(soap, dict) else None,
            },
        }
    )


def _serialize_medical_record(document_id, data):
    payload = _build_medical_record_payload({"patient_id": data.get("patient_id"), **(data or {})}, existing=data or {})
    payload["medical_record_id"] = document_id
    payload["created_at"] = _to_iso_string(data.get("created_at"))
    payload["updated_at"] = _to_iso_string(data.get("updated_at"))
    payload["created_at_iso"] = _first_present(data.get("created_at_iso"), payload["created_at"])
    payload["updated_at_iso"] = _first_present(data.get("updated_at_iso"), payload["updated_at"])
    return payload


def _get_medical_record_docs(patient_id):
    docs = db.collection("medical_records").where("patient_id", "==", patient_id).stream()
    rows = []
    for doc in docs:
        data = doc.to_dict() or {}
        rows.append((doc, data))
    rows.sort(key=lambda item: _record_sort_key(item[1]), reverse=True)
    return rows


def _get_latest_medical_record_doc(patient_id):
    docs = _get_medical_record_docs(patient_id)
    return docs[0] if docs else (None, {})


def _sync_patient_profile_from_record(record, *, actor_role, source):
    name = record.get("full_name") or record.get("patient_name") or record.get("patient_id")
    save_patient_profile(
        record.get("patient_id"),
        name,
        None,
        full_name=name,
        age=record.get("age", ""),
        gender=record.get("gender", ""),
        source=source,
        actor_role=actor_role,
    )


def create_medical_record(record_data, *, medical_record_id=None, actor_id="", actor_role="doctor", source="backend"):
    """Create a medical record while preserving compatibility with existing consumers."""
    payload = _build_medical_record_payload(record_data)
    doc_ref = (
        db.collection("medical_records").document(medical_record_id)
        if medical_record_id
        else db.collection("medical_records").document()
    )
    now_iso = datetime.utcnow().isoformat()
    doc_ref.set(
        _clean_dict(
            {
                **payload,
                "medical_record_id": doc_ref.id,
                "created_at": _server_timestamp(),
                "updated_at": _server_timestamp(),
                "created_at_iso": now_iso,
                "updated_at_iso": now_iso,
                "last_updated_by_id": actor_id or payload.get("doctor_id", ""),
                "last_updated_by_role": actor_role,
            }
        ),
        merge=True,
    )
    append_workflow_event(
        "medical_record_created",
        patient_id=payload.get("patient_id", ""),
        appointment_id=payload.get("appointment_id", ""),
        medical_record_id=doc_ref.id,
        actor_id=actor_id or payload.get("doctor_id", ""),
        actor_role=actor_role,
        source=source,
        payload={
            "diagnosis": payload.get("diagnosis", ""),
            "follow_up_date": payload.get("follow_up_date", ""),
            "treatment_description": payload.get("treatment", {}).get("description", ""),
        },
    )
    _sync_patient_profile_from_record(payload, actor_role=actor_role, source=source)
    return doc_ref.id


def get_medical_records_by_patient(patient_id, *, limit=None):
    """Return medical records ordered from newest to oldest for a patient."""
    rows = [
        _serialize_medical_record(doc.id, data)
        for doc, data in _get_medical_record_docs(patient_id)
    ]
    if isinstance(limit, int) and limit > 0:
        return rows[:limit]
    return rows


def update_medical_record(patient_id, data, *, actor_id="", actor_role="patient", source="frontend_patient"):
    """Allow patients to fill missing fields while protecting doctor-entered content."""
    doc_snapshot, existing = _get_latest_medical_record_doc(patient_id)
    existing = existing or {}
    incoming = data or {}

    merged = dict(existing)
    merged["patient_id"] = patient_id

    for field in ("full_name", "age", "gender"):
        if not _is_blank(incoming.get(field)):
            merged[field] = incoming.get(field)

    for field in ("diagnosis", "current_date", "follow_up_date", "notes"):
        if _is_blank(existing.get(field)) and not _is_blank(incoming.get(field)):
            merged[field] = incoming.get(field)

    existing_treatment = existing.get("treatment") if isinstance(existing.get("treatment"), dict) else {}
    incoming_treatment = incoming.get("treatment") if isinstance(incoming.get("treatment"), dict) else {}
    merged_treatment = {
        "description": str(existing_treatment.get("description") or "").strip(),
        "medications": _normalize_medications(existing_treatment.get("medications")),
    }
    if _is_blank(merged_treatment["description"]) and not _is_blank(incoming_treatment.get("description")):
        merged_treatment["description"] = str(incoming_treatment.get("description") or "").strip()
    if not merged_treatment["medications"] and not _is_blank(incoming_treatment.get("medications")):
        merged_treatment["medications"] = _normalize_medications(incoming_treatment.get("medications"))
    if not _is_blank(merged_treatment["description"]) or merged_treatment["medications"]:
        merged["treatment"] = merged_treatment

    payload = _build_medical_record_payload(merged, existing=existing)
    now_iso = datetime.utcnow().isoformat()

    if doc_snapshot is None:
        doc_ref = db.collection("medical_records").document()
        payload["created_at"] = _server_timestamp()
        payload["created_at_iso"] = now_iso
    else:
        doc_ref = doc_snapshot.reference

    doc_ref.set(
        _clean_dict(
            {
                **payload,
                "medical_record_id": doc_ref.id,
                "updated_at": _server_timestamp(),
                "updated_at_iso": now_iso,
                "last_updated_by_id": actor_id or patient_id,
                "last_updated_by_role": actor_role,
            }
        ),
        merge=True,
    )
    append_workflow_event(
        "medical_record_updated",
        patient_id=patient_id,
        appointment_id=payload.get("appointment_id", ""),
        medical_record_id=doc_ref.id,
        actor_id=actor_id or patient_id,
        actor_role=actor_role,
        source=source,
        payload={
            "updated_fields": sorted(list((data or {}).keys())),
            "protected_fields_preserved": ["diagnosis", "treatment", "current_date", "follow_up_date", "notes"],
        },
    )
    _sync_patient_profile_from_record(payload, actor_role=actor_role, source=source)
    return _serialize_medical_record(doc_ref.id, {**existing, **payload, "updated_at_iso": now_iso})


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
    return create_medical_record(
        {
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "diagnosis": diagnosis,
            "treatment": {
                "description": str(treatment or "").strip(),
                "medications": [],
            },
            "current_date": date.today().isoformat(),
        },
        actor_id=doctor_id,
        actor_role="doctor",
        source="backend_agent2",
    )


def get_patient_info(patient_id):
    """Read a patient profile from the existing patients collection."""
    doc = db.collection("patients").document(patient_id).get()
    if doc.exists:
        return doc.to_dict()
    return None


def save_patient_profile(uid, name, phone=None, **kwargs):
    """Upsert patient profile fields without replacing the whole document."""
    doc_ref = db.collection("patients").document(uid)
    payload = _clean_dict(kwargs)
    doc_data = _clean_dict(
        {
            "name": name,
            "phone": phone,
            "updated_at": _server_timestamp(),
            **payload,
        }
    )
    doc_ref.set(doc_data, merge=True)
    append_workflow_event(
        "patient_profile_upserted",
        patient_id=uid,
        actor_id=uid,
        actor_role=payload.get("actor_role", "patient"),
        source=payload.get("source", "frontend"),
        payload=_clean_dict({"name": name, "phone": phone, **payload}),
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


def get_doctor_queue_appointments(*, limit=200, statuses=None):
    """Fetch appointment items for the doctor workspace."""
    allowed_statuses = (
        {
            str(status).strip().lower()
            for status in (statuses or [])
            if str(status).strip()
        }
        if statuses is not None
        else set()
    )
    docs = db.collection("appointments").limit(limit).stream()
    results = []
    for doc in docs:
        data = doc.to_dict() or {}
        status = str(data.get("status") or "waiting").strip().lower()
        if allowed_statuses and status not in allowed_statuses:
            continue
        results.append({"id": doc.id, **data})
    results.sort(
        key=lambda item: _parse_datetime(
            item.get("created_at") or item.get("scheduled_at") or item.get("updated_at")
        )
        or datetime.min
    )
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
