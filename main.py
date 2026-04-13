import os
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_react_agent
from langchain import hub
from langchain.memory import ConversationBufferMemory
from tools import dat_lich_kham, tra_cuu_quy_dinh

# 1. Cấu hình FPT AI
FPT_API_KEY = "sk-ACklrsfrClwQqfKhYzSabpcP-FzWa8Jo-iJAKIjwm4s="
FPT_BASE_URL = "https://mkp-api.fptcloud.com"
FPT_MODEL = "Llama-3.3-70B-Instruct"

# 2. Thiết lập bộ não
llm = ChatOpenAI(
    model=FPT_MODEL,
    openai_api_key=FPT_API_KEY,
    openai_api_base=FPT_BASE_URL,
    temperature=0.1
)

# 3. Bộ nhớ hội thoại
memory = ConversationBufferMemory(memory_key="chat_history")

# 4. Công cụ
tools = [dat_lich_kham, tra_cuu_quy_dinh]
prompt_template = hub.pull("hwchase17/react-chat")

# 5. System prompt được cải tiến
instruction = """
Bạn là MediFlow Triage Agent - Trợ lý y tế thông minh tại bệnh viện MediFlow.
Ngôn ngữ giao tiếp: Tiếng Việt, lịch sự, thân thiện, ngắn gọn - KHÔNG lặp lại lời giới thiệu mỗi tin nhắn.

=== NHIỆM VỤ CHÍNH ===
1. Lắng nghe triệu chứng → Phân loại mức độ → Gợi ý chuyên khoa phù hợp.
2. Nếu bệnh nhân hỏi vị trí/lịch làm việc của khoa → LUÔN dùng tool tra_cuu_quy_dinh trước, KHÔNG tự đoán.
3. Hỗ trợ đặt lịch khám khi bệnh nhân yêu cầu.

=== QUY TRÌNH ĐẶT LỊCH (BẮT BUỘC THEO ĐÚNG THỨ TỰ) ===
Bước 1 - Xác nhận khoa: Hỏi bệnh nhân muốn đặt khoa nào (nếu chưa rõ).
Bước 2 - Kiểm tra lịch làm việc: Dùng tool tra_cuu_quy_dinh để kiểm tra giờ làm việc của khoa đó.
Bước 3 - Hỏi thời gian: Hỏi bệnh nhân muốn đặt lịch vào thời gian nào.
         → Nếu thời gian KHÔNG khớp với lịch làm việc (ví dụ: khoa chỉ làm buổi sáng mà bệnh nhân
           muốn đặt buổi tối/chiều), hãy thông báo ngay và đề nghị chọn lại thời gian phù hợp.
         → KHÔNG được gọi tool dat_lich_kham với thời gian không hợp lệ.
Bước 4 - Hỏi số điện thoại: "Vui lòng cho tôi biết số điện thoại của bạn để xác nhận lịch."
Bước 5 - Đặt lịch: Chỉ sau khi có ĐỦ khoa + thời gian hợp lệ + số điện thoại, gọi tool dat_lich_kham
         với định dạng: '<Tên khoa> | <Thời gian> | <Số điện thoại>'

=== PHÂN LOẠI TRIỆU CHỨNG ===
- Dấu hiệu NGUY KỊCH (đau ngực dữ dội, khó thở, mất ý thức): Yêu cầu đến Cấp cứu NGAY.
- Triệu chứng thông thường: Gợi ý chuyên khoa phù hợp.
  Ví dụ: đau bụng → Khoa Tiêu hóa | đau đầu/chóng mặt → Khoa Thần kinh | vấn đề tim → Khoa Tim mạch

=== QUY TẮC CỐT LÕI ===
- TUYỆT ĐỐI không kê đơn thuốc hoặc chẩn đoán tên bệnh.
- KHÔNG tự bịa thông tin về lịch làm việc hay vị trí khoa - luôn tra cứu bằng tool.
- Khi tool dat_lich_kham trả về lỗi, đọc kỹ thông báo lỗi và thông báo lại cho bệnh nhân bằng lời thân thiện.
- Chỉ gọi tool dat_lich_kham đúng 1 lần sau khi đã có đủ thông tin hợp lệ.
- Không nhắc lại câu "thông tin chỉ mang tính tham khảo" quá 1 lần mỗi cuộc hội thoại.
"""

# 6. Khởi tạo Agent
agent = create_react_agent(llm, tools, prompt_template)

agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    memory=memory,
    verbose=True,
    handle_parsing_errors=True
)

print("\n--- MediFlow AI đã sẵn sàng! Gõ 'thoát' để kết thúc. ---\n")

while True:
    user_query = input("👤 Bệnh nhân: ")
    if user_query.lower() in ["thoát", "exit", "quit"]:
        print("Cảm ơn bạn đã sử dụng MediFlow AI. Chúc bạn sức khỏe!")
        break

    try:
        response = agent_executor.invoke({
            "input": f"{instruction}\n\nBệnh nhân nói: {user_query}",
            "chat_history": memory.load_memory_variables({})["chat_history"]
        })
        print(f"\n🤖 MediFlow AI: {response['output']}\n")
    except Exception as e:
        print(f"\nLỗi hệ thống: {e}\n")