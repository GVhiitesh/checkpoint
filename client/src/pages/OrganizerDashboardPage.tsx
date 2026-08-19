import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { getSocket, watchEvent, unwatchEvent } from '../services/socket';
import { EventStats, CheckInFeedItem, ConflictItem, EventItem } from '../types';
import { StatsGrid } from '../components/StatsGrid';
import { LiveFeed } from '../components/LiveFeed';
import { AIInsightsModal } from '../components/AIInsightsModal';
import { Download, QrCode, ArrowLeft, RefreshCw, Radio, Sparkles, AlertTriangle, Shield, Activity, Users, Calendar } from 'lucide-react';

export const OrganizerDashboardPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [checkins, setCheckins] = useState<CheckInFeedItem[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchDashboardData = async () => {
    if (!eventId) return;
    try {
      const [evRes, statsRes, checkinsRes, conflictsRes] = await Promise.all([
        api.get<EventItem>(`/api/events/${eventId}`),
        api.get<EventStats>(`/api/events/${eventId}/stats`),
        api.get<CheckInFeedItem[]>(`/api/events/${eventId}/checkins`),
        api.get<ConflictItem[]>(`/api/events/${eventId}/conflicts`),
      ]);
      setEvent(evRes);
      setStats(statsRes);
      setCheckins(checkinsRes);
      setConflicts(conflictsRes);
    } catch (err) {
      console.error('Error loading dashboard telemetry', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [eventId]);

  // WebSocket Live Subscription & Fallback Polling
  useEffect(() => {
    if (!eventId) return;

    const socket = getSocket();

    if (socket) {
      setSocketConnected(socket.connected);

      const handleConnect = () => {
        setSocketConnected(true);
        watchEvent(eventId, (ack) => {
          if (!ack?.ok) console.warn('Failed to watch event room:', ack?.error);
        });
      };

      const handleDisconnect = () => setSocketConnected(false);

      const handleNewCheckin = (data: any) => {
        setCheckins((prev) => [data, ...prev]);
        // Re-fetch stats to update live counters
        api.get<EventStats>(`/api/events/${eventId}/stats`).then(setStats).catch(() => {});
      };

      const handleNewConflict = (data: any) => {
        setConflicts((prev) => [
          {
            id: `conf_${Date.now()}`,
            registration_id: data.registration_id,
            event_id: eventId,
            detail: `Conflict at Station ${data.station_id} (already scanned at ${data.existing_station})`,
            resolved: false,
            attendee_name: data.attendee_name,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('checkin:new', handleNewCheckin);
      socket.on('conflict:new', handleNewConflict);

      if (socket.connected) {
        handleConnect();
      }

      return () => {
        unwatchEvent(eventId);
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('checkin:new', handleNewCheckin);
        socket.off('conflict:new', handleNewConflict);
      };
    }
  }, [eventId]);

  // Fallback Polling: Poll every 5s if WebSocket is disconnected
  useEffect(() => {
    if (socketConnected || !eventId) return;

    const interval = setInterval(() => {
      api.get<EventStats>(`/api/events/${eventId}/stats`).then(setStats).catch(() => {});
      api.get<CheckInFeedItem[]>(`/api/events/${eventId}/checkins`).then(setCheckins).catch(() => {});
      api.get<ConflictItem[]>(`/api/events/${eventId}/conflicts`).then(setConflicts).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [socketConnected, eventId]);

  const handleExportCSV = async () => {
    if (!eventId) return;
    setExporting(true);
    try {
      const csvData = await api.get<string>(`/api/events/${eventId}/export.csv`);
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${event?.name || 'event'}_attendees.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  if (!eventId) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Dashboard Top Header */}
      <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-blue-950/40 border border-white/[0.08] backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Link
              to="/events"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Events</span>
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {event?.name || 'Event Command Center'}
              </h1>
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono border ${
                  socketConnected
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                    : 'bg-amber-950/60 text-amber-400 border-amber-500/40 animate-pulse'
                }`}
              >
                <Radio className={`w-3 h-3 ${socketConnected ? 'animate-pulse' : ''}`} />
                <span className="font-bold">{socketConnected ? 'LIVE WEBSOCKET STREAM' : 'FALLBACK POLLING (5s)'}</span>
              </div>
            </div>
            {event && (
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>{new Date(event.event_date).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}</span>
              </div>
            )}
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={fetchDashboardData}
              className="p-3 rounded-2xl bg-slate-900/80 border border-white/[0.08] text-slate-300 hover:text-white hover:border-white/20 transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Refresh Metrics"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] hover:border-white/20 text-slate-200 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <Download className="w-4 h-4 text-blue-400" />
              <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
            <Link
              to={`/scanner?eventId=${eventId}`}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 cursor-pointer active:scale-95"
            >
              <QrCode className="w-4 h-4" />
              <span>Launch Scanner</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <StatsGrid stats={stats} loading={loading} />

      {/* AI Copilot & Real-Time Stream Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Gemini AI Copilot */}
        <div>
          <AIInsightsModal eventId={eventId} />
        </div>

        {/* Right Column: Real-Time Live Check-Ins & Conflicts */}
        <div>
          <LiveFeed checkins={checkins} conflicts={conflicts} />
        </div>
      </div>
    </div>
  );
};
