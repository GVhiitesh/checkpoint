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

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@vitstudent.ac.in')) {
      setError('Access restricted: Only official VIT student emails (@vitstudent.ac.in) are authorized.');
      setLoading(false);
      return;
    }

    try {
      if (isSignup) {
        const res = await api.post('/api/auth/signup', {
          name,
          email: cleanEmail,
          password,
        });
        login(res.token, res.user);
      } else {
        const res = await api.post('/api/auth/login', {
          email: cleanEmail,
          password,
        });
        login(res.token, res.user);
      }
      navigate('/events');
    } catch (err: any) {
      setError(err?.data?.message || err?.data?.error || err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (demoRole: UserRole) => {
    const demoEmail = demoRole === 'organizer' ? 'organizer@vitstudent.ac.in' : 'attendee@vitstudent.ac.in';
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
        setError(err2?.data?.message || err2?.data?.error || err2?.message || 'Demo login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Floating Background Ambient Glow Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-[280px] w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none animate-float-slow" />
      <div className="absolute bottom-1/4 right-1/2 translate-x-[260px] w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-float-reverse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse-glow" />

      {/* Centered Floating Card Container */}
      <div className="w-full max-w-md relative z-10 animate-float-slow">
        {/* Floating Top Badge */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-blue-500/30 text-blue-400 text-xs font-mono font-medium shadow-lg shadow-blue-500/10 backdrop-blur-md">
            <Zap className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>VIT CAMPUS EVENT ACCESS</span>
          </div>
        </div>

        {/* Floating Glassmorphic Login Card */}
        <div className="w-full bg-[#0B0F19]/85 rounded-3xl border border-white/[0.1] p-6 sm:p-8 relative overflow-hidden backdrop-blur-2xl shadow-2xl shadow-black/90 hover:border-blue-500/30 transition-all duration-500 group">
          {/* Subtle Top Gradient Bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400" />

          {/* Logo & Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.06]">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {isSignup ? 'Student Signup' : 'Student & Staff Login'}
              </h2>
              <p className="text-xs font-mono text-slate-400 mt-1 flex items-center gap-1">
                <span>Domain:</span>
                <span className="text-blue-400 font-bold">@vitstudent.ac.in</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
          </div>

          {/* Auth Mode Toggle Tabs */}
          <div className="flex bg-slate-950/90 p-1 rounded-2xl border border-white/[0.06] mb-6">
            <button
              type="button"
              onClick={() => {
                setIsSignup(false);
                setError(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                !isSignup
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40'
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
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                isSignup
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2.5 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Main Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-950/90 border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-mono text-slate-300">VIT Email Address</label>
                <span className="text-[10px] font-mono text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  @vitstudent.ac.in only
                </span>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.name2026@vitstudent.ac.in"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-950/90 border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-2xl bg-slate-950/90 border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 transition-all disabled:opacity-50 mt-3 cursor-pointer active:scale-[0.99] hover:shadow-blue-500/50"
            >
              <span>{loading ? 'Processing...' : isSignup ? 'Create VIT Student Pass' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* 1-Click Demo Buttons for Fast Evaluation */}
          <div className="mt-6 pt-5 border-t border-white/[0.06]">
            <div className="text-[11px] font-mono text-slate-400 text-center mb-3 flex items-center justify-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Instant Evaluator Access (@vitstudent.ac.in)</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickDemo('organizer')}
                disabled={loading}
                className="px-3.5 py-3 rounded-2xl bg-slate-950/90 hover:bg-slate-900 border border-blue-500/30 hover:border-blue-500/70 text-xs font-mono text-blue-400 transition-all flex flex-col items-center justify-center gap-0.5 group cursor-pointer shadow-sm hover:shadow-blue-500/20 active:scale-95"
              >
                <span className="font-extrabold flex items-center gap-1">
                  <span>👑</span> Lead Organizer
                </span>
                <span className="text-[10px] text-slate-500 group-hover:text-slate-400">Scan & Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('attendee')}
                disabled={loading}
                className="px-3.5 py-3 rounded-2xl bg-slate-950/90 hover:bg-slate-900 border border-emerald-500/30 hover:border-emerald-500/70 text-xs font-mono text-emerald-400 transition-all flex flex-col items-center justify-center gap-0.5 group cursor-pointer shadow-sm hover:shadow-emerald-500/20 active:scale-95"
              >
                <span className="font-extrabold flex items-center gap-1">
                  <span>🎫</span> VIT Attendee
                </span>
                <span className="text-[10px] text-slate-500 group-hover:text-slate-400">Pass & 30s Token</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
