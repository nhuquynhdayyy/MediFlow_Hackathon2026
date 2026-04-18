from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DepartmentSeed:
    name: str
    doctors: int
    avg_service_minutes: int
    base_waiting: int
    floor: int


DEPARTMENT_META = {
    "Registration": {
        "vi": "Tiếp nhận",
        "group": "Hành chính",
        "room_code": "P101",
        "side": "Cánh trái",
        "note": "Ngay sảnh vào",
        "block": "A1 (Hành chính)",
        "floor": 1,
        "map_x": 15,
        "map_y": 18,
    },
    "Lab": {
        "vi": "Xét nghiệm",
        "group": "Cận lâm sàng",
        "room_code": "P201",
        "side": "Cánh phải",
        "note": "Sau quầy thuốc",
        "block": "B1 (Cận lâm sàng)",
        "floor": 2,
        "map_x": 78,
        "map_y": 70,
    },
    "Imaging": {
        "vi": "Chẩn đoán hình ảnh",
        "group": "Cận lâm sàng",
        "room_code": "P202",
        "side": "Cánh phải",
        "note": "Đối diện khu xét nghiệm",
        "block": "B1 (Cận lâm sàng)",
        "floor": 2,
        "map_x": 68,
        "map_y": 32,
    },
    "Pharmacy": {
        "vi": "Quầy thuốc",
        "group": "Cận lâm sàng",
        "room_code": "P203",
        "side": "Cánh phải",
        "note": "Gần lối ra",
        "block": "B1 (Cận lâm sàng)",
        "floor": 1,
        "map_x": 58,
        "map_y": 72,
    },
    "Internal": {
        "vi": "Nội tổng quát",
        "group": "Nội khoa",
        "room_code": "P301",
        "side": "Trung tam",
        "note": "Cuối hành lang chính",
        "block": "A1 (Nội khoa)",
        "floor": 3,
        "map_x": 44,
        "map_y": 52,
    },
    "Cardiology": {
        "vi": "Tim mạch",
        "group": "Nội khoa",
        "room_code": "P302",
        "side": "Cánh phải",
        "note": "Sau khu nội tổng quát",
        "block": "A1 (Nội khoa)",
        "floor": 3,
        "map_x": 63,
        "map_y": 50,
    },
    "Neurology": {
        "vi": "Thần kinh",
        "group": "Nội khoa",
        "room_code": "P303",
        "side": "Cánh trái",
        "note": "Bên trái nội tổng quát",
        "block": "A1 (Nội khoa)",
        "floor": 4,
        "map_x": 28,
        "map_y": 52,
    },
    "Gastroenterology": {
        "vi": "Tiêu hóa",
        "group": "Nội khoa",
        "room_code": "P304",
        "side": "Cánh trái",
        "note": "Cuối hành lang trái",
        "block": "A1 (Nội khoa)",
        "floor": 2,
        "map_x": 20,
        "map_y": 68,
    },
    "Pulmonology": {
        "vi": "Hô hấp",
        "group": "Nội khoa",
        "room_code": "P305",
        "side": "Trung tâm",
        "note": "Cạnh thang máy",
        "block": "A1 (Nội khoa)",
        "floor": 3,
        "map_x": 46,
        "map_y": 32,
    },
    "Endocrinology": {
        "vi": "Nội tiết",
        "group": "Nội khoa",
        "room_code": "P306",
        "side": "Trung tâm",
        "note": "Gần phòng nội tổng quát",
        "block": "A1 (Nội khoa)",
        "floor": 3,
        "map_x": 50,
        "map_y": 44,
    },
    "Nephrology": {
        "vi": "Than",
        "group": "Nội khoa",
        "room_code": "P307",
        "side": "Cánh phải",
        "note": "Bên cạnh tim mạch",
        "block": "A1 (Nội khoa)",
        "floor": 3,
        "map_x": 72,
        "map_y": 50,
    },
    "Oncology": {
        "vi": "Ung bướu",
        "group": "Nội khoa",
        "room_code": "P308",
        "side": "Cánh phải",
        "note": "Cuối hành lang phải",
        "block": "A1 (Nội khoa)",
        "floor": 5,
        "map_x": 84,
        "map_y": 50,
    },
    "Orthopedics": {
        "vi": "Chấn thương chỉnh hình",
        "group": "Ngoại khoa",
        "room_code": "P401",
        "side": "Cánh trái",
        "note": "Gần khu cấp cứu",
        "block": "C1 (Ngoại khoa)",
        "floor": 4,
        "map_x": 14,
        "map_y": 78,
    },
    "Rehabilitation": {
        "vi": "Phục hồi chức năng",
        "group": "Ngoại khoa",
        "room_code": "P402",
        "side": "Cánh trái",
        "note": "Sau phòng chấn thương",
        "block": "C1 (Ngoại khoa)",
        "floor": 4,
        "map_x": 24,
        "map_y": 84,
    },
    "ENT": {
        "vi": "Tai Mũi Họng",
        "group": "TMH",
        "room_code": "P501",
        "side": "Cánh phải",
        "note": "Đầu hành lang phải",
        "block": "A1 (Chuyên khoa)",
        "floor": 5,
        "map_x": 76,
        "map_y": 40,
    },
    "Pediatrics": {
        "vi": "Nhi",
        "group": "Sản - Nhi",
        "room_code": "P601",
        "side": "Cánh trái",
        "note": "Gần khu vui chơi trẻ em",
        "block": "C1 (Sản Nhi)",
        "floor": 6,
        "map_x": 18,
        "map_y": 40,
    },
    "OBGYN": {
        "vi": "Sản phụ khoa",
        "group": "Sản - Nhi",
        "room_code": "P602",
        "side": "Cánh trái",
        "note": "Tầng trên khu nhi",
        "block": "C1 (Sản Nhi)",
        "floor": 6,
        "map_x": 22,
        "map_y": 30,
    },
    "Dermatology": {
        "vi": "Da liễu",
        "group": "Khác",
        "room_code": "P701",
        "side": "Trung tâm",
        "note": "Gần quầy hướng dẫn",
        "block": "A1 (Chuyên khoa)",
        "floor": 2,
        "map_x": 40,
        "map_y": 26,
    },
}


