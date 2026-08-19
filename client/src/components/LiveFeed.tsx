import React from 'react';
import { CheckInFeedItem, ConflictItem } from '../types';
import { CheckCircle2, AlertTriangle, ShieldAlert, WifiOff, Clock, Radio, User, MapPin } from 'lucide-react';

interface LiveFeedProps {
  checkins: CheckInFeedItem[];
  conflicts: ConflictItem[];
}

export const LiveFeed: React.FC<LiveFeedProps> = ({ checkins, conflicts }) => {
  return (
    <div className="flex flex-col gap-6">
      {/* Conflicts Alert Section (if any detected) */}
      {conflicts.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-3xl p-5 glow-rose relative overflow-hidden backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
              <span>Multi-Station Collision Conflicts ({conflicts.length})</span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
              AUDIT LOGGED
            </span>
          </div>
          <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1">
            {conflicts.map((c) => (
              <div
                key={c.id}
                className="p-3.5 bg-slate-950/80 rounded-2xl border border-rose-500/30 text-xs font-mono"
              >
                <div className="flex items-center justify-between text-rose-300 font-bold mb-1">
                  <span>Attendee: {c.attendee_name || 'Verified Ticket Holder'}</span>
                  <span className="text-slate-500 font-normal">
                    {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <div className="text-slate-300 text-[11px] leading-relaxed">{c.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real-time Check-In Feed List */}
      <div className="glass-panel rounded-3xl p-6 flex flex-col shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Live Check-In Feed</h3>
              <p className="text-[10px] font-mono text-slate-400">Real-time WebSocket door telemetry</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-950/80 border border-white/[0.08] text-slate-300">
            {checkins.length} recent scans
          </span>
        </div>

        {checkins.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs font-mono flex flex-col items-center justify-center">
            <Radio className="w-8 h-8 text-slate-700 mb-2 animate-pulse" />
            <span>Awaiting door scans... Scanned tickets will appear here live.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
            {checkins.map((item, idx) => (
              <div
                key={`${item.registration_id || idx}-${item.checked_in_at}`}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-white/[0.05] hover:border-blue-500/30 hover:bg-slate-950/90 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{item.attendee_name || 'Attendee'}</div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-400" />
                        <span>{item.station_id || 'Gate Station'}</span>
                      </span>
                      {item.source === 'offline_sync' && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                          OFFLINE SYNCED
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-xs font-mono font-bold text-slate-400">
                  {new Date(item.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
