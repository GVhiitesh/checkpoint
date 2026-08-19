import React, { useState } from 'react';
import { api } from '../services/api';
import { AIInsightsResponse } from '../types';
import { Sparkles, Send, BrainCircuit, AlertCircle, HelpCircle, Check, Copy, Bot, Cpu } from 'lucide-react';

interface AIInsightsModalProps {
  eventId: string;
}

const SAMPLE_QUESTIONS = [
  'What is our current attendance rate and how many no-shows do we have?',
  'When was the peak check-in surge and how many people checked in then?',
  'Are we close to maximum event capacity?',
  'Give me a concise summary of the door check-in progress.',
];

export const AIInsightsModal: React.FC<AIInsightsModalProps> = ({ eventId }) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIInsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleAsk = async (qText: string) => {
    const query = qText || question;
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.post<AIInsightsResponse>(`/api/events/${eventId}/insights`, {
        question: query.trim(),
      });
      setResult(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to query AI Event Insights');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.answer) return;
    navigator.clipboard.writeText(result.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel rounded-3xl p-6 flex flex-col gap-5 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-md shadow-blue-500/20">
            <div className="w-full h-full bg-[#0B0F19] rounded-[14px] flex items-center justify-center text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">Gemini AI Event Copilot</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                SQL-GROUNDED
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              Natural language answers grounded strictly in PostgreSQL live stats
            </p>
          </div>
        </div>
      </div>

      {/* Suggested Quick Questions */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold px-0.5">Suggested Queries</div>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_QUESTIONS.map((sq, i) => (
            <button
              key={i}
              onClick={() => {
                setQuestion(sq);
                handleAsk(sq);
              }}
              disabled={loading}
              className="text-[11px] px-3 py-1.5 rounded-xl bg-slate-950/70 border border-white/[0.06] hover:border-blue-500/40 text-slate-300 hover:text-white transition-all text-left cursor-pointer active:scale-95"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Query Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk(question)}
          placeholder="Ask a question about turnout, surge velocity, or capacity..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        />
        <button
          onClick={() => handleAsk(question)}
          disabled={loading || !question.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/30 cursor-pointer active:scale-95 shrink-0"
        >
          {loading ? (
            <BrainCircuit className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>{loading ? 'Analyzing...' : 'Ask'}</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-mono">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Answer Container */}
      {result && (
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/[0.08] text-xs flex flex-col gap-3 animate-fadeIn">
          {result.fallback ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-mono font-bold">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>AI Service Fallback — Serving Direct Database Telemetry:</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-slate-900/60 p-3.5 rounded-xl border border-white/[0.06]">
                <div>Registered: <span className="text-white font-bold">{result.stats.registered}</span></div>
                <div>Checked In: <span className="text-emerald-400 font-bold">{result.stats.checked_in} ({result.stats.checked_in_pct}%)</span></div>
                <div>No-Shows: <span className="text-amber-400 font-bold">{result.stats.no_shows}</span></div>
                <div>Spots Left: <span className="text-blue-400 font-bold">{result.stats.spots_left}</span></div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="text-slate-200 leading-relaxed text-xs sm:text-sm font-normal">
                    {result.answer}
                  </div>
                </div>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors shrink-0"
                  title="Copy response"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Grounded Stats Snapshot */}
              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-blue-400" /> Model: Gemini 1.5 Flash (Temp: 0.0)
                </span>
                <span className="text-emerald-400 font-bold">100% Grounded</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
