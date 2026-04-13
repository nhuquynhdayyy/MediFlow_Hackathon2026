from langchain_core.tools import tool

# Dữ liệu lịch làm việc các khoa
LICH_LAM_VIEC = {
    "khoa tim mạch": ["sáng"],
    "khoa tiêu hóa": ["sáng", "chiều"],
    "khoa thần kinh": ["sáng", "chiều"],
    "khoa nhi": ["sáng", "chiều"],
    "khoa nội tổng quát": ["sáng", "chiều"],
    "khoa mắt": ["sáng", "chiều"],
    "khoa tai mũi họng": ["sáng", "chiều"],
    "khoa da liễu": ["sáng", "chiều"],
}

# Map từ khóa buổi sang nhóm buổi
BUOI_MAP = {
    "sáng": "sáng",
    "chiều": "chiều",
    "tối": "tối",
    "đêm": "tối",
}

def detect_buoi(thoi_gian: str) -> str:
    """Phát hiện buổi từ chuỗi thời gian."""
    thoi_gian_lower = thoi_gian.lower()
    for keyword, buoi in BUOI_MAP.items():
        if keyword in thoi_gian_lower:
            return buoi
    return "không xác định"

def find_khoa(thong_tin: str) -> str:
    """Tìm tên khoa trong chuỗi thông tin."""
    thong_tin_lower = thong_tin.lower()
    for khoa in LICH_LAM_VIEC:
        if khoa in thong_tin_lower:
            return khoa
    # fallback: tìm từ khóa ngắn hơn
    if "tim mạch" in thong_tin_lower:
        return "khoa tim mạch"
    if "tiêu hóa" in thong_tin_lower:
        return "khoa tiêu hóa"
    if "thần kinh" in thong_tin_lower:
        return "khoa thần kinh"
    if "nhi" in thong_tin_lower:
        return "khoa nhi"
    return None


@tool
def dat_lich_kham(thong_tin: str) -> str:
    """
    Sử dụng công cụ này để đặt lịch khám cho bệnh nhân.
    Tham số truyền vào PHẢI là chuỗi có đầy đủ 3 thông tin theo định dạng:
    '<Tên khoa> | <Thời gian> | <Số điện thoại>'
    Ví dụ: 'Khoa Tim mạch | sáng mai | 0901234567'
    
    Nếu thiếu bất kỳ thông tin nào, hãy hỏi bệnh nhân trước khi gọi tool này.
    Tool sẽ tự động kiểm tra lịch làm việc của khoa và từ chối nếu thời gian không phù hợp.
    """
    # --- Parse input ---
    parts = [p.strip() for p in thong_tin.split("|")]
    if len(parts) < 3:
        return (
            "LỖI: Thiếu thông tin. Cần đủ 3 phần: tên khoa | thời gian | số điện thoại. "
            "Hãy hỏi bệnh nhân cung cấp đầy đủ trước khi đặt lịch."
        )

    ten_khoa_raw, thoi_gian, so_dien_thoai = parts[0], parts[1], parts[2]

    # --- Validate số điện thoại ---
    sdt_clean = so_dien_thoai.replace(" ", "").replace("-", "")
    if not sdt_clean.isdigit() or len(sdt_clean) < 9:
        return (
            f"LỖI: Số điện thoại '{so_dien_thoai}' không hợp lệ. "
            "Vui lòng hỏi lại số điện thoại của bệnh nhân."
        )

    # --- Validate lịch làm việc ---
    khoa_key = find_khoa(ten_khoa_raw)
    if khoa_key and khoa_key in LICH_LAM_VIEC:
        buoi_dat = detect_buoi(thoi_gian)
        buoi_hop_le = LICH_LAM_VIEC[khoa_key]

        if buoi_dat not in buoi_hop_le:
            buoi_ho_tro = " và ".join(buoi_hop_le)
            return (
                f"LỖI LỊCH: {ten_khoa_raw.title()} chỉ làm việc buổi {buoi_ho_tro}. "
                f"Bệnh nhân yêu cầu đặt lịch vào buổi {buoi_dat} là không thể. "
                f"Hãy thông báo cho bệnh nhân và hỏi lại thời gian phù hợp (buổi {buoi_ho_tro})."
            )

    # --- Thành công ---
    xac_nhan = (
        f"✅ ĐẶT LỊCH THÀNH CÔNG\n"
        f"   Khoa      : {ten_khoa_raw.title()}\n"
        f"   Thời gian : {thoi_gian.capitalize()}\n"
        f"   SĐT       : {sdt_clean}\n"
        f"Bệnh viện sẽ liên hệ xác nhận qua số điện thoại trên."
    )
    return xac_nhan


@tool
def tra_cuu_quy_dinh(cau_hoi: str) -> str:
    """
    Sử dụng công cụ này để tra cứu thông tin chính thức về:
    - Vị trí, tầng, khu vực của các khoa phòng
    - Lịch làm việc / giờ mở cửa của từng khoa
    - Quy trình đặt lịch, check-in, thanh toán
    - Các hướng dẫn nội viện của bệnh viện MediFlow
    
    Hãy gọi tool này TRƯỚC KHI trả lời bất kỳ câu hỏi nào liên quan đến vị trí
    hoặc lịch làm việc của khoa, thay vì tự đoán.
    """
    try:
        with open("huong_dan_benh_vien.txt", "r", encoding="utf-8") as f:
            content = f.read()
        return content
    except FileNotFoundError:
        return (
            "Không tìm thấy file hướng dẫn. "
            "Vui lòng đảm bảo file 'huong_dan_benh_vien.txt' tồn tại trong thư mục dự án."
        )