TEST_DB = {
    "Công thức máu toàn phần(CBC)": {
        "category": "Xet nghiem",
        "floor": 2,
        "block": "B1 (Can lam sang)",
        "room_code": "LAB-201",
    },
    "AST (SGOT)": {
        "category": "Xet nghiem",
        "floor": 2,
        "block": "B1 (Can lam sang)",
        "room_code": "LAB-202",
    },
    "Đường huyết lúc đói (FBS)": {
        "category": "Xet nghiem",
        "floor": 2,
        "block": "B1 (Can lam sang)",
        "room_code": "LAB-203",
    },
    "HbA1c": {
        "category": "Xet nghiem",
        "floor": 2,
        "block": "B1 (Can lam sang)",
        "room_code": "LAB-204",
    },
    "Sinh hóa": {
        "category": "Xet nghiem",
        "floor": 2,
        "block": "B1 (Can lam sang)",
        "room_code": "LAB-205",
    },
    "Tổng phân tích nước tiểu (UA)": {
        "category": "Xet nghiem",
        "floor": 2,
        "block": "B1 (Can lam sang)",
        "room_code": "LAB-206",
    },
    "Xét nghiệm phân (tim mau an)": {
        "category": "Xet nghiem",
        "floor": 2,
        "block": "B1 (Can lam sang)",
        "room_code": "LAB-207",
    },
    "Điện tâm đồ (ECG)": {
        "category": "Chan doan hinh anh",
        "floor": 2,
        "block": "B1 (Can lam sang)",
        "room_code": "IMG-201",
    },
    "Siêu âm tim": {
        "category": "Chan doan hinh anh",
        "floor": 2,
        "block": "B1 (Can lam sang)",
        "room_code": "IMG-202",
    },
    "Siêu âm thai": {
        "category": "Chan doan hinh anh",
        "floor": 6,
        "block": "C1 (San Nhi)",
        "room_code": "IMG-601",
    },
    "Siêu âm phụ khoa": {
        "category": "Chan doan hinh anh",
        "floor": 6,
        "block": "C1 (San Nhi)",
        "room_code": "IMG-602",
    },
    "MRI não": {
        "category": "Chan doan hinh anh",
        "floor": 4,
        "block": "B1 (Can lam sang)",
        "room_code": "IMG-401",
    },
    "CT so nao khong can quang": {
        "category": "Chan doan hinh anh",
        "floor": 4,
        "block": "B1 (Can lam sang)",
        "room_code": "IMG-402",
    },
    "X-quang ngực thẳng": {
        "category": "Chan doan hinh anh",
        "floor": 4,
        "block": "C1 (Ngoai khoa)",
        "room_code": "IMG-403",
    },
    "Nội soi dạ dày ": {
        "category": "Chan doan hinh anh",
        "floor": 2,
        "block": "B1 (Can lam sang)",
        "room_code": "IMG-204",
    },
    "D-Dinner": {
        "category": "Xet nghiem",
        "floor": 6,
        "block": "C1 (San Nhi)",
        "room_code": "LAB-601",
    },
}


