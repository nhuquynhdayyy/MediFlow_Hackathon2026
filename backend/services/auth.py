# backend/services/auth.py
from datetime import datetime
from firebase_admin import auth
from database_firebase import db # Import biến db bạn đã tạo trước đó

class AuthService:
    def register_user(self, email, password, full_name, role="patient"):
        """Tạo tài khoản mới trên Firebase Auth và lưu vào Firestore"""
        try:
            # 1. Tạo trên Firebase Auth
            user_record = auth.create_user(email=email, password=password)
            
            # 2. Lưu thông tin bổ sung vào Firestore (Bảng USERS trong ERD)
            db.collection("users").document(user_record.uid).set({
                "email": email,
                "full_name": full_name,
                "role": role, # patient hoặc doctor
                "created_at": datetime.now()
            })
            return {"status": "success", "uid": user_record.uid}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def verify_token(self, id_token):
        """Kiểm tra token từ Frontend gửi lên có hợp lệ không"""
        try:
            decoded_token = auth.verify_id_token(id_token)
            return decoded_token # Trả về thông tin người dùng (uid, email...)
        except:
            return None