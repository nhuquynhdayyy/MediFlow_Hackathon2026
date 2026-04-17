import firebase_admin
from firebase_admin import credentials, firestore

# 1. Khởi tạo (Chỉ chạy 1 lần duy nhất)
if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()

# ==========================================
# NHÓM AGENT 1: TRIAGE & ĐẶT LỊCH
# ==========================================

def create_appointment(patient_id, dept_name, time, phone, **kwargs):
    """Tạo lịch khám mới (Tương ứng bảng APPOINTMENTS trong ERD)"""
    doc_ref = db.collection("appointments").document()
    doc_data = {
        "patient_id": patient_id,
        "department_name": dept_name,
        "scheduled_at": time,
        "patient_phone": phone,
        "status": "waiting",
        "queue_number": 0,
        "created_at": firestore.SERVER_TIMESTAMP,
        **kwargs,  # triage_level, symptoms, session_id, patient_name...
    }
    doc_ref.set(doc_data)
    return doc_ref.id

# ==========================================
# NHÓM AGENT 2: DOCASSIST & HỒ SƠ BỆNH ÁN (EMR)
# ==========================================

def save_medical_record(patient_id, doctor_id, diagnosis, treatment):
    """Lưu hồ sơ bệnh án (Tương ứng bảng MEDICAL_RECORDS trong ERD)"""
    doc_ref = db.collection("medical_records").document()
    doc_data = {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "diagnosis": diagnosis,
        "treatment": treatment,
        "record_date": firestore.SERVER_TIMESTAMP
    }
    doc_ref.set(doc_data)
    return doc_ref.id

# ==========================================
# NHÓM QUẢN TRỊ: TRA CỨU DỮ LIỆU
# ==========================================

def get_patient_info(patient_id):
    """Lấy thông tin bệnh nhân (Tương ứng bảng PATIENTS trong ERD)"""
    doc = db.collection("patients").document(patient_id).get()
    if doc.exists:
        return doc.to_dict()
    return None

# ==========================================
# MỚI: PATIENT PROFILE & APPOINTMENTS QUERY
# ==========================================

def save_patient_profile(uid, name, phone, **kwargs):
    """Lưu/cập nhật hồ sơ bệnh nhân theo Firebase UID"""
    doc_ref = db.collection("patients").document(uid)
    doc_data = {
        "name": name,
        "phone": phone,
        "updated_at": firestore.SERVER_TIMESTAMP,
        **kwargs,
    }
    doc_ref.set(doc_data, merge=True)
    return uid

def get_appointments_by_uid(uid):
    """Lấy danh sách lịch hẹn của bệnh nhân theo UID"""
    docs = db.collection("appointments") \
        .where("patient_id", "==", uid) \
        .order_by("created_at", direction=firestore.Query.DESCENDING) \
        .limit(20).stream()
    results = []
    for d in docs:
        data = d.to_dict()
        # Convert SERVER_TIMESTAMP to string for JSON serialization
        if data.get("created_at"):
            data["created_at"] = str(data["created_at"])
        results.append({"id": d.id, **data})
    return results

def save_chat_session(session_id, uid, messages, triage_level=None, department=None):
    """Lưu phiên chat triage vào Firestore"""
    doc_ref = db.collection("chat_sessions").document(session_id)
    doc_ref.set({
        "patient_uid": uid,
        "messages": messages,
        "triage_level": triage_level,
        "department": department,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }, merge=True)