DEPARTMENT_SEEDS = [
    DepartmentSeed("Registration", 6, 5, 14, 1),
    DepartmentSeed("Internal", 8, 16, 24, 3),
    DepartmentSeed("ENT", 4, 15, 14, 5),
    DepartmentSeed("Cardiology", 6, 20, 22, 3),
    DepartmentSeed("Neurology", 5, 22, 18, 4),
    DepartmentSeed("Orthopedics", 6, 17, 16, 4),
    DepartmentSeed("Gastroenterology", 4, 19, 15, 2),
    DepartmentSeed("Pulmonology", 4, 16, 14, 3),
    DepartmentSeed("Endocrinology", 3, 17, 12, 3),
    DepartmentSeed("Nephrology", 3, 18, 11, 3),
    DepartmentSeed("Oncology", 4, 24, 16, 5),
    DepartmentSeed("Pediatrics", 6, 14, 20, 6),
    DepartmentSeed("OBGYN", 5, 18, 15, 6),
    DepartmentSeed("Dermatology", 3, 11, 12, 2),
    DepartmentSeed("Rehabilitation", 4, 20, 10, 4),
    DepartmentSeed("Pharmacy", 8, 7, 28, 1),
]


DEPARTMENT_ALIASES = {
    "khoa tim mach": "Cardiology",
    "tim mach": "Cardiology",
    "cardio": "Cardiology",
    "khoa than kinh": "Neurology",
    "than kinh": "Neurology",
    "khoa tieu hoa": "Gastroenterology",
    "tieu hoa": "Gastroenterology",
    "khoa noi tong quat": "Internal",
    "noi tong quat": "Internal",
    "noi": "Internal",
    "khoa tai mui hong": "ENT",
    "tai mui hong": "ENT",
    "tmh": "ENT",
    "khoa da lieu": "Dermatology",
    "da lieu": "Dermatology",
    "khoa nhi": "Pediatrics",
    "nhi": "Pediatrics",
    "khoa san phu khoa": "OBGYN",
    "san phu khoa": "OBGYN",
    "san": "OBGYN",
    "obgyn": "OBGYN",
    "chan thuong chinh hinh": "Orthopedics",
    "phuc hoi chuc nang": "Rehabilitation",
    "ho hap": "Pulmonology",
    "noi tiet": "Endocrinology",
    "than": "Nephrology",
    "ung buou": "Oncology",
    "xet nghiem": "Lab",
    "chan doan hinh anh": "Imaging",
    "quay thuoc": "Pharmacy",
    "tiep nhan": "Registration",
}


ORDER_TO_DEPARTMENT = {
    "Internal": "Internal",
    "ENT": "ENT",
    "Cardio": "Cardiology",
    "Cardiology": "Cardiology",
    "Neurology": "Neurology",
    "Neuro": "Neurology",
    "Ortho": "Orthopedics",
    "Orthopedics": "Orthopedics",
    "Pediatrics": "Pediatrics",
    "OBGYN": "OBGYN",
    "Lab": "Lab",
    "Imaging": "Imaging",
    "Pharmacy": "Pharmacy",
}

