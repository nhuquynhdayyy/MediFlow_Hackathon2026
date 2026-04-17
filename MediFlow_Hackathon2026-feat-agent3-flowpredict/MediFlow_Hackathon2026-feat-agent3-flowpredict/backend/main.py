import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router as api_router
from app.services.response import error_response, success_response


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


configure_logging()
logger = logging.getLogger("navigator-ai")

app = FastAPI(
    title="Navigator AI - Smart Hospital Navigation & FlowPredict System",
    description="Decision system for hospital route optimization, load prediction, and overload handling.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning("Validation error on %s: %s", request.url.path, exc.errors())
    return JSONResponse(
        status_code=422,
        content=error_response(
            message="Invalid request payload.",
            data={"errors": exc.errors()},
        ),
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    logger.warning("Value error on %s: %s", request.url.path, str(exc))
    return JSONResponse(
        status_code=400,
        content=error_response(message=str(exc)),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content=error_response(
            message="Internal server error.",
            data={"path": request.url.path},
        ),
    )


@app.get("/")
def root():
    return success_response(
        message="Navigator AI backend is running.",
        data={
            "service": "Navigator AI - Smart Hospital Navigation & FlowPredict System",
            "version": "1.0.0",
            "docs": "/docs",
            "cwd": str(Path.cwd()),
        },
    )


@app.get("/health")
def health():
    return success_response(
        message="Service healthy.",
        data={
            "status": "healthy",
            "backend": "fastapi",
        },
    )


app.include_router(api_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True)
