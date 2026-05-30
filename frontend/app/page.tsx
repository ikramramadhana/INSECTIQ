"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Cpu, Zap, AlertCircle,
  Bug, RefreshCw, CheckCircle, Globe, Activity, Shield
} from "lucide-react";
import ResultCard from "@/components/ResultCard";

interface TopKResult { class_name: string; confidence: number }
interface PredictionResult {
  predicted_class:  string;
  confidence:       number;
  top_k:            TopKResult[];
  ai_insights:      string | null;
  gemini_available: boolean;
}
type AppState = "idle" | "uploading" | "analyzing" | "done" | "error";

const fmt = (n: number) => n.toFixed(1);

function HUDCorner({ pos }: { pos: string }) {
  const corners: Record<string, string> = {
    "tl": "top-0 left-0 border-t-2 border-l-2",
    "tr": "top-0 right-0 border-t-2 border-r-2",
    "bl": "bottom-0 left-0 border-b-2 border-l-2",
    "br": "bottom-0 right-0 border-b-2 border-r-2",
  };
  return <div className={`absolute w-4 h-4 border-blue-400 ${corners[pos]}`} />;
}

function FuturisticBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,#0f2460_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,#0a1628_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,#060d1f_0%,transparent_70%)]" />
      <svg className="absolute inset-0 w-full h-full opacity-[0.06]">
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#3b82f6" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)"/>
      </svg>
      <motion.div
        className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"
        animate={{ y: ["0vh", "100vh"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

function ScannerOverlay({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-blue-500/40 scanlines">
      <img src={imageUrl} alt="Scanning" className="w-full max-h-64 object-contain bg-[#020c1f]" />
      <motion.div
        className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_#60a5fa]"
        animate={{ y: ["0%", "100%", "0%"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />
      {["tl","tr","bl","br"].map(p => <HUDCorner key={p} pos={p} />)}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#020818]/80 px-3 py-1 rounded-full border border-blue-500/30 backdrop-blur-sm">
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-blue-400"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
        <span className="text-xs font-mono text-blue-400 tracking-widest">SCANNING…</span>
      </div>
    </div>
  );
}

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const color = value >= 80 ? "#3b82f6" : value >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400 font-mono capitalize">{label.replace(/_/g, " ")}</span>
        <span className="font-mono" style={{ color }}>{fmt(value)}%</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function DropZone({ onFile, isDragging, setIsDragging }: {
  onFile: (f: File) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handle = (f: File) => { if (f?.type.startsWith("image/")) onFile(f); };

  return (
    <motion.div
      className={`relative border border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-300 scanlines
        ${isDragging
          ? "border-blue-400 bg-blue-500/10 glow-blue-strong"
          : "border-blue-900/60 hover:border-blue-600/60 hover:bg-blue-500/5"
        }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
      onClick={() => inputRef.current?.click()}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
    >
      {["tl","tr","bl","br"].map(p => <HUDCorner key={p} pos={p} />)}
      <input ref={inputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="flex justify-center mb-5"
      >
        <div className="relative w-16 h-16 rounded-xl bg-blue-950/80 border border-blue-700/50 flex items-center justify-center glow-blue">
          <Bug className="w-8 h-8 text-blue-400" />
          <motion.div
            className="absolute inset-0 rounded-xl border border-blue-400/30"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
      <p className="font-display font-bold text-lg text-blue-50 mb-1 tracking-wide" style={{ fontFamily: "'Orbitron', sans-serif" }}>
        UPLOAD SPECIMEN
      </p>
      <p className="text-sm text-blue-400/70">Drag & drop atau klik untuk memilih gambar</p>
      <p className="text-xs text-blue-900 mt-2 font-mono">JPG · PNG · WebP · MAX 10MB</p>
    </motion.div>
  );
}

export default function Home() {
  const [state, setState]           = useState<AppState>("idle");
  const [imageFile, setImageFile]   = useState<File | null>(null);
  const [imageUrl, setImageUrl]     = useState<string | null>(null);
  const [result, setResult]         = useState<PredictionResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [useSearch, setUseSearch]   = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state === "done") setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
  }, [state]);

  const handleFile = useCallback((file: File) => {
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setResult(null);
    setError(null);
    setState("uploading");
  }, []);

  const handleAnalyze = async () => {
    if (!imageFile) return;
    setState("analyzing");
    try {
      const form = new FormData();
      form.append("file", imageFile);
      const res = await fetch(`/api/predict?use_google_search=${useSearch}`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      setResult(await res.json());
      setState("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      setState("error");
    }
  };

  const handleReset = () => {
    setImageFile(null); setImageUrl(null);
    setResult(null); setError(null);
    setState("idle");
  };

  return (
    <div className="min-h-screen relative">
      <FuturisticBg />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-10">

        <motion.header className="text-center mb-10" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center glow-blue-strong border border-blue-500/30">
                <Cpu className="w-8 h-8 text-blue-200" />
              </div>
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-400"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
          </div>
          <h1 className="text-4xl font-black text-white mb-1 tracking-widest text-glow" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            INSECT<span className="text-blue-400">IQ</span>
          </h1>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-blue-500/50" />
            <p className="text-xs font-mono text-blue-400/70 tracking-widest uppercase">AI-Powered Insect Identification</p>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-blue-500/50" />
          </div>
          <div className="flex items-center justify-center gap-3 text-xs font-mono text-slate-600">
            <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-blue-600" /> EfficientNet-B3</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-blue-600" /> Gemini 2.5 Flash</span>
          </div>
        </motion.header>

        <motion.div
          className="relative bg-[#030d1f]/90 border border-blue-900/50 rounded-xl p-6 backdrop-blur-sm mb-6 scanlines"
          style={{ boxShadow: "0 0 40px #1d4ed811, inset 0 1px 0 #ffffff08" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {["tl","tr","bl","br"].map(p => <HUDCorner key={p} pos={p} />)}
          <AnimatePresence mode="wait">
            {state === "idle" && (
              <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <DropZone onFile={handleFile} isDragging={isDragging} setIsDragging={setIsDragging} />
              </motion.div>
            )}

            {(state === "uploading" || state === "error") && imageUrl && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="relative rounded-lg overflow-hidden border border-blue-900/40 scanlines">
                  <img src={imageUrl} alt="Preview" className="w-full max-h-64 object-contain bg-[#020c1f]" />
                  {["tl","tr","bl","br"].map(p => <HUDCorner key={p} pos={p} />)}
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3 text-blue-400" />
                    <span className="text-xs font-mono text-blue-400">LOADED</span>
                  </div>
                </div>
                <p className="text-xs text-center text-slate-600 font-mono truncate">{imageFile?.name}</p>
                <label className="flex items-center gap-3 text-sm text-blue-400/70 cursor-pointer select-none">
                  <div onClick={() => setUseSearch(!useSearch)}
                    className={`w-9 h-5 rounded-full transition-all relative flex items-center px-0.5 cursor-pointer border
                      ${useSearch ? "bg-blue-600 border-blue-500" : "bg-slate-900 border-slate-700"}`}>
                    <motion.div animate={{ x: useSearch ? 16 : 0 }} className="w-4 h-4 bg-white rounded-full shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 25 }} />
                  </div>
                  <Globe className="w-4 h-4" />
                  <span className="font-mono text-xs tracking-wide">GOOGLE SEARCH GROUNDING</span>
                </label>
                <div className="flex gap-3">
                  <button onClick={handleReset} className="flex-1 py-2.5 rounded-lg border border-slate-800 text-slate-500 text-xs font-mono hover:border-slate-600 hover:text-slate-300 transition-colors flex items-center justify-center gap-2 tracking-wider">
                    <RefreshCw className="w-3.5 h-3.5" /> RESET
                  </button>
                  <motion.button
                    onClick={handleAnalyze}
                    className="flex-[2] py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs font-mono tracking-widest transition-colors flex items-center justify-center gap-2 glow-blue"
                    whileTap={{ scale: 0.97 }}
                  >
                    <Zap className="w-4 h-4" /> ANALYZE SPECIMEN
                  </motion.button>
                </div>
                {state === "error" && error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 p-3 bg-red-950/30 border border-red-800/40 rounded-lg text-red-400 text-xs font-mono">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </motion.div>
            )}

            {state === "analyzing" && imageUrl && (
              <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <ScannerOverlay imageUrl={imageUrl} />
                <div className="text-center space-y-1">
                  <p className="text-blue-400 font-mono text-sm tracking-widest">PROCESSING SPECIMEN…</p>
                  <p className="text-slate-600 text-xs font-mono">EfficientNet-B3 · Gemini 2.5 Flash Lite</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {state === "done" && result && (
            <motion.div ref={resultRef} key="result" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
              <div className="relative bg-[#030d1f]/90 border border-blue-900/50 rounded-xl overflow-hidden backdrop-blur-sm scanlines"
                style={{ boxShadow: "0 0 40px #1d4ed811, inset 0 1px 0 #ffffff08" }}>
                {["tl","tr","bl","br"].map(p => <HUDCorner key={p} pos={p} />)}

                {/* Specimen image */}
                {imageUrl && (
                  <div className="relative border-b border-blue-900/30 scanlines">
                    <img src={imageUrl} alt="Specimen" className="w-full max-h-56 object-contain bg-[#020c1f]" />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-[#020818]/80 px-2 py-1 rounded-full border border-blue-500/20 backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span className="text-xs font-mono text-blue-400 tracking-widest">SPECIMEN</span>
                    </div>
                    {["tl","tr","bl","br"].map(p => <HUDCorner key={p} pos={p} />)}
                  </div>
                )}

                {/* Result header */}
                <div className="bg-gradient-to-r from-blue-950/80 to-[#030d1f] border-b border-blue-900/30 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-xs font-mono text-blue-500 tracking-widest uppercase">Identification Result</span>
                  </div>
                  <h2 className="font-black text-2xl text-white mb-3 tracking-wide capitalize" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                    {result.predicted_class.replace(/_/g, " ")}
                  </h2>
                  <div className="space-y-2">
                    {result.top_k.map((item) => (
                      <ConfidenceBar key={item.class_name} value={item.confidence} label={item.class_name} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <button onClick={handleReset} className="flex items-center gap-1.5 text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors tracking-wider">
                      <RefreshCw className="w-3 h-3" /> NEW SCAN
                    </button>
                    {result.gemini_available && (
                      <span className="text-xs font-mono text-blue-500/70 tracking-wider">● GEMINI ACTIVE</span>
                    )}
                  </div>
                </div>

                <ResultCard insights={result.ai_insights} geminiAvailable={result.gemini_available} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.footer className="text-center mt-10 text-slate-800 text-xs font-mono tracking-widest"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          INSECTIQ · ML LAB FINAL PROJECT · EFFICIENTNET-B3 + GEMINI 2.5
        </motion.footer>
      </div>
    </div>
  );
}