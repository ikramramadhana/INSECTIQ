"""
main.py — FastAPI backend entry point for InsectIQ
Run with: uvicorn main:app --reload
"""
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from gemini_service import GeminiService
from ml_service import MLService

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────
# App-level singletons (loaded once at startup)
# ──────────────────────────────────────────────────────────
ml_service: MLService | None = None
gemini_service: GeminiService | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ml_service, gemini_service
    logger.info("Loading ML model …")
    ml_service = MLService()
    logger.info("Initializing Gemini service …")
    try:
        gemini_service = GeminiService()
    except EnvironmentError as e:
        logger.warning("Gemini disabled: %s", e)
        gemini_service = None
    yield
    logger.info("Shutting down InsectIQ backend.")


app = FastAPI(
    title="InsectIQ API",
    description="Smart Insect Identifier powered by EfficientNet-B3 + Gemini",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────
# Response schemas
# ──────────────────────────────────────────────────────────
class TopKResult(BaseModel):
    class_name:  str
    confidence:  float


class PredictionResponse(BaseModel):
    predicted_class:  str
    confidence:       float
    top_k:            list[TopKResult]
    ai_insights:      str | None
    gemini_available: bool


# ──────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {
        "status"  : "running",
        "service" : "InsectIQ",
        "version" : "1.0.0",
        "docs"    : "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {
        "ml_model_loaded"   : ml_service is not None,
        "gemini_available"  : gemini_service is not None,
        "classes"           : ml_service.class_names if ml_service else [],
    }


@app.post("/predict", response_model=PredictionResponse, tags=["Prediction"])
async def predict(
    file: UploadFile = File(..., description="Insect image (JPEG/PNG)"),
    use_google_search: bool = False,
):
    """
    Upload an insect image → get ML prediction + Gemini AI insights.
    Falls back gracefully if Gemini is unavailable (503).
    """
    # Validate content type
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/jpg"):
        raise HTTPException(
            status_code=422,
            detail="Only JPEG, PNG, or WebP images are supported.",
        )

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB).")

    # ── ML Inference ──────────────────────────────────────
    try:
        ml_result = ml_service.predict(image_bytes, top_k=3)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error("ML inference failed: %s", exc)
        raise HTTPException(status_code=500, detail="Model inference failed.")

    top_k_out = [
        TopKResult(class_name=item["class"], confidence=item["confidence"])
        for item in ml_result["top_k"]
    ]

    # ── Gemini Insights (with fallback) ───────────────────
    ai_insights      = None
    gemini_available = False

    if gemini_service is not None:
        try:
            ai_insights = gemini_service.get_insect_insights(
                insect_name=ml_result["predicted_class"],
                confidence=ml_result["confidence"],
                use_google_search=use_google_search,
            )
            gemini_available = True
        except Exception as exc:
            logger.warning("Gemini unavailable (%s) — returning ML result only.", exc)
            ai_insights = (
                "> ⚠️ **AI Insights sedang tidak tersedia** (layanan sibuk/limit).\n"
                "> Hasil prediksi model tetap ditampilkan di atas."
            )

    return PredictionResponse(
        predicted_class=ml_result["predicted_class"],
        confidence=ml_result["confidence"],
        top_k=top_k_out,
        ai_insights=ai_insights,
        gemini_available=gemini_available,
    )
