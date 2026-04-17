# Navigator AI - Smart Hospital Navigation & FlowPredict System

Production-ready hackathon demo for:

- `Navigator AI`: optimize patient visit routes with real permutation search and load-aware costing
- `FlowPredict`: simulate patient load from `8:00` to `17:00`
- `Hospital Operations AI`: detect overload and generate actions for hospital staff

## Stack

- Backend: `FastAPI`
- Frontend: `React + Vite + Tailwind CSS`
- AI layer: optional `FPT AI` explainer with deterministic fallback

## Project Structure

```text
backend/
  app/
    api/
      routes.py
    models/
      schemas.py
    services/
      ai_explainer.py
      hospital_data.py
      load_predictor.py
      overload_detector.py
      response.py
      route_optimizer.py
  main.py

frontend/
  src/
    components/
    pages/
    services/
      api.ts
    App.tsx
    main.tsx
```

## API

- `POST /api/optimize-route`
- `GET /api/departments`
- `GET /api/predict-load`
- `GET /api/now-vs-later`
- `GET /api/overload-analysis`

## Run Backend

```bash
cd backend
python -m pip install -r requirements.txt
python main.py
```

Backend runs at `http://localhost:8003`.

Optional `.env` for FPT explainer:

```env
FPT_API_KEY=your_key
FPT_AI_URL=your_endpoint
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

Optional frontend env:

```env
VITE_API_URL=http://localhost:8003/api
```

## Demo Scenario

- `9:00`: `Internal Medicine` load is `90%`
- `11:00`: `Internal Medicine` load is `60%`
- Open the `Now vs Later` tab to show route difference and minutes saved

## Verified

- Backend smoke-tested with FastAPI `TestClient`
- Frontend production build verified with `npm run build`
