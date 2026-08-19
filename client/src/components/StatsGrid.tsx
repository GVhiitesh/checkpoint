import React from 'react';
import { EventStats } from '../types';
import { Users, UserCheck, UserX, Clock, Flame, PieChart, TrendingUp, AlertCircle, ShieldCheck } from 'lucide-react';

interface StatsGridProps {
  stats: EventStats | null;
  loading?: boolean;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats, loading }) => {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-3xl bg-slate-900/40 border border-white/[0.06] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const checkInRate = stats.registered > 0 ? (stats.checked_in / stats.registered) * 100 : 0;
  const capacityFillRate = stats.capacity > 0 ? (stats.registered / stats.capacity) * 100 : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Metric 1: Capacity & Registrations */}
      <div className="glass-card-interactive rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between group">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 font-semibold tracking-wide">Total Registered</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
            {stats.registered}
            <span className="text-sm font-normal text-slate-400 ml-1">/ {stats.capacity}</span>
          </div>
        </div>

        <div className="space-y-1.5 mt-4">
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/[0.05]">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-400 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, capacityFillRate)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>{Math.round(capacityFillRate)}% capacity</span>
            <span className="text-blue-400 font-bold">{stats.spots_left} left</span>
          </div>
        </div>
      </div>

      {/* Metric 2: Checked In Count & Rate */}
      <div className="glass-card-interactive rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between group">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 font-semibold tracking-wide">Verified Check-Ins</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
            {stats.checked_in}
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 ml-2">
              {stats.checked_in_pct}%
            </span>
          </div>
        </div>

        <div className="space-y-1.5 mt-4">
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/[0.05]">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, checkInRate)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Actual Turnout</span>
            <span className="text-emerald-400 font-bold">{stats.checked_in} inside</span>
          </div>
        </div>
      </div>

      {/* Metric 3: No-Show Rate */}
      <div className="glass-card-interactive rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between group">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 font-semibold tracking-wide">Pending (No-Shows)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono tracking-tight">
            {stats.no_shows}
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 ml-2">
              {stats.no_show_pct}%
            </span>
          </div>
        </div>

        <div className="space-y-1.5 mt-4">
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/[0.05]">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, stats.no_show_pct)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Awaiting Arrival</span>
            <span className="text-amber-400 font-bold">{stats.no_shows} outstanding</span>
          </div>
        </div>
      </div>

      {/* Metric 4: Peak Check-in Velocity */}
      <div className="glass-card-interactive rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between group">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 font-semibold tracking-wide">Peak Surge (5-Min)</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-rose-400 font-mono tracking-tight">
            {stats.peak_window_count}
            <span className="text-sm font-normal text-slate-400 ml-1.5">scans/5m</span>
          </div>
        </div>

        <div className="mt-4 bg-slate-950/60 p-2.5 rounded-2xl border border-white/[0.05]">
          <div className="text-[11px] font-mono text-slate-400 truncate flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>
              {stats.peak_window_start
                ? `Peak at ${new Date(stats.peak_window_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Awaiting door rush'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
