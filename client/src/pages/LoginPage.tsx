import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { UserRole } from '../types';
import { Shield, Lock, Mail, User as UserIcon, ArrowRight, Zap, CheckCircle2, Eye, EyeOff, Layers, Cpu, Database } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignup) {
        const res = await api.post('/api/auth/signup', {
          name,
          email,
          password,
        });
        login(res.token, res.user);
      } else {
        const res = await api.post('/api/auth/login', {
          email,
          password,
        });
        login(res.token, res.user);
      }
      navigate('/events');
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (demoRole: UserRole) => {
    const demoEmail = demoRole === 'organizer' ? 'organizer@checkpoint.io' : 'attendee@checkpoint.io';
    const demoPass = 'password123';
    setEmail(demoEmail);
    setPassword(demoPass);
    setIsSignup(false);
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/api/auth/login', {
        email: demoEmail,
        password: demoPass,
      });
      login(res.token, res.user);
      navigate('/events');
    } catch {
      try {
        if (demoRole === 'organizer') {
          const res = await api.post('/api/auth/provision-organizer', {
            name: 'Alex Carter (Lead Organizer)',
            email: demoEmail,
            password: demoPass,
            organizer_key: 'checkpoint_org_key_2026',
          });
          login(res.token, res.user);
        } else {
          const res = await api.post('/api/auth/signup', {
            name: 'Jane Doe (Attendee)',
            email: demoEmail,
            password: demoPass,
          });
          login(res.token, res.user);
        }
        navigate('/events');
      } catch (err2: any) {
        setError(err2?.data?.error || err2?.message || 'Demo login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Feature Highlights & Architecture Pillars */}
        <div className="lg:col-span-6 space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-medium mb-3">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span>STAGE 2 HIGH-CONCURRENCY SUITE</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Zero-Overcapacity <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
                Event Check-In Engine
              </span>
            </h1>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Industrial check-in architecture featuring atomic row-locking concurrency, offline-first IndexedDB reconciliation, and dynamic cryptographic rotating HMAC tokens.
            </p>
          </div>

          {/* Architecture Pillars List */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/50 border border-white/[0.05] backdrop-blur-md hover:border-blue-500/30 transition-all">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">PostgreSQL Transaction Row Locks</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Conditional atomic updates lock capacity at DB engine level across multi-server horizontal clusters.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/50 border border-white/[0.05] backdrop-blur-md hover:border-emerald-500/30 transition-all">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Dynamic 30s HMAC-SHA256 QR</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Screenshots expire within 30 seconds. One-time consumed status prevents duplicate redemption.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/50 border border-white/[0.05] backdrop-blur-md hover:border-indigo-500/30 transition-all">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Offline-First Batch Reconciler</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  IndexedDB local queue with idempotent sync and automatic multi-station collision detection.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Login/Signup Card */}
        <div className="lg:col-span-6">
          <div className="w-full bg-[#0B0F19]/90 rounded-3xl border border-white/[0.08] p-6 sm:p-8 glow-blue relative overflow-hidden backdrop-blur-2xl shadow-2xl shadow-black/80">
            {/* Logo & Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {isSignup ? 'Create Account' : 'Welcome Back'}
                </h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  {isSignup ? 'Attendee registration' : 'Sign in to access events'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Shield className="w-5 h-5" />
              </div>
            </div>

            {/* Auth Mode Toggle Tabs */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-white/[0.06] mb-6">
              <button
                type="button"
                onClick={() => {
                  setIsSignup(false);
                  setError(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  !isSignup
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignup(true);
                  setError(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  isSignup
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5">Full Name</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="organizer@checkpoint.io"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 mt-2 cursor-pointer active:scale-[0.99]"
              >
                <span>{loading ? 'Processing...' : isSignup ? 'Create Attendee Account' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* 1-Click Demo Buttons for Fast Evaluation */}
            <div className="mt-6 pt-5 border-t border-white/[0.06]">
              <div className="text-[11px] font-mono text-slate-400 text-center mb-2.5 flex items-center justify-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Instant 1-Click Evaluator Access</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleQuickDemo('organizer')}
                  disabled={loading}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-blue-500/30 hover:border-blue-500/60 text-xs font-mono text-blue-400 transition-all flex flex-col items-center justify-center gap-0.5 group cursor-pointer shadow-sm hover:shadow-blue-500/10"
                >
                  <span className="font-bold flex items-center gap-1">
                    <span>👑</span> Lead Organizer
                  </span>
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-400">Scan & Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('attendee')}
                  disabled={loading}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-emerald-500/30 hover:border-emerald-500/60 text-xs font-mono text-emerald-400 transition-all flex flex-col items-center justify-center gap-0.5 group cursor-pointer shadow-sm hover:shadow-emerald-500/10"
                >
                  <span className="font-bold flex items-center gap-1">
                    <span>🎫</span> Attendee
                  </span>
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-400">Tickets & 30s QR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
