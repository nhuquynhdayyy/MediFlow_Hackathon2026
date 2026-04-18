# MediFlow AI — Hệ thống 2 Agent

**GDGoC Hackathon Vietnam 2026 · Đội: Đại đại đi**

---

## Cấu trúc dự án

```
mediflow-full/
├── backend/
│   ├── main.py                  # FastAPI — tất cả API endpoints
│   ├── services/
│   │   ├── fpt_ai.py            # FPT AI Marketplace client (gọi LLM)
│   │   ├── triage_agent.py      # Agent 1: Triage logic + prompt
│   │   └── emr.py               # EMR mock store
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── App.jsx               # Router + nav
    │   ├── pages/
    │   │   ├── TriagePage.jsx    # Agent 1: Chat giao diện
    │   │   └── DocAssistPage.jsx # Agent 2: Bác sĩ layout
    │   ├── components/
    │   │   ├── SettingsBar.jsx   # API key + model selector
    │   │   ├── PatientQueue.jsx  # Danh sách bệnh nhân
    │   │   ├── EMRForm.jsx       # Hồ sơ bệnh án điện tử
    │   │   ├── AIChatPanel.jsx   # AI chat streaming
    │   │   ├── VoiceRecorder.jsx # Voice-to-EMR
    │   │   ├── QRModal.jsx       # QR thanh toán
    │   │   └── HistoryModal.jsx  # Lịch sử khám
    │   ├── hooks/useVoice.js     # Web Speech API hook
    │   ├── services/api.js       # Axios + SSE streaming helpers
    │   └── store/index.js        # Zustand global state
    └── package.json
```

---

## Cài đặt và chạy

### 1. Backend

```bash
cd backend

# Tạo virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Cài thư viện
pip install -r requirements.txt

# Tạo file .env
cp .env.example .env
# Mở .env, điền FPT_API_KEY của bạn

# Chạy server
uvicorn main:app --reload --port 8000
```

✅ API docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

✅ App: http://localhost:5173

---

## Sử dụng

### Agent 1 — Triage (tab mặc định)
1. Nhấn **Cài đặt** (góc phải) → nhập FPT API Key → Test kết nối
2. Chat với AI: mô tả triệu chứng bằng text hoặc giọng nói (Mic)
3. AI phân loại 🔴🟡🟢 và gợi ý chuyên khoa / đặt lịch

### Agent 2 — DocAssist (tab DocAssist)
1. Chọn bệnh nhân từ cột trái
2. Xem/chỉnh sửa hồ sơ EMR ở cột giữa
3. Dùng **Voice-to-EMR**: ghi âm hội thoại → AI tự điền hồ sơ
4. Dùng AI quick actions: Chẩn đoán / Điều trị / Đơn thuốc / Xét nghiệm
5. Chat tự do với DocAssist AI
6. Tạo **QR thanh toán** → Xem **lịch sử khám**

---

## API Endpoints

| Method | Path | Chức năng |
|--------|------|-----------|
| GET  | /health | Health check |
| POST | /api/triage/chat | Agent 1 chat |
| POST | /api/triage/chat/stream | Agent 1 streaming |
| GET  | /api/emr/patients | Danh sách bệnh nhân |
| GET  | /api/emr/patient/{id} | Chi tiết bệnh nhân |
| POST | /api/emr/save | Lưu EMR |
| GET  | /api/emr/history/{id} | Lịch sử khám |
| POST | /api/ai/diagnosis | AI chẩn đoán |
| POST | /api/ai/treatment | AI phác đồ điều trị |
| POST | /api/ai/prescription | AI đơn thuốc |
| POST | /api/ai/lab-suggestions | AI xét nghiệm |
| POST | /api/ai/voice-to-emr | Voice transcript → EMR |
| POST | /api/ai/soap-summary | Tóm tắt SOAP |
| POST | /api/chat/stream | DocAssist streaming chat |
| POST | /api/payment/generate-qr | Tạo QR thanh toán |

---

## Mở rộng sau hackathon

- **Firebase**: Thay `services/emr.py` mock bằng Firestore SDK thật
- **Voice thật**: Tích hợp Whisper API hoặc Gemini Live
- **VietQR thật**: Gọi API VietQR thật thay mock URL
- **Agent 3**: Thêm FlowPredict dashboard với BigQuery analytics
- **Auth**: Thêm JWT authentication cho bác sĩ
