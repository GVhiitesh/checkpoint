import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { RegistrationItem } from '../types';
import { QRGenerator } from '../components/QRGenerator';
import { Ticket, Calendar, CheckCircle2, QrCode, Shield, Sparkles, MapPin, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const MyTicketsPage: React.FC = () => {
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReg, setSelectedReg] = useState<RegistrationItem | null>(null);

  const fetchMyTickets = async () => {
    try {
      setLoading(true);
      const res = await api.get<RegistrationItem[]>('/api/registrations/mine');
      setRegistrations(res);
      if (res.length > 0 && !selectedReg) {
        setSelectedReg(res[0]);
      }
    } catch (err) {
      console.error('Failed to load tickets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTickets();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium mb-2">
            <Ticket className="w-3.5 h-3.5 text-emerald-400" />
            <span>CRYPTOGRAPHIC EVENT PASSES</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            My Registered Tickets & Access Passes
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Display your rotating HMAC-SHA256 QR code at the door station for instant check-in.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 h-80 rounded-3xl bg-slate-900/40 border border-white/[0.06] animate-pulse" />
          <div className="lg:col-span-7 h-96 rounded-3xl bg-slate-900/40 border border-white/[0.06] animate-pulse" />
        </div>
      ) : registrations.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-white/[0.06] backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-4">
            <Ticket className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No Active Tickets Found</h3>
          <p className="text-xs text-slate-400 font-mono mb-6 max-w-sm mx-auto">
            You haven't claimed tickets for any events yet. Explore open events to reserve your seat!
          </p>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-blue-600/30 hover:from-blue-500 hover:to-indigo-500 transition-all"
          >
            <span>Browse Events</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Tickets Selector List */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Your Tickets ({registrations.length})
              </span>
              <span className="text-[11px] font-mono text-blue-400">Click to preview</span>
            </div>

            {registrations.map((reg) => {
              const isSelected = selectedReg?.id === reg.id;
              const isCheckedIn = !!reg.checked_in_at;

              return (
                <button
                  key={reg.id}
                  onClick={() => setSelectedReg(reg)}
                  className={`w-full text-left p-4 rounded-3xl border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-900/40 via-slate-900/80 to-slate-900/80 border-blue-500/60 text-white shadow-xl shadow-blue-500/10'
                      : 'bg-slate-900/40 border-white/[0.06] text-slate-300 hover:bg-slate-900/70 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-bold text-white group-hover:text-blue-400 truncate">
                      {reg.event_name}
                    </span>
                    {isCheckedIn ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold shrink-0">
                        VERIFIED IN
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-mono font-bold shrink-0">
                        READY TO SCAN
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>{new Date(reg.event_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span>•</span>
                    <span>{new Date(reg.event_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: High-End Wallet Pass Display */}
          <div className="lg:col-span-7 flex flex-col items-center">
            {selectedReg && (
              <div className="w-full max-w-md bg-gradient-to-b from-slate-900/90 to-[#0B0F19] rounded-3xl border border-white/[0.1] p-6 sm:p-8 shadow-2xl shadow-black/80 glow-blue relative overflow-hidden backdrop-blur-2xl">
                {/* Top Notch Brand Header */}
                <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white tracking-wider">CHECKPOINT PASS</div>
                      <div className="text-[10px] font-mono text-slate-400">OFFICIAL ADMISSION</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-950 border border-white/[0.08] text-slate-300">
                      GEN-1 PASS
                    </span>
                  </div>
                </div>

                {/* Event Info Header */}
                <div className="text-center mb-6">
                  <h2 className="text-xl font-extrabold text-white tracking-tight mb-2">
                    {selectedReg.event_name}
                  </h2>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 border border-white/[0.08] text-xs font-mono text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>{new Date(selectedReg.event_date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                </div>

                {/* Perforated Divider */}
                <div className="relative my-4 flex items-center justify-center">
                  <div className="w-full border-t border-dashed border-white/20" />
                </div>

                {/* Dynamic Rotating QR Code Component */}
                <div className="my-4 flex justify-center">
                  <QRGenerator
                    registrationId={selectedReg.id}
                    eventName={selectedReg.event_name}
                  />
                </div>

                {/* Pass Ticket Footer / Pass Details */}
                <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Pass ID: {selectedReg.id.slice(0, 8)}...</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Concurrency-Protected
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
