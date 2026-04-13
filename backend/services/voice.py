"""
Voice Service
Production: tích hợp Whisper API hoặc Gemini Live API
MVP: nhận transcript text từ frontend (Web Speech API)
"""


class VoiceService:
    """
    MVP: Frontend dùng Web Speech API ghi âm + gửi transcript text lên.
    Backend nhận text, gọi FPT AI để trích xuất EMR.
    
    Production upgrade:
    - Nhận audio blob (WAV/WebM)
    - Gọi Whisper API: POST https://api.openai.com/v1/audio/transcriptions
    - Hoặc Gemini Live API để realtime speech-to-text
    - Trả transcript về frontend
    """
    pass
