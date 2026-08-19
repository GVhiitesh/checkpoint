import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../services/api';
import { QRTokenResponse } from '../types';
import { CheckCircle2, RefreshCw, ShieldAlert, Timer, ShieldCheck, Sparkles, Lock, Copy, Check, Key, Zap } from 'lucide-react';

interface QRGeneratorProps {
  registrationId: string;
  eventName: string;
}

export const QRGenerator: React.FC<QRGeneratorProps> = ({ registrationId, eventName }) => {
  const [tokenData, setTokenData] = useState<QRTokenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(30);
  const [copied, setCopied] = useState(false);
  const [rotatedFlash, setRotatedFlash] = useState(false);

  const fetchToken = async () => {
    try {
      setLoading(true);
      const res = await api.get<QRTokenResponse>(`/api/registrations/${registrationId}/token`);
      setTokenData(res);
      setError(null);
      setCountdown(30);

      // Trigger flash animation on token rotation
      setRotatedFlash(true);
      setTimeout(() => setRotatedFlash(false), 1200);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate dynamic ticket token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();
  }, [registrationId]);

  // Token rotation & timer countdown interval
  useEffect(() => {
    if (!tokenData || tokenData.checked_in) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [tokenData]);

  const handleCopyToken = () => {
    if (!tokenData?.token) return;
    navigator.clipboard.writeText(tokenData.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !tokenData) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-slate-950/60 rounded-3xl border border-white/[0.08] animate-pulse w-full max-w-sm">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <div className="text-xs font-mono font-bold text-slate-300">Minting Cryptographic QR Token...</div>
        <div className="text-[10px] font-mono text-slate-500 mt-1">HMAC-SHA256 30-Second Rotation Window</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-rose-950/30 rounded-3xl border border-rose-500/30 text-center w-full max-w-sm">
        <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <div className="text-sm font-bold text-rose-300 mb-1">Ticket Token Unavailable</div>
        <div className="text-xs text-rose-400/80 mb-4">{error}</div>
        <button
          onClick={fetchToken}
          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-all shadow-md shadow-rose-600/30"
        >
          Retry Minting
        </button>
      </div>
    );
  }

  // If already checked in, display verified VIP check-in pass
  if (tokenData?.checked_in) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-emerald-950/30 rounded-3xl border border-emerald-500/40 text-center glow-emerald w-full max-w-sm relative overflow-hidden backdrop-blur-xl">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 border border-emerald-500/50 shadow-lg shadow-emerald-500/20 animate-pulse-glow">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 mb-2">
          GATE ACCESS VERIFIED
        </span>
        <h3 className="text-xl font-extrabold text-white mb-1">Checked In Successfully</h3>
        <p className="text-xs text-slate-300 mb-4 max-w-[220px]">
          Your pass has been securely redeemed at the door station.
        </p>
        <div className="px-4 py-2 rounded-xl bg-slate-900/80 border border-white/[0.08] text-xs font-mono text-slate-400">
          Redeemed: <span className="text-white font-bold">{new Date(tokenData.checked_in_at!).toLocaleTimeString()}</span>
        </div>
      </div>
    );
  }

  const progressPct = (countdown / 30) * 100;

  return (
    <div className="flex flex-col items-center w-full max-w-sm space-y-4">
      {/* QR Code Card Frame */}
      <div className="relative p-5 bg-white rounded-3xl shadow-2xl shadow-blue-500/10 border-4 border-slate-900 group">
        {/* Holographic Watermark Border */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-transparent to-emerald-500/10 rounded-2xl pointer-events-none" />

        {tokenData?.token && (
          <QRCodeSVG
            value={tokenData.token}
            size={220}
            level="H"
            includeMargin={false}
          />
        )}
      </div>

      {/* Rotation Countdown Bar */}
      <div className="w-full max-w-[260px]">
        <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1.5">
          <span className="flex items-center gap-1.5 font-medium">
            <Timer className="w-3.5 h-3.5 text-blue-400" />
            <span>QR & Token Rotate:</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchToken}
              disabled={loading}
              className="text-slate-400 hover:text-blue-400 transition-colors p-0.5 cursor-pointer"
              title="Force rotate token now"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <span className="font-bold text-blue-400 font-mono text-sm">{countdown}s</span>
          </div>
        </div>
        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/[0.08]">
          <div
            className={`h-full transition-all duration-1000 ease-linear rounded-full ${
              countdown <= 5 ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-blue-600 to-indigo-400'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Live Synchronized 5-Letter Token Box */}
      {(() => {
        const shortToken = tokenData?.short_code || (tokenData?.token ? tokenData.token.split('.')[2]?.slice(0, 5).toUpperCase() : '-----');

        return (
          <div
            className={`w-full max-w-[260px] p-3 rounded-2xl border transition-all duration-300 ${
              rotatedFlash
                ? 'bg-blue-950/90 border-blue-400 shadow-lg shadow-blue-500/30 scale-[1.03]'
                : 'bg-slate-950/80 border-white/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                <Key className="w-3 h-3 text-blue-400" />
                <span>Live Pass Token:</span>
              </span>
              <button
                onClick={() => {
                  if (!shortToken || shortToken === '-----') return;
                  navigator.clipboard.writeText(shortToken);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-white/[0.08] hover:border-blue-500/40 text-[10px] font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Copy 5-letter code"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-400" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* 5-Letter Visual Character Pills */}
            <div className="flex items-center justify-center gap-1.5 py-1">
              {shortToken.split('').map((char, i) => (
                <div
                  key={i}
                  className="w-9 h-10 rounded-xl bg-slate-900 border border-blue-500/30 flex items-center justify-center text-base font-extrabold font-mono text-blue-300 shadow-inner shadow-black/60 tracking-wider"
                >
                  {char}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mt-2 px-1">
              <span>Rotates every 30s with QR</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live 5-Letter Code
              </span>
            </div>
          </div>
        );
      })()}

      {/* Security Details Badge */}
      <div className="text-center bg-slate-950/40 px-4 py-2 rounded-2xl border border-white/[0.04] w-full max-w-[280px]">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Dynamic Anti-Screenshot Pass</span>
        </div>
        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
          HMAC-SHA256 30s Window Protection
        </div>
      </div>
    </div>
  );
};