for test_name, info in TEST_DB.items():
    ORDER_TO_DEPARTMENT[test_name] = "Imaging" if info["category"] == "Chan doan hinh anh" else "Lab"


MEDICAL_PREREQUISITES = {
    "Internal": ["Cong thuc mau toan phan (CBC)", "AST (SGOT)"],
    "Cardiology": ["Duong huyet luc doi (FBS)", "Dien tam do (ECG)"],
    "Neurology": ["MRI nao"],
    "Orthopedics": ["X-quang ngực thẳng"],
    "ENT": ["Cong thuc mau toan phan (CBC)"],
    "Oncology": ["Sinh hoa", "Chan doan hinh anh"],
    "OBGYN": ["Beta-hCG dinh luong", "Siêu âm tim"],
}


TRAVEL_MINUTES = {
    ("Registration", "Lab"): 4,
    ("Lab", "Imaging"): 6,
    ("Imaging", "Internal"): 5,
    ("Internal", "Pharmacy"): 4,
    ("Cardiology", "Imaging"): 4,
    ("Neurology", "Imaging"): 4,
    ("Orthopedics", "Imaging"): 3,
    ("Pediatrics", "Lab"): 5,
    ("OBGYN", "Lab"): 4,
}


HOURLY_PATTERN = {
    7: 0.9,
    8: 1.3,
    9: 1.55,
    10: 1.6,
    11: 1.38,
    12: 1.08,
    13: 1.0,
    14: 1.22,
    15: 1.16,
    16: 1.02,
    17: 0.86,
}


SAMPLE_PATIENT_ORDERS = {
    "P001": {
        "patient_id": "P001",
        "orders": [
            "Cong thuc mau toan phan (CBC)",
            "AST (SGOT)",
            "Dien tam do (ECG)",
            "Internal",
        ],
    },
    "P002": {
        "patient_id": "P002",
        "orders": [
            "Xet nghiem phan (tim mau an)",
            "Noi soi da day (Gastroscopy)",
            "Gastroenterology",
        ],
    },
    "P003": {
        "patient_id": "P003",
        "orders": [
            "Duong huyet luc doi (FBS)",
            "HbA1c",
            "Cardiology",
        ],
    },
}


DEFAULT_STAFF = [
    {
        "id": "staff-doc-001",
        "name": "BS Nguyen Minh Tuan",
        "role": "doctor",
        "department": "Cardiology",
        "shift": "07:00-15:00",
        "status": "active",
    },
    {
        "id": "staff-doc-002",
        "name": "BS Tran Thi Mai",
        "role": "doctor",
        "department": "Internal",
        "shift": "07:00-15:00",
        "status": "active",
    },
    {
        "id": "staff-doc-003",
        "name": "BS Le Thu Ha",
        "role": "doctor",
        "department": "OBGYN",
        "shift": "07:00-15:00",
        "status": "active",
    },
    {
        "id": "staff-nurse-001",
        "name": "DD Pham Thanh Lan",
        "role": "nurse",
        "department": "Lab",
        "shift": "07:00-15:00",
        "status": "active",
    },
    {
        "id": "staff-nurse-002",
        "name": "DD Vo Hoang Yen",
        "role": "nurse",
        "department": "Internal",
        "shift": "07:00-15:00",
        "status": "active",
    },
]


DEFAULT_HOSPITAL_MAP = [
    {
        "id": f"map-{department.lower()}",
        "department": department,
        "room_name": meta["vi"],
        "room_code": meta["room_code"],
        "block": meta["block"],
        "floor": meta["floor"],
        "capacity": 20,
        "room_type": "clinic",
        "status": "active",
        "source": "agent3_seed",
    }
    for department, meta in DEPARTMENT_META.items()
]

DEFAULT_HOSPITAL_MAP.extend(
    [
        {
            "id": f"map-test-{index + 1:03d}",
            "department": test_name,
            "room_name": test_name,
            "room_code": info["room_code"],
            "block": info["block"],
            "floor": info["floor"],
            "capacity": 12,
            "room_type": "service",
            "status": "active",
            "source": "agent3_seed",
        }
        for index, (test_name, info) in enumerate(TEST_DB.items())
    ]
)
