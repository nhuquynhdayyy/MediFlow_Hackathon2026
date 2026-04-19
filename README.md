# MediFlow AI

**GDGoC Hackathon Vietnam 2026**

MediFlow AI là demo hệ thống bệnh viện theo hướng **Multi-Agent**, nơi các tác vụ của bệnh nhân, bác sĩ và điều phối vận hành được nối với nhau trên cùng một luồng dữ liệu.

Trong branch hiện tại, app active nằm ở **`frontend/`** và **`backend/`**. 

## 1. Tổng quan hệ thống

MediFlow AI được tổ chức quanh 3 agent:

- **Agent 1 - Triage & Navigation (patient):** tiếp nhận triệu chứng, phân loại mức độ, gợi ý chuyên khoa, hỗ trợ đặt lịch và trả lời thông tin khoa/phòng trong bệnh viện.
- **Agent 2 - DocAssist (doctor):** hỗ trợ bác sĩ đọc hàng đợi khám, điền EMR, gợi ý chẩn đoán, điều trị, đơn thuốc, xét nghiệm và tóm tắt SOAP.
- **Agent 3 - Navigation + Flow + Management layer:** chịu trách nhiệm phần patient flow, đồng bộ dữ liệu giữa các bước khám và ghi nhận dữ liệu vận hành qua Firestore.

## 2. Implemented

### Patient - Agent 1 + phần patient-flow của Agent 3

- Đăng ký/đăng nhập bằng **Firebase Auth**.
- Chat tư vấn triệu chứng với **streaming response** từ FPT AI.
- Hỗ trợ **voice input** bằng Web Speech API.
- Phân loại 3 mức độ:
  - `TRIAGE 3`: nguy kịch
  - `TRIAGE 2`: cần khám
  - `TRIAGE 1`: theo dõi tại nhà
- Gợi ý chuyên khoa phù hợp dựa trên triệu chứng.
- Trả lời câu hỏi điều hướng bệnh viện theo knowledge base đang hard-code trong `backend/services/triage_agent.py`:
  - vị trí khoa
  - tầng / khu
  - buổi làm việc
- Đặt lịch khám từ ngay trong hội thoại:
  - lưu vào Firestore collection `appointments`
  - lưu bệnh nhân vào `patients`
  - lưu phiên chat vào `chat_sessions`
- Hiển thị **QR check-in** sau khi đặt lịch thành công.
- Xem **hồ sơ bệnh án realtime** tại trang `MedicalRecordsPage`.
- Bệnh nhân có thể **bổ sung các trường còn trống** trong hồ sơ, nhưng không ghi đè dữ liệu bác sĩ đã nhập.

### Doctor - Agent 2

- Đăng nhập bằng tài khoản có `role: doctor` trong Firestore `users`.
- Xem **hàng đợi bệnh nhân** lấy trực tiếp từ collection `appointments`.
- Mở hồ sơ bệnh nhân với context đã ghép từ:
  - appointment
  - profile bệnh nhân
  - medical record gần nhất
- Khám và lưu hồ sơ vào collection `medical_records`.
- Khi lưu EMR:
  - tạo/cập nhật medical record
  - cập nhật appointment sang trạng thái `completed`
  - ghi workflow event
- AI hỗ trợ bác sĩ gồm:
  - gợi ý chẩn đoán
  - gợi ý điều trị
  - tạo đơn thuốc
  - gợi ý thuốc bổ sung
  - gợi ý xét nghiệm / chẩn đoán hình ảnh
  - tóm tắt SOAP
  - free-form clinical chat có streaming
- Voice-to-EMR:
  - thu transcript bằng Web Speech API
  - gửi transcript lên backend
  - backend gọi FPT AI để trích xuất dữ liệu EMR
- Quản lý đơn thuốc:
  - AI generate prescription
  - tra cứu thêm từ local drug database lớn ở frontend
- Quản lý xét nghiệm:
  - AI gợi ý theo triệu chứng/chẩn đoán
  - bác sĩ chọn tay thêm từ local lab database
