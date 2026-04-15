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

def create_appointment(patient_id, dept_name, time, phone):
    """Tạo lịch khám mới (Tương ứng bảng APPOINTMENTS trong ERD)"""
    doc_ref = db.collection("appointments").document()
    doc_data = {
        "patient_id": patient_id,
        "department_name": dept_name,
        "scheduled_at": time,
        "patient_phone": phone,
        "status": "waiting", # Trạng thái hàng đợi
        "queue_number": 0,    # Sẽ được cập nhật sau
        "created_at": firestore.SERVER_TIMESTAMP
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
        "diagnosis": diagnosis, # Chẩn đoán từ Agent 2
        "treatment": treatment, # Phác đồ từ Agent 2
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