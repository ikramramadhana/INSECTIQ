"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { BrainCircuit, WifiOff } from "lucide-react";

interface Props {
  insights:        string | null;
  geminiAvailable: boolean;
}

export default function ResultCard({ insights, geminiAvailable }: Props) {
  if (!insights) {
    return (
      <div className="p-5 flex items-center gap-3 text-slate-600 text-xs font-mono">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>AI INSIGHTS UNAVAILABLE</span>
      </div>
    );
  }

  return (
    <motion.div
      className="p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.4 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <BrainCircuit className="w-4 h-4 text-blue-500" />
        <span className="text-xs font-mono text-blue-500/80 uppercase tracking-widest">
          AI Species Insights
        </span>
        <div className="flex-1 h-px bg-blue-900/40" />
      </div>

      <div className="prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {insights}
        </ReactMarkdown>
      </div>
    </motion.div>
  );
}
