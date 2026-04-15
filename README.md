# Navigator AI – Smart Hospital Navigation & FlowPredict

`Navigator AI` là hệ thống điều hướng khám bệnh và điều hành bệnh viện theo thời gian thực cho Hackathon 2026.

Hệ thống có 2 luồng chính:

- **Luồng bệnh nhân**: tối ưu thứ tự đi khám theo tải bệnh viện, theo dõi checklist, cập nhật reroute khi hoàn thành từng bước.
- **Luồng bệnh viện**: giám sát tải khoa, dự báo tăng/giảm, phát hiện quá tải, hỗ trợ điều phối nhân sự bằng AI.

> Lưu ý: Logic tối ưu route/load là deterministic ở backend. FPT AI được dùng cho lớp giải thích và chat copilot.

---

## 1) Công nghệ sử dụng

### Backend
- Python + FastAPI
- Pydantic schema
- Service layer tách riêng (`api`, `services`, `models`)
- Tích hợp FPT AI (`Llama-3.3-70B-Instruct`)

### Frontend
- Next.js (App Router) + TypeScript
- Tailwind CSS
- UI dashboard + timeline + checklist + mini-map tầng + chat copilot

---

## 2) Cấu trúc thư mục hiện tại

```text
MediFlow_Hackathon2026/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── forecast.py
│   │   │   ├── hospital.py
│   │   │   ├── load.py
│   │   │   ├── optimizer.py
│   │   │   └── patient.py
│   │   ├── models/
│   │   │   ├── requests.py
│   │   │   └── responses.py
│   │   └── services/
│   │       ├── ai_explainer.py
│   │       ├── fpt_ai.py
│   │       ├── load_predictor.py
│   │       ├── mock_data_store.py
│   │       ├── overload_detector.py
│   │       └── route_optimizer.py
│   ├── scripts/
│   │   └── mock_data_generator.py
│   ├── main.py
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── services/
│   │       └── api.ts
│   ├── package.json
│   └── README.md
│
└── README.md
```

---

## 3) Luồng nghiệp vụ chính

## 3.1 Luồng bệnh nhân (Patient Flow)

1. Lấy order từ mock EMR (`/api/patient/{id}/orders`)
2. Tối ưu route (`/api/optimize-route`)
3. Bệnh nhân đồng ý lộ trình
4. Chuyển sang checklist thực hiện
5. Tick hoàn thành từng khoa (`/api/patient/{id}/progress`)
6. Backend tự reroute phần còn lại
7. Chat hỏi vị trí khoa/phòng/tầng (`/api/patient/{id}/chat`)

UI hỗ trợ:
- nhóm khoa theo chuyên khoa lớn
- timeline lộ trình
- mini-map bệnh viện theo tầng (stacked floors)
- progress % hoàn thành
- toast realtime khi reroute

## 3.2 Luồng bệnh viện (Hospital Flow)

1. Lấy tải realtime theo khoa (`/api/department-load`)
2. Dự báo tải 1–3 giờ (`/api/predict-load`)
3. Phân tích quá tải + gợi ý (`/api/overload-analysis`)
4. Operations Copilot cho điều dưỡng/y tá/bác sĩ (`/api/hospital/chat`)

UI hỗ trợ:
- KPI tải trung bình / khoa đỏ / giờ cao điểm
- top khoa tải cao
- forecast overload
- chat điều hành dùng FPT AI

---

## 4) Danh sách API chính

### Nhóm điều hướng bệnh nhân

- `POST /api/optimize-route`
  - Input: `patient_id`, `departments[]`, `constraints`, `patient_state`
  - Output: `optimal_route`, `alternative_route`, `estimated_time`, `time_saved`, `reasoning`

- `POST /api/suggest-time`
  - So sánh khung giờ đi khám trong lookahead

- `GET /api/patient/{patient_id}/orders`
  - Lấy order từ mock EMR

- `GET /api/patient/{patient_id}/state`
  - Lấy trạng thái checklist hiện tại

- `POST /api/patient/{patient_id}/progress`
  - Cập nhật bước đã hoàn thành + reroute

- `POST /api/patient/{patient_id}/chat`
  - Chat điều hướng cho bệnh nhân (FPT AI + context khoa/tầng + fallback)

### Nhóm tải và điều hành bệnh viện

- `GET /api/departments`
- `GET /api/department-load`
- `GET /api/predict-load`
- `GET /api/now-vs-later?departments=...&compare_after_hours=2`
- `GET /api/overload-analysis`
- `POST /api/hospital/chat`
  - Chat cho nhân viên vận hành (điều phối nhân sự theo tải/dự báo)

---

## 5) Cấu hình FPT AI

File: `backend/.env`

```env
FPT_API_KEY="YOUR_FPT_API_KEY"
FPT_AI_URL="https://mkp-api.fptcloud.com"
FPT_AI_MODEL="Llama-3.3-70B-Instruct"
```

Hệ thống sẽ ưu tiên gọi FPT AI cho:
- giải thích route
- chat bệnh nhân
- chat điều hành bệnh viện

Nếu lỗi mạng hoặc key, backend fallback để không làm hỏng luồng.

---

## 6) Hướng dẫn chạy dự án

## 6.1 Chạy backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8003
```

Kiểm tra:
- Health: [http://localhost:8003/health](http://localhost:8003/health)
- OpenAPI docs: [http://localhost:8003/docs](http://localhost:8003/docs)

## 6.2 Chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Mở: [http://localhost:3000](http://localhost:3000)

## 6.3 (Tuỳ chọn) Generate mock data file

```bash
cd backend
python scripts/mock_data_generator.py
```

---

## 7) Kịch bản demo gợi ý (Hackathon)

1. Chọn `Patient ID = P001`
2. Tab `Điều hướng bệnh nhân`:
   - Chọn khoa / tối ưu route
   - Đồng ý flow
   - Tick checklist từng phòng
   - Hỏi chat: “Đi từ khoa Nhi sang Sản phụ khoa như nào?”
3. Tab `Đi ngay vs đi sau`:
   - So sánh route và thời gian
4. Tab `Điều hành bệnh viện`:
   - Xem top khoa tải cao và forecast
   - Hỏi copilot: “2 giờ tới khoa nào cần tăng điều dưỡng?”

---

## 8) Ghi chú vận hành

- Nếu frontend không load dữ liệu, kiểm tra backend có chạy ở `:8003` không.
- Nếu chat AI trả lời fallback, kiểm tra lại key/url/model trong `.env`.
- Terminal Windows có thể lỗi in Unicode tiếng Việt khi `print` trực tiếp; API vẫn có thể chạy đúng.

---

## 9) Mục tiêu mở rộng tiếp theo

- Thêm quick-actions điều phối nhân sự (1-click)
- Thêm mô phỏng before/after khi điều phối nhân lực
- Kết nối EMR thật thay cho mock data
- Thêm phân quyền theo vai trò (bác sĩ/điều dưỡng/admin)

---

Được xây dựng cho Hackathon 2026 với định hướng production-ready: rõ luồng, deterministic core, AI copilot thực dụng, UI demo trực quan.
