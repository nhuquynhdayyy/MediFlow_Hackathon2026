from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import forecast, hospital, load, optimizer, patient

app = FastAPI(
    title="Navigator AI - Smart Hospital Navigation & FlowPredict",
    version="4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "status": "success",
        "message": "Navigator AI backend running",
        "data": {
            "service": "Navigator AI",
            "mode": "production-ready hackathon",
            "flows": ["patient_flow", "hospital_flow", "closed_loop_rerouting"],
        },
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


app.include_router(optimizer.router, prefix="/api", tags=["Navigator"])
app.include_router(load.router, prefix="/api", tags=["Load"])
app.include_router(forecast.router, prefix="/api", tags=["Predict"])
app.include_router(hospital.router, prefix="/api", tags=["Operations"])
app.include_router(patient.router, prefix="/api", tags=["Patient"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True)