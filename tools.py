from langchain_core.tools import tool

@tool
def dat_lich_kham(thong_tin: str):
    """
    Sử dụng công cụ này khi bệnh nhân yêu cầu đặt lịch khám.
    Tham số truyền vào là một chuỗi văn bản chứa cả tên khoa và thời gian.
    Ví dụ: 'Khoa Tiêu hóa vào sáng mai'
    """
    xac_nhan = f"--- THÔNG BÁO HỆ THỐNG: Đã nhận yêu cầu đặt lịch cho: {thong_tin} ---"
    return xac_nhan

@tool
def tra_cuu_quy_dinh(cau_hoi: str):
    """Sử dụng công cụ này để tra cứu thông tin chính thức về quy định, 
    vị trí các khoa và hướng dẫn của bệnh viện MediFlow."""
    with open("huong_dan_benh_vien.txt", "r", encoding="utf-8") as f:
        content = f.read()
    return content