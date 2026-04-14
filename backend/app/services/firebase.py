import os
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

class MockFirebaseDB:
    """Mock database thay thế cho Firebase Admin nếu chưa có credentials."""

    SPECIALTIES = ["Nội khoa", "Ngoại khoa", "Nhi khoa", "Sản khoa", "Tai Mũi Họng"]
    STATUS_CHOICES = ["waiting", "in_progress", "completed"]

    def __init__(self):
        self.connected = True
        print("Mock Firebase initialized.")

    def get_collection(self, name: str):
        key = name.lower()
        if key == "triage_sessions":
            return self._mock_triage_sessions()
        if key == "doctor_sessions":
            return self._mock_doctor_sessions()
        if key == "hospital_load":
            return self._mock_hospital_load()
        return []

    def _mock_triage_sessions(self):
        sessions = []
        now = datetime.now()
        for i in range(180):
            specialty = random.choice(self.SPECIALTIES)
            status = random.choices(self.STATUS_CHOICES, weights=[35, 20, 45])[0]
            sessions.append({
                "patient_id": f"P{1000 + i}",
                "specialty": specialty,
                "status": status,
                "created_at": (now - timedelta(minutes=random.randint(5, 240))).isoformat(),
            })
        return sessions

    def _mock_doctor_sessions(self):
        sessions = []
        now = datetime.now()
        for i in range(90):
            specialty = random.choice(self.SPECIALTIES)
            status = random.choices(["in_progress", "completed"], weights=[40, 60])[0]
            sessions.append({
                "patient_id": f"D{2000 + i}",
                "specialty": specialty,
                "status": status,
                "created_at": (now - timedelta(minutes=random.randint(10, 180))).isoformat(),
            })
        return sessions

    def _mock_hospital_load(self):
        return [
            {
                "specialty": specialty,
                "current_patients": random.randint(6, 55),
                "capacity": random.randint(50, 90),
                "updated_at": datetime.now().isoformat(),
            }
            for specialty in self.SPECIALTIES
        ]

try:
    firebase_cred_path = os.getenv("FIREBASE_CREDENTIALS")
    if firebase_cred_path and os.path.exists(firebase_cred_path):
        import firebase_admin
        from firebase_admin import credentials, firestore
        cred = credentials.Certificate(firebase_cred_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase Admin initialized via credentials.")
    else:
        db = MockFirebaseDB()
except Exception as e:
    print(f"Lỗi khởi tạo Firebase: {e}. Đang dùng Mock Database.")
    db = MockFirebaseDB()


def get_db():
    return db


def fetch_collection(name: str):
    db = get_db()
    if hasattr(db, "get_collection"):
        return db.get_collection(name)

    try:
        collection_ref = db.collection(name)
        documents = collection_ref.stream()
        return [doc.to_dict() for doc in documents]
    except Exception:
        return []
