"""
gemini_service.py — Gemini 2.5 Flash Lite integration for InsectIQ
Provides rich insect insights: taxonomy, habitat, and fun facts.
"""
import logging
import os

import google.generativeai as genai
from google.generativeai.types import GenerationConfig

logger = logging.getLogger(__name__)


class GeminiService:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "GEMINI_API_KEY is not set. Please configure your .env file."
            )
        genai.configure(api_key=api_key)

        # ThinkingConfig — enable extended thinking for richer outputs
        self.model = genai.GenerativeModel(
            model_name="gemini-2.5-flash-lite",
            generation_config=GenerationConfig(
                temperature=0.7,
                top_p=0.95,
                max_output_tokens=1500,
            ),
        )
        logger.info("GeminiService initialized with gemini-2.5-flash-lite")

    # ------------------------------------------------------------------
    def get_insect_insights(
        self,
        insect_name: str,
        confidence: float,
        use_google_search: bool = False,
    ) -> str:
        """
        Generate detailed insect insights using Gemini.

        Args:
            insect_name      : Predicted insect class name.
            confidence       : Model confidence (0-100).
            use_google_search: (Optional) Enable Google Search grounding.

        Returns:
            Markdown-formatted string with taxonomy, habitat, fun facts.
        """
        prompt = f"""
Anda adalah ahli entomologi. Model machine learning kami mengidentifikasi serangga berikut:
- **Nama Serangga**: {insect_name}
- **Tingkat Kepercayaan Model**: {confidence:.1f}%

Berikan informasi lengkap tentang serangga ini dalam format Markdown yang rapi. 
Sertakan bagian-bagian berikut:

## Informasi Spesies (AI Insights)

**Nama Ilmiah:** [nama ilmiah]

**Nama Umum:** [nama umum dalam bahasa Indonesia]

**Spesies:** [deskripsi singkat spesies]

**Genus:** [genus]

**Famili:** [famili]

**Habitat:** [deskripsi habitat lengkap]

**Fun Fact:**
- [fun fact 1 yang menarik dan unik]
- [fun fact 2]
- [fun fact 3]

Jika tingkat kepercayaan di bawah 60%, tambahkan catatan bahwa identifikasi mungkin perlu diverifikasi lebih lanjut.
Gunakan bahasa Indonesia yang jelas dan mudah dipahami.
"""

        tools = []
        if use_google_search:
            tools = [{"google_search": {}}]

        try:
            if tools:
                response = self.model.generate_content(
                    prompt, tools=tools
                )
            else:
                response = self.model.generate_content(prompt)

            return response.text

        except Exception as exc:
            logger.error("Gemini API error: %s", exc)
            raise
