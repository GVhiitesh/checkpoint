import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { EventItem } from '../types';
import { Plus, Calendar, Users, QrCode, LayoutDashboard, Ticket, Check, AlertCircle, Sparkles, Search, Filter, Clock, ArrowUpRight, Zap, X } from 'lucide-react';

export const EventsListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'available' | 'full'>('all');

  // Organizer Create Event State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventCapacity, setNewEventCapacity] = useState(50);
  const [creating, setCreating] = useState(false);

  // Attendee Registration State
  const [registeringEventId, setRegisteringEventId] = useState<string | null>(null);
  const [regFeedback, setRegFeedback] = useState<{ [eventId: string]: { type: 'success' | 'error'; message: string } }>({});

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await api.get<EventItem[]>('/api/events');
      setEvents(res);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim() || !newEventDate) return;

    setCreating(true);
    try {
      await api.post('/api/events', {
        name: newEventName.trim(),
        event_date: new Date(newEventDate).toISOString(),
        capacity: Number(newEventCapacity),
      });
      setShowCreateModal(false);
      setNewEventName('');
      setNewEventDate('');
      setNewEventCapacity(50);
      fetchEvents();
    } catch (err: any) {
      alert(err?.data?.error || err?.message || 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  const handleRegister = async (eventId: string) => {
    setRegisteringEventId(eventId);
    try {
      await api.post(`/api/events/${eventId}/register`);
      setRegFeedback((prev) => ({
        ...prev,
        [eventId]: { type: 'success', message: 'Registered! Ticket available in My Tickets' },
      }));
      fetchEvents();
    } catch (err: any) {
      const msg =
        err?.data?.error === 'capacity_full'
          ? 'Event is at Maximum Capacity!'
          : err?.data?.error === 'already_registered'
          ? 'You are already registered for this event.'
          : err?.message || 'Registration failed';

      setRegFeedback((prev) => ({
        ...prev,
        [eventId]: { type: 'error', message: msg },
      }));
    } finally {
      setRegisteringEventId(null);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchesSearch = ev.name.toLowerCase().includes(searchQuery.toLowerCase());
      const isFull = ev.registered_count >= ev.capacity;
      if (filterType === 'available') return matchesSearch && !isFull;
      if (filterType === 'full') return matchesSearch && isFull;
      return matchesSearch;
    });
  }, [events, searchQuery, filterType]);

  const totalRegistered = useMemo(() => events.reduce((sum, e) => sum + e.registered_count, 0), [events]);
  const totalCapacity = useMemo(() => events.reduce((sum, e) => sum + e.capacity, 0), [events]);

  const getRelativeDate = (dateString: string) => {
    const diff = new Date(dateString).getTime() - Date.now();
    const days = Math.round(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days > 1) return `In ${days} days`;
    if (days === -1) return 'Yesterday';
    return `${Math.abs(days)} days ago`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner Overview */}
      <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-blue-950/40 border border-white/[0.08] backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-medium">
              <Zap className="w-3.5 h-3.5" />
              <span>{user?.role === 'organizer' ? 'ORGANIZER CONTROL CENTER' : 'ATTENDEE EVENT HUB'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {user?.role === 'organizer' ? 'Managed Events & Door Operations' : 'Discover & Register for Events'}
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              {user?.role === 'organizer'
                ? 'Monitor live check-in telemetry, manage dynamic 30s rotating HMAC security tokens, and oversee door stations.'
                : 'Claim tickets with guaranteed zero-overcapacity safety and access your live-rotating QR passes.'}
            </p>
          </div>

          {/* Quick Stats Pill Counters */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="px-4 py-3 rounded-2xl bg-slate-950/60 border border-white/[0.08] text-center">
              <div className="text-xs font-mono text-slate-400">Total Events</div>
              <div className="text-xl font-bold text-white font-mono mt-0.5">{events.length}</div>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-slate-950/60 border border-white/[0.08] text-center">
              <div className="text-xs font-mono text-slate-400">Total Registered</div>
              <div className="text-xl font-bold text-blue-400 font-mono mt-0.5">{totalRegistered}</div>
            </div>
            {user?.role === 'organizer' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 cursor-pointer active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create Event</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/60 border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-white/[0.06] w-full sm:w-auto justify-center">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({events.length})
          </button>
          <button
            onClick={() => setFilterType('available')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === 'available'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Available
          </button>
          <button
            onClick={() => setFilterType('full')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === 'full'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Full
          </button>
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 rounded-3xl bg-slate-900/40 border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 rounded-3xl border border-white/[0.06] backdrop-blur-md">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No matching events found</h3>
          <p className="text-xs text-slate-500 font-mono mt-1">
            {searchQuery ? 'Try clearing your search query.' : user?.role === 'organizer' ? 'Click "Create Event" to get started.' : 'Check back soon for new events.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => {
            const isFull = event.registered_count >= event.capacity;
            const spotsRemaining = Math.max(0, event.capacity - event.registered_count);
            const feedback = regFeedback[event.id];
            const pct = Math.min(100, Math.round((event.registered_count / event.capacity) * 100));

            return (
              <div
                key={event.id}
                className="glass-card-interactive rounded-3xl p-6 flex flex-col justify-between group relative overflow-hidden"
              >
                <div>
                  {/* Top Status & Date Pill */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-950/70 border border-white/[0.08] text-slate-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-400" />
                      <span>{getRelativeDate(event.event_date)}</span>
                    </span>
                    <span
                      className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                        isFull
                          ? 'bg-rose-950/50 text-rose-300 border-rose-500/30'
                          : spotsRemaining <= 5
                          ? 'bg-amber-950/50 text-amber-300 border-amber-500/30 animate-pulse'
                          : 'bg-emerald-950/50 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {isFull ? 'CAPACITY REACHED' : `${spotsRemaining} SPOTS LEFT`}
                    </span>
                  </div>

                  {/* Event Title */}
                  <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2 mb-2">
                    {event.name}
                  </h3>

                  {/* Date & Time */}
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-6">
                    <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>{new Date(event.event_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span>•</span>
                    <span>{new Date(event.event_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {/* Capacity Progress Bar */}
                  <div className="space-y-2 mb-6 bg-slate-950/60 p-3.5 rounded-2xl border border-white/[0.05]">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Attendance Fill:</span>
                      <span className="text-white font-bold">
                        {event.registered_count} <span className="text-slate-500">/ {event.capacity}</span> ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/[0.04]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFull
                            ? 'bg-gradient-to-r from-rose-600 to-rose-400'
                            : pct > 80
                            ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                            : 'bg-gradient-to-r from-blue-600 to-emerald-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions & Feedback */}
                <div>
                  {feedback && (
                    <div
                      className={`p-3 rounded-xl mb-3 text-xs font-mono flex items-center gap-2 ${
                        feedback.type === 'success'
                          ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-950/50 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {feedback.type === 'success' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <span>{feedback.message}</span>
                    </div>
                  )}

                  {user?.role === 'organizer' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        to={`/dashboard/${event.id}`}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-95"
                      >
                        <LayoutDashboard className="w-3.5 h-3.5" />
                        <span>Dashboard</span>
                      </Link>
                      <Link
                        to={`/scanner?eventId=${event.id}`}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-white/[0.08] hover:border-blue-500/30 text-slate-200 text-xs font-semibold transition-all active:scale-95"
                      >
                        <QrCode className="w-3.5 h-3.5 text-blue-400" />
                        <span>Scanner</span>
                      </Link>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRegister(event.id)}
                      disabled={isFull || registeringEventId === event.id}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-slate-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>{isFull ? 'Maximum Capacity Reached' : registeringEventId === event.id ? 'Claiming Seat...' : 'Claim Free Pass'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-[#0B0F19] rounded-3xl border border-white/[0.08] p-6 sm:p-8 glow-blue relative shadow-2xl">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/[0.06]">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>Create New Event</span>
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5">Event Name</label>
                <input
                  type="text"
                  required
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  placeholder="e.g. NextGen AI Summit 2026"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/[0.08] text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5">Event Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/[0.08] text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* Manual Unlimited Capacity Typing Space */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono text-slate-300">
                    Total Seat Capacity <span className="text-blue-400 font-bold">*</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    Enter any quantity
                  </span>
                </div>
                <div className="relative">
                  <Users className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="number"
                    min="1"
                    required
                    value={newEventCapacity || ''}
                    onChange={(e) => setNewEventCapacity(Math.max(1, parseInt(e.target.value, 10) || 0))}
                    placeholder="e.g. 1500"
                    className="w-full pl-10 pr-16 py-2.5 rounded-xl bg-slate-950/90 border border-white/[0.08] text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                  />
                  <div className="absolute right-3.5 top-2.5 text-xs font-mono text-slate-400 font-medium pointer-events-none">
                    Seats
                  </div>
                </div>

                {/* Quick Increment Presets */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-mono text-slate-500 mr-1">Quick Add:</span>
                  {[50, 250, 1000, 5000].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setNewEventCapacity((prev) => (Number(prev) || 0) + amount)}
                      className="px-2 py-1 rounded-lg bg-slate-900/80 hover:bg-blue-600/20 border border-white/[0.06] hover:border-blue-500/30 text-[10px] font-mono text-slate-300 hover:text-blue-400 transition-all cursor-pointer"
                    >
                      +{amount.toLocaleString()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewEventCapacity(50)}
                    className="px-2 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-white/[0.06] text-[10px] font-mono text-slate-400 hover:text-slate-200 transition-all cursor-pointer ml-auto"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-all border border-white/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Launch Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