- Xem lịch sử bệnh án cũ.
- In hồ sơ.
- Tạo QR thanh toán mock.
- Dữ liệu sau khi lưu được đồng bộ để bệnh nhân thấy lại trên trang hồ sơ bệnh án.

### Agent 3 - lớp điều phối và dữ liệu vận hành trong branch hiện tại

Các phần đang có thật trong code:

- Điều phối luồng:
  - `Agent 1 -> appointments/chat_sessions/patients`
  - `Agent 2 -> medical_records + update appointment status`
- Ghi audit trail vào collection `workflow_events`.
- Lưu toàn bộ output AI vào collection `ai_recommendations` để phục vụ theo dõi và analytics.
- Lưu `status_history` cho appointment để theo dõi tiến trình khám.
- Đồng bộ dữ liệu để:
  - bác sĩ nhận bệnh nhân từ hàng đợi
  - bệnh nhân thấy kết quả khám gần như realtime

## 3. Kiến trúc hệ thống

### FE - BE - Database

- **Frontend:** React + Vite, gồm patient flow và doctor workspace trong cùng một app.
- **Backend:** FastAPI, tách router chung và router riêng cho doctor dưới `/api/doctor`.
- **Database:** Firestore là database chính. 

### Luồng dữ liệu chính giữa 3 agent

```text
Agent 1 (Patient Triage)
  -> Firestore: patients, appointments, chat_sessions
  -> Agent 2 (Doctor Workspace)
  -> Firestore: medical_records, appointment status, workflow_events, ai_recommendations
  -> Agent 3 layer (patient-flow + operational data)
  -> Patient Medical Records page / doctor queue / audit trail
```

### Luồng thực tế đang chạy

```text
Patient UI
  -> /api/triage/chat/stream
  -> FPT AI
  -> lưu chat + booking vào Firestore

Doctor UI
  -> /api/doctor/appointments
  -> lấy queue từ Firestore appointments
  -> /api/doctor/emr/save
  -> lưu medical_records + update appointment status

Patient Medical Records UI
  -> nghe realtime collection medical_records
  -> fallback sang API /api/medical-records/patient/{uid} nếu cần
```

## 4. Công nghệ sử dụng

### Frontend

- React 18
- Vite 5
- Tailwind CSS 3
- React Router DOM
- Zustand
- Axios
- Firebase JS SDK
- `qrcode.react`
- `lucide-react`
- `react-hot-toast`

### Backend

- FastAPI
- Uvicorn
- Pydantic v2
- httpx
- python-dotenv
- Firebase Admin SDK

### Database

- **Firestore** là storage chính cho:
  - `users`
  - `patients`
  - `appointments`
  - `medical_records`
  - `chat_sessions`
  - `workflow_events`
  - `ai_recommendations`

### AI / Voice

- **FPT AI Marketplace** là LLM backend đang được dùng thật trong app.
- Model mặc định ở backend: `Llama-3.3-70B-Instruct`.
- Patient UI còn cho phép chọn một số model khác từ settings.
- Voice hiện tại dùng:
  - **Web Speech API** cho speech-to-text ở browser
  - **speechSynthesis** cho voice conversation mode ở Agent 1
- **Whisper** và **Gemini Live** chỉ xuất hiện trong comment như hướng nâng cấp, chưa phải luồng runtime hiện tại.

## 5. Cách chạy project

### Yêu cầu

- Node.js 18+
- Python 3.11+
- Tài khoản Firebase
- FPT AI API key

### Cấu hình backend

1. Tạo file `backend/.env` từ `backend/.env.example`
2. Điền `FPT_API_KEY`
3. Đảm bảo file `backend/serviceAccountKey.json` trỏ đúng Firebase service account

### Chạy backend

```bash
cd backend
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

macOS / Linux:

```bash
source .venv/bin/activate
```

Sau đó:

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend chạy tại: `http://localhost:8000`

### Chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại: `http://localhost:5173`

### Ghi chú khi demo

- Patient có thể tự đăng ký ngay trên UI.
- Doctor không có flow đăng ký riêng trên UI.
- Muốn vào doctor workspace, cần có:
  - Firebase Auth user hợp lệ
  - document `users/{uid}` trong Firestore với `role: "doctor"`

