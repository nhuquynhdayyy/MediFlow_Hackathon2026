"""
main.py — FlowPredict Backend Entry Point (Production-ready)

- Central API Gateway
- Navigator AI (controlled flow)
- Health check & system info
"""

import os
from pathlib import Path
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware

# ==============================
# 🔧 ENV LOADER
# ==============================
def load_local_env():
    dotenv_path = Path(__file__).resolve().parent / ".env"
    if not dotenv_path.exists():
        return

    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path)
    except Exception:
        with dotenv_path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()

                if (value.startswith('"') and value.endswith('"')) or \
                   (value.startswith("'") and value.endswith("'")):
                    value = value[1:-1]

                os.environ.setdefault(key, value)


load_local_env()

# ==============================
# 🚀 FASTAPI INIT
# ==============================
app = FastAPI(
    title="MediFlow AI - FlowPredict Navigator",
    description="Smart Hospital Routing + AI Explanation Layer",
    version="3.0.0",
)

# ==============================
# 🌐 CORS
# ==============================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # hackathon: mở hết
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# 📦 IMPORT ROUTERS
# ==============================
from app.api import stats, load, forecast, alerts, optimizer, hospital  # noqa
from app.services.planner import extract_departments
from app.services.validator import validate_route
from app.services.explainer import explain_route

# ==============================
# 🏠 ROOT
# ==============================
@app.get("/")
def read_root():
    fpt_configured = bool(os.getenv("FPT_API_KEY") and os.getenv("FPT_AI_URL"))

    return {
        "service": "FlowPredict Navigator Backend",
        "version": "3.0.0",
        "status": "running",
        "ai_role": "navigator + operations",
        "engine": "fpt_ai" if fpt_configured else "rule_based",
        "architecture": "deterministic_backend + ai_explainer + operations_ai",
        "features": [
            "intent_parsing",
            "medical_dependency_routing",
            "cost_based_optimizer",
            "forecast_integration",
            "hospital_operations_assistant",
        ],
    }

# ==============================
# ❤️ HEALTH CHECK
# ==============================
@app.get("/health")
def health_check():
    fpt_ok = bool(os.getenv("FPT_API_KEY") and os.getenv("FPT_AI_URL"))

    return {
        "status": "healthy",
        "ai": "connected" if fpt_ok else "fallback_mode",
        "system": "operational",
    }

# ==============================
# 🧠 NAVIGATOR API (CORE)
# ==============================
@app.post("/api/navigator")
def navigator(payload: dict = Body(...)):
    """
    Main AI entry:
    - Parse user intent
    - Optimize route
    - Validate
    - AI explain
    """

    user_text = payload.get("message", "").strip()

    if not user_text:
        return {"message": "Bạn hãy nhập nhu cầu khám nhé."}

    # 🔍 1. Extract intent
    departments = extract_departments(user_text)

    if not departments:
        return {
            "message": "Bạn muốn khám những khoa nào? Ví dụ: xét nghiệm, siêu âm, tai mũi họng..."
        }

    # ⚙️ 2. Call optimizer (backend quyết định)
    result = optimizer.optimize_route({"departments": departments})

    if "error" in result:
        return {"message": "Không tìm thấy khoa phù hợp."}

    route = result.get("optimal_route", [])

    # 🔒 3. Validate (chống AI phá)
    if not validate_route(route, departments):
        return {
            "message": "Có lỗi khi tạo lộ trình. Vui lòng thử lại."
        }

    # 🤖 4. AI explain (chỉ nói, không quyết định)
    explanation = explain_route(route, result)

    # ⏱️ 5. Timeline (simple)
    timeline = []
    current_time = 0

    for dep in route:
        timeline.append({
            "step": dep,
            "eta_min": current_time
        })
        current_time += 10  # giả định 10 phút mỗi bước

    # 🎯 Final response
    return {
        "route": route,
        "total_time": result.get("total_time", 0),
        "timeline": timeline,
        "explanation": explanation,
        "confidence": 0.9,
    }

# ==============================
# 📡 OTHER ROUTERS
# ==============================
app.include_router(stats.router, prefix="/api/stats", tags=["Stats"])
app.include_router(load.router, prefix="/api/load", tags=["Load"])
app.include_router(forecast.router, prefix="/api/forecast", tags=["Forecast"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(hospital.router, prefix="/api/hospital", tags=["Hospital"])
app.include_router(optimizer.router, prefix="/api/optimizer", tags=["Optimizer"])

# ==============================
# ▶️ RUN
# ==============================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True)