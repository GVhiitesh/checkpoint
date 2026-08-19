import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../services/api';
import { enqueueOfflineScan, syncOfflineScans, getPendingScans } from '../services/offlineQueue';
import { CheckCircle, AlertTriangle, XCircle, WifiOff, Camera, Keyboard, RefreshCw, Volume2, VolumeX, History, MapPin, Sparkles } from 'lucide-react';

interface ScannerProps {
  stationId: string;
}

interface ScanHistoryEntry {
  id: string;
  name: string;
  status: 'accepted' | 'duplicate' | 'offline_queued' | 'error';
  time: string;
}

// Web Audio API Sound Synthesizer (No external asset files needed)
function playFeedbackSound(type: 'success' | 'duplicate' | 'offline' | 'error', muted: boolean) {
  if (muted) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'success') {
      // Pleasant high double chime (C5 -> G5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.setValueAtTime(783.99, ctx.currentTime + 0.1); // G5
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.35);
    } else if (type === 'duplicate') {
      // Warning double low buzz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'offline') {
      // Soft double blip
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else {
      // Alert low error tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // AudioContext permission error handled safely
  }
}

export const Scanner: React.FC<ScannerProps> = ({ stationId }) => {
  const [scanResult, setScanResult] = useState<{
    type: 'success' | 'duplicate' | 'offline_queued' | 'error';
    message: string;
    detail?: string;
    timestamp: string;
  } | null>(null);

  const [recentScans, setRecentScans] = useState<ScanHistoryEntry[]>([]);
  const [manualToken, setManualToken] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const updatePending = async () => {
      const pending = await getPendingScans();
      setPendingCount(pending.length);
    };
    updatePending();
  }, [scanResult]);

  const handleProcessScan = async (tokenString: string) => {
    const isOnline = navigator.onLine;

    // Offline Handling: Immediately store to IndexedDB queue
    if (!isOnline) {
      try {
        const item = await enqueueOfflineScan(tokenString, stationId);
        playFeedbackSound('offline', !soundEnabled);
        setScanResult({
          type: 'offline_queued',
          message: 'Saved to Offline Queue',
          detail: `Scan ID: ${item.client_scan_id.slice(-8)} — Will auto-sync when network returns`,
          timestamp: new Date().toLocaleTimeString(),
        });
        setRecentScans((prev) => [
          {
            id: item.client_scan_id,
            name: 'Offline Attendee Scan',
            status: 'offline_queued',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          },
          ...prev.slice(0, 4),
        ]);
      } catch (err: any) {
        playFeedbackSound('error', !soundEnabled);
        setScanResult({
          type: 'error',
          message: 'Failed to queue offline scan',
          detail: err?.message,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
      return;
    }

    // Online Handling: POST /api/checkins
    try {
      const res = await api.post('/api/checkins', {
        token: tokenString,
        station_id: stationId,
      });

      if (res.status === 'accepted') {
        playFeedbackSound('success', !soundEnabled);
        setScanResult({
          type: 'success',
          message: `${res.attendee_name || 'Attendee'} Verified!`,
          detail: `Checked in at ${new Date(res.checked_in_at).toLocaleTimeString()}`,
          timestamp: new Date().toLocaleTimeString(),
        });
        setRecentScans((prev) => [
          {
            id: `scan_${Date.now()}`,
            name: res.attendee_name || 'Verified Attendee',
            status: 'accepted',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          },
          ...prev.slice(0, 4),
        ]);
      }
    } catch (err: any) {
      if (err.status === 409) {
        playFeedbackSound('duplicate', !soundEnabled);
        setScanResult({
          type: 'duplicate',
          message: 'DUPLICATE CHECK-IN REJECTED',
          detail: err?.data?.message || 'Already checked in.',
          timestamp: new Date().toLocaleTimeString(),
        });
        setRecentScans((prev) => [
          {
            id: `scan_${Date.now()}`,
            name: 'Duplicate Ticket Attempt',
            status: 'duplicate',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          },
          ...prev.slice(0, 4),
        ]);
      } else if (err.status === 400) {
        playFeedbackSound('error', !soundEnabled);
        setScanResult({
          type: 'error',
          message: 'Invalid / Expired QR Token',
          detail: err?.data?.message || 'Token signature expired or malformed.',
          timestamp: new Date().toLocaleTimeString(),
        });
      } else if (err.status === 403) {
        playFeedbackSound('error', !soundEnabled);
        setScanResult({
          type: 'error',
          message: 'Forbidden / Unauthorized',
          detail: err?.data?.message || 'You are not authorized to check in for this event.',
          timestamp: new Date().toLocaleTimeString(),
        });
      } else if (err.status === 404) {
        playFeedbackSound('error', !soundEnabled);
        setScanResult({
          type: 'error',
          message: 'Registration Not Found',
          detail: err?.data?.message || 'The scanned ticket does not exist.',
          timestamp: new Date().toLocaleTimeString(),
        });
      } else if (err.status) {
        playFeedbackSound('error', !soundEnabled);
        setScanResult({
          type: 'error',
          message: `Server Error (${err.status})`,
          detail: err?.data?.error || err?.message || 'Server returned an error response.',
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        // Genuine network failure -> enqueue to offline queue
        const item = await enqueueOfflineScan(tokenString, stationId);
        playFeedbackSound('offline', !soundEnabled);
        setScanResult({
          type: 'offline_queued',
          message: 'Network Disconnected — Scan Queued',
          detail: `ID: ${item.client_scan_id.slice(-8)}`,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    }
  };

  // Mount HTML5 QR Code Scanner
  useEffect(() => {
    if (!cameraActive) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 15,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        handleProcessScan(decodedText);
      },
      (error) => {
        // Ignore frame noise
      }
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [cameraActive, stationId, soundEnabled]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    setManualSubmitting(true);
    await handleProcessScan(manualToken.trim());
    setManualToken('');
    setManualSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Scanner Toolbar & Audio Toggle */}
      <div className="flex items-center justify-between bg-slate-950/80 p-2 rounded-2xl border border-white/[0.06]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCameraActive(true)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              cameraActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera</span>
          </button>
          <button
            onClick={() => setCameraActive(false)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              !cameraActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Manual Input</span>
          </button>
        </div>

        {/* Audio Mute/Unmute Button */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono border transition-all cursor-pointer ${
            soundEnabled
              ? 'bg-slate-900 border-white/[0.08] text-slate-300 hover:text-white'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-400'
          }`}
          title={soundEnabled ? 'Mute Sound Feedback' : 'Unmute Sound Feedback'}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-blue-400" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span>{soundEnabled ? 'AUDIO ON' : 'MUTED'}</span>
        </button>
      </div>

      {/* Camera Scanner View */}
      {cameraActive ? (
        <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-slate-950 p-2 shadow-2xl">
          <div id="qr-reader" className="w-full text-white rounded-2xl overflow-hidden" />
        </div>
      ) : (
        /* Manual Token Input */
        <form onSubmit={handleManualSubmit} className="bg-slate-950/80 p-6 rounded-3xl border border-white/[0.08] space-y-3">
          <label className="block text-xs font-mono text-slate-300">
            Paste or Type Cryptographic QR Token:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="e.g. 19b0079e-8a8b...4598.a4b8..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-white/[0.08] text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={manualSubmitting || !manualToken.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/30 shrink-0 cursor-pointer"
            >
              Verify Token
            </button>
          </div>
        </form>
      )}

      {/* Real-time Scan Result Banner */}
      {scanResult && (
        <div
          className={`p-5 rounded-3xl border transition-all animate-fadeIn shadow-2xl ${
            scanResult.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 glow-emerald'
              : scanResult.type === 'duplicate'
              ? 'bg-rose-950/50 border-rose-500/40 text-rose-300 glow-rose'
              : scanResult.type === 'offline_queued'
              ? 'bg-amber-950/50 border-amber-500/40 text-amber-300 glow-amber'
              : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-start gap-3.5">
            {scanResult.type === 'success' && <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />}
            {scanResult.type === 'duplicate' && <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />}
            {scanResult.type === 'offline_queued' && <WifiOff className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />}
            {scanResult.type === 'error' && <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />}

            <div className="flex-1">
              <div className="text-base font-extrabold tracking-tight mb-0.5">{scanResult.message}</div>
              {scanResult.detail && (
                <div className="text-xs opacity-90 font-mono leading-relaxed">{scanResult.detail}</div>
              )}
            </div>
            <div className="text-[11px] font-mono opacity-70 shrink-0">{scanResult.timestamp}</div>
          </div>
        </div>
      )}

      {/* Operator Recent Session Scans */}
      {recentScans.length > 0 && (
        <div className="bg-slate-950/60 p-4 rounded-3xl border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1 font-semibold">
            <span className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-blue-400" />
              <span>Operator Session History</span>
            </span>
            <span>Station: {stationId}</span>
          </div>
          <div className="space-y-1.5">
            {recentScans.map((s, i) => (
              <div
                key={`${s.id}-${i}`}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-white/[0.04] text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      s.status === 'accepted'
                        ? 'bg-emerald-400'
                        : s.status === 'duplicate'
                        ? 'bg-rose-400'
                        : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-white font-medium truncate max-w-[180px]">{s.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      s.status === 'accepted'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : s.status === 'duplicate'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {s.status.toUpperCase()}
                  </span>
                  <span className="text-slate-500 text-[10px]">{s.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
