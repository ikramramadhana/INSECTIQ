"""
ml_service.py — Model inference service for InsectIQ
Loads EfficientNet-B3 TorchScript model and runs predictions.
"""
import io
import json
import logging
from pathlib import Path
from typing import List, Tuple

import torch
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).parent / "artifacts"

# ImageNet normalization (same as training)
_INFERENCE_TRANSFORM = transforms.Compose([
    transforms.Resize((300, 300)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])


class MLService:
    def __init__(self):
        self.model: torch.jit.ScriptModule | None = None
        self.class_names: List[str] = []
        self.device = torch.device("cpu")  # CPU for local inference
        self._load_artifacts()

    # ------------------------------------------------------------------
    def _load_artifacts(self):
        """Load TorchScript model and class metadata from artifacts/."""
        metadata_path = ARTIFACTS_DIR / "metadata.json"
        model_path    = ARTIFACTS_DIR / "model_scripted.pt"

        if not metadata_path.exists():
            raise FileNotFoundError(
                f"metadata.json not found in {ARTIFACTS_DIR}. "
                "Please copy your training artifacts here."
            )
        if not model_path.exists():
            raise FileNotFoundError(
                f"model_scripted.pt not found in {ARTIFACTS_DIR}. "
                "Please copy your training artifacts here."
            )

        with open(metadata_path) as f:
            meta = json.load(f)
        self.class_names = meta["class_names"]

        logger.info("Loading model from %s …", model_path)
        self.model = torch.jit.load(str(model_path), map_location=self.device)
        self.model.eval()
        logger.info("Model loaded — %d classes", len(self.class_names))

    # ------------------------------------------------------------------
    def predict(self, image_bytes: bytes, top_k: int = 3) -> dict:
        """
        Run inference on raw image bytes.

        Returns:
            {
                "predicted_class": str,
                "confidence": float,          # 0-100
                "top_k": [{"class": str, "confidence": float}, ...]
            }
        """
        # Decode image
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as exc:
            raise ValueError(f"Cannot decode image: {exc}") from exc

        # Preprocess
        tensor = _INFERENCE_TRANSFORM(image).unsqueeze(0).to(self.device)

        # Inference
        with torch.no_grad():
            logits = self.model(tensor)
            probs  = F.softmax(logits, dim=1)[0]

        # Top-K results
        top_k  = min(top_k, len(self.class_names))
        values, indices = torch.topk(probs, top_k)

        top_results = [
            {
                "class": self.class_names[idx.item()],
                "confidence": round(val.item() * 100, 2),
            }
            for val, idx in zip(values, indices)
        ]

        return {
            "predicted_class": top_results[0]["class"],
            "confidence":      top_results[0]["confidence"],
            "top_k":           top_results,
        }
