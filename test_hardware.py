import speech_recognition as sr
import pyttsx3 # Thư viện nói offline, nhanh và ổn định hơn gTTS để test

def test_speak():
    print("📢 Đang thử loa...")
    engine = pyttsx3.init()
    engine.say("Chào Quỳnh, tôi là máy tính của bạn. Tôi đang thử loa.")
    engine.runAndWait()

def test_listen():
    r = sr.Recognizer()
    with sr.Microphone() as source:
        print("🎤 Micro đang mở. Hãy nói gì đó trong 3 giây...")
        r.adjust_for_ambient_noise(source) # Khử nhiễu
        audio = r.listen(source)
    try:
        text = r.recognize_google(audio, language="vi-VN")
        print(f"✅ Tôi nghe thấy: {text}")
    except Exception as e:
        print(f"❌ Lỗi: {e}")

test_speak()
test_listen()