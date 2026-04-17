from typing import List

ALIASES = {
    "siêu âm": "Chẩn đoán hình ảnh",
    "xét nghiệm": "Sinh hóa",
    "máu": "Sinh hóa",
    "tai mũi họng": "Tai mũi họng",
    "nhi": "Nhi",
    "khoa nhi": "Nhi",
    "tim mạch": "Tim mạch",
    "nội tim mạch": "Tim mạch",
    "thần kinh": "Thần kinh",
    "tiêu hóa": "Tiêu hóa",
    "nội tổng quát": "Nội tổng quát",
    "tổng quát": "Nội tổng quát",
    "tổng hợp": "Nội tổng quát",
    "mắt": "Mắt",
    "răng khôn": "Răng hàm mặt",
    "nhổ răng": "Răng hàm mặt",
    "răng hàm mặt": "Răng hàm mặt"
}

def normalize(text: str) -> str:
    return text.lower().strip()

def extract_departments(user_text: str) -> List[str]:
    user_text = normalize(user_text)
    found = []

    for key, val in ALIASES.items():
        if key in user_text:
            found.append(val)

    return list(set(found))