## 6. Cấu trúc thư mục

```text
mediflow-full/
├─ frontend/
│  ├─ src/App.jsx
│  ├─ src/pages/TriagePage.jsx              # Agent 1 - patient triage
│  ├─ src/pages/MedicalRecordsPage.jsx      # Patient medical records realtime
│  ├─ src/pages/DoctorWorkspace.jsx         # Agent 2 - doctor workspace
│  ├─ src/components/docassist/             # EMR, AI chat, prescription, lab, voice
│  ├─ src/components/AuthOverlay.jsx        # Firebase Auth overlay
│  ├─ src/hooks/                            # Voice hooks cho patient
│  ├─ src/doctor/                           # Doctor store + services
│  └─ src/services/                         # API client + Firebase client
├─ backend/
│  ├─ main.py                               # FastAPI app chính
│  ├─ database_firebase.py                  # Firestore persistence + workflow events
│  ├─ services/triage_agent.py              # Agent 1 logic
│  ├─ services/fpt_ai.py                    # Shared FPT AI client
│  ├─ services/agent2_endpoints.py          # Router riêng cho doctor
│  ├─ services/agent2_emr.py                # Queue + medical record sync
│  ├─ services/agent2_fpt.py                # FPT client cho Agent 2
│  ├─ services/emr.py                       # Firestore-first + mock fallback
│  └─ agent3/                               # Chỉ còn artifact biên dịch, chưa mount vào app chính
```

## 7. Luồng nghiệp vụ chính

### Luồng 1 - Patient triage và đặt lịch

1. Bệnh nhân đăng nhập hoặc đăng ký.
2. Bệnh nhân chat với Agent 1 bằng text hoặc voice.
3. Agent 1 phân loại mức độ và gợi ý chuyên khoa.
4. Nếu bệnh nhân xác nhận đặt lịch:
   - tạo record trong `appointments`
   - cập nhật `patients`
   - lưu `chat_sessions`
5. Frontend hiển thị QR check-in.

### Luồng 2 - Doctor khám và lưu bệnh án

1. Bác sĩ đăng nhập bằng tài khoản `role: doctor`.
2. Doctor workspace lấy queue từ `appointments`.
3. Bác sĩ chọn bệnh nhân và hoàn thiện EMR.
4. Có thể dùng AI/voice để:
   - điền lý do khám
   - tóm tắt triệu chứng
   - gợi ý chẩn đoán
   - gợi ý điều trị
   - tạo đơn thuốc
   - đề xuất xét nghiệm
5. Khi lưu:
   - tạo/cập nhật `medical_records`
   - ghi `workflow_events`
   - lưu `ai_recommendations`
   - update appointment sang `completed`

### Luồng 3 - Đồng bộ lại sang bệnh nhân

1. `MedicalRecordsPage` lắng nghe Firestore `medical_records`.
2. Khi bác sĩ lưu EMR, bệnh nhân thấy dữ liệu mới gần như realtime.
3. Bệnh nhân chỉ được bổ sung các field còn trống, không ghi đè phần bác sĩ đã nhập.

## 8. Điểm nổi bật của bản demo hiện tại

- Một app nhưng có **2 trải nghiệm riêng theo role**: patient và doctor.
- Dữ liệu không bị đứt đoạn giữa triage, appointment, khám và hồ sơ bệnh án.
- Agent 1 và Agent 2 đã nối thật với Firestore thay vì chỉ mock UI.
- Luồng handoff giữa các bước khám đã có audit trail và trạng thái vận hành.
- Phù hợp để demo hackathon vì thể hiện rõ:
  - AI cho bệnh nhân
  - AI cho bác sĩ
  - lớp orchestration dữ liệu cho hành trình khám

## 9. Tóm tắt ngắn

MediFlow AI trong branch hiện tại là một **hospital workflow demo theo hướng multi-agent**:

- **Agent 1** giải quyết đầu vào của bệnh nhân
- **Agent 2** hỗ trợ bác sĩ khám và ghi EMR
- **Agent 3** hiện diện ở lớp điều phối dữ liệu, workflow và đồng bộ patient flow
