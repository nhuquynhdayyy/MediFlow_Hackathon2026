import os
from langchain_openai import ChatOpenAI 
from langchain.agents import AgentExecutor, create_react_agent
from langchain import hub
from langchain.memory import ConversationBufferMemory # Thêm bộ nhớ
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

# 3. THIẾT LẬP BỘ NHỚ (Memory) - Giúp AI nhớ lịch sử chat
memory = ConversationBufferMemory(memory_key="chat_history")

# 4. Công cụ và Prompt
tools = [dat_lich_kham]
# Lấy mẫu prompt hỗ trợ Chat History
prompt_template = hub.pull("hwchase17/react-chat") 

# 5. Lời dẫn nhập (RẤT QUAN TRỌNG)
instruction = """
Bạn là MediFlow Triage Agent - Trợ lý y tế thông minh tại bệnh viện.
Nhiệm vụ của bạn:
1. Chào đón bệnh nhân bằng tiếng Việt, lịch sự và thấu hiểu.
2. Lắng nghe triệu chứng bệnh nhân mô tả.
3. Phân loại (Triage):
- Nếu thấy dấu hiệu nguy kịch (khó thở, đau ngực dữ dội, mất ý thức), hãy yêu cầu bệnh nhân đến ngay phòng Cấp cứu.
- Nếu triệu chứng bình thường, hãy gợi ý chuyên khoa phù hợp (ví dụ: Đau mắt -> Khoa Mắt, Đau bụng -> Khoa Tiêu hóa).
4. Sau khi gợi ý khoa, hãy hỏi bệnh nhân có muốn đặt lịch khám không.
Quy tắc quan trọng:
- Tuyệt đối KHÔNG được kê đơn thuốc hoặc chẩn đoán tên bệnh khẳng định.
- Luôn nhắc nhở bệnh nhân thông tin này chỉ mang tính chất tham khảo.
- Chỉ tập trung vào việc hỗ trợ quy trình tại bệnh viện MediFlow.
"""

# 6. Khởi tạo Agent
agent = create_react_agent(llm, tools, prompt_template)

# 7. Bộ điều khiển Agent (Thêm Memory vào đây)
agent_executor = AgentExecutor(
    agent=agent, 
    tools=tools, 
    memory=memory, # Gắn bộ nhớ vào đây
    verbose=True, 
    handle_parsing_errors=True
)

print("\n--- MediFlow AI (Bản có bộ nhớ) đã sẵn sàng! ---")

while True:
    user_query = input("\n👤 Bệnh nhân: ")
    if user_query.lower() in ["thoát", "exit", "quit"]:
        break
        
    try:
        # Gọi AI với lịch sử chat
        response = agent_executor.invoke({
            "input": f"{instruction}\n\nBệnh nhân nói: {user_query}",
            "chat_history": memory.load_memory_variables({})["chat_history"]
        })
        print(f"\n🤖 MediFlow AI: {response['output']}")
    except Exception as e:
        print(f"\nLỗi: {e}")