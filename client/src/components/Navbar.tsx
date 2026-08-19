import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, QrCode, LayoutDashboard, Ticket, LogOut, Wifi, WifiOff, RefreshCw, Sparkles, User as UserIcon } from 'lucide-react';
import { getPendingScans, syncOfflineScans } from '../services/offlineQueue';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      handleAutoSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const updatePending = async () => {
      const pending = await getPendingScans();
      setPendingCount(pending.length);
    };

    updatePending();
    const interval = setInterval(updatePending, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleAutoSync = async () => {
    setSyncing(true);
    try {
      await syncOfflineScans();
      const pending = await getPendingScans();
      setPendingCount(pending.length);
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <header className="sticky top-0 z-50 bg-[#07090E]/80 backdrop-blur-xl border-b border-white/[0.08] shadow-2xl shadow-black/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Branding */}
          <div className="flex items-center gap-4">
            <Link to="/events" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all duration-300">
                <div className="w-full h-full bg-[#0B0F19] rounded-[10px] flex items-center justify-center text-blue-400 group-hover:text-white transition-colors">
                  <Shield className="w-5 h-5" />
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-base font-black tracking-tight text-white">
                    CHECK<span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">POINT</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
                    STAGE 2
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  Concurrency-Safe Event Engine
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/60 p-1 rounded-xl border border-white/[0.06]">
            <Link
              to="/events"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                location.pathname === '/events'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
              }`}
            >
              Events
            </Link>

            {user.role === 'attendee' && (
              <Link
                to="/my-tickets"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  location.pathname === '/my-tickets'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>My Tickets</span>
              </Link>
            )}

            {user.role === 'organizer' && (
              <Link
                to="/scanner"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  location.pathname.startsWith('/scanner')
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Door Scanner</span>
              </Link>
            )}
          </nav>

          {/* System Indicators & User Profile */}
          <div className="flex items-center gap-3">
            {/* Offline/Online Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                isOnline
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                  : 'bg-amber-950/40 text-amber-400 border-amber-500/30 animate-pulse'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="hidden sm:inline font-medium">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </div>

            {/* Offline Queue Sync Pill */}
            {pendingCount > 0 && (
              <button
                onClick={handleAutoSync}
                disabled={syncing || !isOnline}
                title="Pending offline scans ready to sync"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors shadow-sm shadow-amber-500/20"
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                <span>{pendingCount} queued</span>
              </button>
            )}

            {/* User Profile Badge & Signout */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 border border-white/10 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                  {initials}
                </div>
                <div className="text-left hidden lg:block">
                  <div className="text-xs font-bold text-slate-200 leading-tight truncate max-w-[120px]">{user.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                    {user.role}
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
