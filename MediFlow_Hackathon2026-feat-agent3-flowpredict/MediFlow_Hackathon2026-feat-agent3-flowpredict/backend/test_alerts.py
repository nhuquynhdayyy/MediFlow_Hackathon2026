import json
import urllib.error
import urllib.request

URL = "http://127.0.0.1:8003/api/alerts/check"

payload = {
    "load_by_specialty": [
        {"specialty": "Nội tim mạch", "current_patients": 105, "capacity": 80, "load_pct": 131.2, "floor": 5},
        {"specialty": "Khám bệnh - Cấp cứu", "current_patients": 180, "capacity": 150, "load_pct": 120.0, "floor": 1},
        {"specialty": "Sản khoa", "current_patients": 115, "capacity": 120, "load_pct": 95.8, "floor": 5},
        {"specialty": "Nhi", "current_patients": 88, "capacity": 80, "load_pct": 110.0, "floor": 3},
        {"specialty": "Chẩn đoán hình ảnh", "current_patients": 140, "capacity": 150, "load_pct": 93.3, "floor": 1},
        {"specialty": "Ngoại khoa", "current_patients": 65, "capacity": 100, "load_pct": 65.0, "floor": 3},
        {"specialty": "Sinh hóa", "current_patients": 40, "capacity": 100, "load_pct": 40.0, "floor": 1},
        {"specialty": "Hồi sức tích cực", "current_patients": 20, "capacity": 60, "load_pct": 33.3, "floor": 1}
    ],
    "forecast": [
        {"hour": "08:00", "load_pct": 82.0, "expected_patients": 210, "alert_level": "warning"},
        {"hour": "09:00", "load_pct": 95.5, "expected_patients": 250, "alert_level": "critical"},
        {"hour": "10:00", "load_pct": 110.3, "expected_patients": 300, "alert_level": "critical"},
        {"hour": "11:00", "load_pct": 115.0, "expected_patients": 320, "alert_level": "critical"},
        {"hour": "12:00", "load_pct": 90.0, "expected_patients": 230, "alert_level": "critical"}
    ],
    "admin_note": "Cần điều chuyển bác sĩ Nội khoa xuống hỗ trợ Cấp cứu, và xem xét mở thêm máy Siêu âm."
}

req = urllib.request.Request(
    URL,
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
)

print("Đang gửi tập dữ liệu siêu quá tải (131% Tim Mạch, 120% Cấp Cứu) cho LLM phân tích...")

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        print("STATUS", resp.status)
        data = json.loads(resp.read().decode("utf-8"))
        print("\n--- AI OPERATIONS COPILOT RESPONSE ---")
        print(json.dumps(data, indent=2, ensure_ascii=False))
except urllib.error.HTTPError as e:
    print("HTTPError", e.code, e.reason)
    print(e.read().decode("utf-8", errors="ignore"))
except urllib.error.URLError as e:
    print("URLError", e.reason)
except Exception as exc:
    print("ERROR", type(exc).__name__, exc)
