from app.services.fpt_ai import generate_text

def explain_route(route, data):
    prompt = f"""
Bạn là trợ lý bệnh viện.

Lộ trình đã được hệ thống tính toán:
{route}

Dữ liệu:
{data}

Hãy giải thích NGẮN GỌN:
- Vì sao đi theo thứ tự này
- Nhấn mạnh xét nghiệm trước khám nếu có
- Không thêm khoa mới
- Không thay đổi thứ tự

Trả lời tự nhiên như đang nói chuyện với bệnh nhân.
"""

    return generate_text(prompt)