import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Scanner } from '../components/Scanner';
import { QrCode, ArrowLeft, Settings, Shield, Sparkles, MapPin, Zap } from 'lucide-react';

const PRESET_STATIONS = ['gate-north', 'gate-south', 'vip-gate', 'mobile-kiosk'];

export const StationScannerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');
  const [stationId, setStationId] = useState('gate-north');
  const [editingStation, setEditingStation] = useState(false);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to={eventId ? `/dashboard/${eventId}` : '/events'}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{eventId ? 'Back to Event Dashboard' : 'Back to Events'}</span>
        </Link>

        {/* Station Presets Toolbar */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-2xl border border-white/[0.06]">
          {PRESET_STATIONS.map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setStationId(preset);
                setEditingStation(false);
              }}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-mono transition-all cursor-pointer ${
                stationId === preset
                  ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Main Scanner Container */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 glow-blue shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-md shadow-blue-500/20">
              <div className="w-full h-full bg-[#0B0F19] rounded-[14px] flex items-center justify-center text-blue-400">
                <QrCode className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">Kiosk & Door Scanner</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400">
                Dynamic 30s HMAC verification • Offline reconciliation enabled
              </p>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-xs font-mono text-slate-400">Station ID:</span>
            <div className="text-xs font-mono font-bold text-blue-400">{stationId}</div>
          </div>
        </div>

        <Scanner stationId={stationId} />
      </div>
    </div>
  );
};
