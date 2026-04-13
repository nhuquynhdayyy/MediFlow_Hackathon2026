import os
import io
import time
import pygame
import speech_recognition as sr
from gtts import gTTS
from openai import OpenAI
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_react_agent
from langchain import hub
from langchain.memory import ConversationBufferMemory
from tools import dat_lich_kham, tra_cuu_quy_dinh

# ==========================================
# 1. CẤU HÌNH (TỰ CHỨA - KHÔNG IMPORT TỪ MAIN)
# ==========================================
FPT_API_KEY = "sk-ACklrsfrClwQqfKhYzSabpcP-FzWa8Jo-iJAKIjwm4s="
FPT_BASE_URL = "https://mkp-api.fptcloud.com"
FPT_AGENT_MODEL = "Llama-3.3-70B-Instruct"
FPT_STT_MODEL = "whisper-large-v3-turbo"

# Khởi tạo AI
stt_client = OpenAI(api_key=FPT_API_KEY, base_url=FPT_BASE_URL)
llm = ChatOpenAI(model=FPT_AGENT_MODEL, openai_api_key=FPT_API_KEY, openai_api_base=FPT_BASE_URL, temperature=0.1)
memory = ConversationBufferMemory(memory_key="chat_history")
tools = [dat_lich_kham, tra_cuu_quy_dinh]
prompt_template = hub.pull("hwchase17/react-chat")

# Copy instruction trực tiếp vào đây
instruction = """
Bạn là MediFlow Triage Agent - Trợ lý y tế thông minh tại bệnh viện MediFlow.
Ngôn ngữ giao tiếp: Tiếng Việt, lịch sự, thân thiện, ngắn gọn.
(Các quy trình đặt lịch và phân loại mức độ y hệt như bạn đã viết...).
Nếu sau khi dùng tool tra_cuu_quy_dinh mà không thấy thông tin của khoa đó, hãy báo cho bệnh nhân là thông tin đang cập nhật và hỏi họ có muốn tiếp tục đặt lịch dựa trên dự đoán không, tuyệt đối không gọi lại tool tra_cuu_quy_dinh quá 2 lần cho cùng một câu hỏi.
"""

agent = create_react_agent(llm, tools, prompt_template)
agent_executor = AgentExecutor(agent=agent, tools=tools, memory=memory, verbose=True, handle_parsing_errors=True, max_iterations=5)

# ==========================================
# 2. HÀM NÓI (PHẢI CHẠY TRƯỚC ĐỂ KIỂM TRA LOA)
# ==========================================
def noi(text):
    if not text: return
    print(f"\n🤖 MediFlow AI đang nói: {text}")
    try:
        tts = gTTS(text=text, lang='vi')
        filename = "temp_voice.mp3"
        tts.save(filename)
        
        pygame.mixer.init()
        pygame.mixer.music.load(filename)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            pygame.time.Clock().tick(10)
        pygame.mixer.music.unload()
        os.remove(filename)
    except Exception as e:
        print(f"Lỗi loa: {e}")

# ==========================================
# 3. HÀM NGHE (SỬ DỤNG MICROPHONE)
# ==========================================
def nghe():
    r = sr.Recognizer()
    # Tăng độ nhạy (Càng nhỏ càng nhạy, mặc định là 300)
    r.energy_threshold = 300 
    r.dynamic_energy_threshold = True 

    with sr.Microphone() as source:
        print("\n--- 🎤 MỜI BẠN NÓI (Hãy nói to, rõ ràng) ---")
        # Tăng thời gian chờ khử nhiễu lên 2 giây
        r.adjust_for_ambient_noise(source, duration=2) 
        
        try:
            # phrase_time_limit: giới hạn nói trong 10 giây
            audio = r.listen(source, timeout=5, phrase_time_limit=10)
            print("🔍 Đang gửi âm thanh lên FPT Whisper...")
            
            with open("temp_recording.wav", "wb") as f:
                f.write(audio.get_wav_data())
            
            with open("temp_recording.wav", "rb") as audio_file:
                transcript = stt_client.audio.transcriptions.create(
                    model=FPT_STT_MODEL, 
                    file=audio_file,
                    language='vi'
                )
            return transcript.text
        except Exception as e:
            print(f"Hệ thống không nghe thấy gì hoặc lỗi: {e}")
            return ""

# ==========================================
# 4. CHƯƠNG TRÌNH CHÍNH
# ==========================================
if __name__ == "__main__":
    # Test thử loa ngay khi bắt đầu
    noi("Chào Quỳnh, hệ thống giọng nói đã sẵn sàng. Bạn cần giúp gì ạ?")

    while True:
        # Thay vì dùng input(), ta dùng nghe()
        user_query = nghe()
        
        if not user_query:
            continue
            
        print(f"👤 Bạn đã nói: {user_query}")
        
        if any(word in user_query.lower() for word in ["thoát", "tạm biệt"]):
            noi("Tạm biệt bạn nhé.")
            break
            
        try:
            response = agent_executor.invoke({
                "input": f"{instruction}\n\nBệnh nhân nói: {user_query}",
                "chat_history": memory.load_memory_variables({})["chat_history"]
            })
            noi(response['output'])
        except Exception as e:
            print(f"Lỗi AI: {e}")