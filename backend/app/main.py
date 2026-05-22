"""app/main.py — FastAPI application entry point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog

from app.config import settings
from app.bootstrap import ensure_demo_admin
from app.database import engine, Base, AsyncSessionLocal
from app import models as _models
from app.routers import auth, patients, ecg, xray, labs, reports, alerts

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("MediCore AI starting", version=settings.APP_VERSION, env=settings.ENVIRONMENT)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as db:
        await ensure_demo_admin(db)
    yield
    logger.info("MediCore AI shutting down")
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-Powered Clinical Decision Support Platform",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    response = await call_next(request)
    logger.info(
        "request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        ip=request.client.host if request.client else "unknown",
    )
    return response


@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    logger.error("unhandled_error", error=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error. Please try again."},
    )


app.include_router(auth.router,     prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")
app.include_router(ecg.router,      prefix="/api/v1")
app.include_router(xray.router,     prefix="/api/v1")
app.include_router(labs.router,     prefix="/api/v1")
app.include_router(reports.router,  prefix="/api/v1")
app.include_router(alerts.router,   prefix="/api/v1")


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy", "version": settings.APP_VERSION}
