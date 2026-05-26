'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/lib/animations';
import { useLoginMutation } from '@/services/authApi';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/slices/authSlice';

const features = [
  { label: 'Email Intake',           desc: 'Auto booking ingestion from email',        icon: '📩' },
  { label: 'Agent Analysis',          desc: 'Smart cargo analysis & classification',     icon: '🔍' },
  { label: 'Round Robin Allocation',  desc: 'Fair and automatic agent assignment',       icon: '🔄' },
  { label: 'Transport Submission',    desc: 'One-click submission to transport API',     icon: '🚚' },
  { label: 'Real-time Notifications', desc: 'Instant alerts on booking updates',         icon: '🔔' },
];

export default function LoginPage() {
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const [email,    setEmail]    = useState('admin@bts.com');
  const [password, setPassword] = useState('Admin@123');
  const [focused,  setFocused]  = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [login, { isLoading }]  = useLoginMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const tokens = await login({ email, password }).unwrap();
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const user = await res.json();
      dispatch(setCredentials({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, user }));
      router.push('/dashboard');
    } catch {
      setErrorMsg('Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full flex"
      >

        {/* ── LEFT: white branding panel ── */}
        <motion.div
          initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="flex-1 bg-white px-16 py-10 flex flex-col justify-between"
        >
          {/* Logo */}
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ rotate: 12, scale: 1.1 }} transition={{ type: 'spring', stiffness: 400 }}
              className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <line x1="12" y1="11" x2="12" y2="4" strokeWidth="2" strokeLinecap="round" stroke="currentColor" />
                <line x1="12" y1="11" x2="4.5" y2="18.5" strokeWidth="2" strokeLinecap="round" stroke="currentColor" />
                <line x1="12" y1="11" x2="19.5" y2="18.5" strokeWidth="2" strokeLinecap="round" stroke="currentColor" />
                <circle cx="12" cy="3.5" r="1.8" fill="currentColor" stroke="none" />
                <circle cx="4" cy="19.5" r="1.8" fill="currentColor" stroke="none" />
                <circle cx="20" cy="19.5" r="1.8" fill="currentColor" stroke="none" />
                <circle cx="12" cy="11" r="2.2" fill="currentColor" stroke="none" opacity="0.45" />
              </svg>
            </motion.div>
            <div>
              <p className="font-bold text-gray-900 text-base leading-tight">Nexus</p>
              <p className="text-xs text-gray-400 font-medium">BookOps AI</p>
            </div>
          </div>

          {/* Illustration + headline */}
          <div className="flex flex-col items-center text-center py-4">
            {/* Abstract network SVG illustration */}
            <div className="relative w-52 h-52 mb-6">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border border-dashed border-indigo-100" />
              <motion.div animate={{ rotate: -360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-6 rounded-full border border-dashed border-violet-100" />
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none">
                {/* Connecting lines */}
                <line x1="100" y1="100" x2="40"  y2="40"  stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.3" />
                <line x1="100" y1="100" x2="160" y2="40"  stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.3" />
                <line x1="100" y1="100" x2="160" y2="160" stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.3" />
                <line x1="100" y1="100" x2="40"  y2="160" stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.3" />
                <line x1="100" y1="100" x2="100" y2="20"  stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.3" />
                <line x1="100" y1="100" x2="180" y2="100" stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.3" />
                <line x1="100" y1="100" x2="100" y2="180" stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.3" />
                <line x1="100" y1="100" x2="20"  y2="100" stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.3" />
                {/* Outer nodes */}
                <circle cx="40"  cy="40"  r="7" fill="#6366f1" opacity="0.7" />
                <circle cx="160" cy="40"  r="5" fill="#8b5cf6" opacity="0.6" />
                <circle cx="160" cy="160" r="7" fill="#6366f1" opacity="0.7" />
                <circle cx="40"  cy="160" r="5" fill="#8b5cf6" opacity="0.6" />
                <circle cx="100" cy="20"  r="5" fill="#a78bfa" opacity="0.5" />
                <circle cx="180" cy="100" r="5" fill="#a78bfa" opacity="0.5" />
                <circle cx="100" cy="180" r="5" fill="#a78bfa" opacity="0.5" />
                <circle cx="20"  cy="100" r="5" fill="#a78bfa" opacity="0.5" />
                {/* Center hub */}
                <circle cx="100" cy="100" r="20" fill="url(#hubGrad)" />
                <circle cx="100" cy="100" r="14" fill="white" opacity="0.9" />
                <defs>
                  <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </radialGradient>
                </defs>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Intelligent Booking Ops</h2>
            <p className="text-sm text-gray-500 max-w-xs">Automate, allocate and track every booking with AI-powered precision.</p>
          </div>

          {/* Features */}
          <motion.ul variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2.5">
            {features.map(f => (
              <motion.li key={f.label} variants={staggerItem}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-indigo-50/60 transition-colors group">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-sm shrink-0">{f.icon}</div>
                <div>
                  <p className="text-xs font-bold text-gray-700 leading-tight">{f.label}</p>
                  <p className="text-[10.5px] text-gray-400 leading-tight">{f.desc}</p>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        {/* ── RIGHT: colored form panel ── */}
        <motion.div
          initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="w-[42%] shrink-0 bg-gradient-to-b from-indigo-600 via-indigo-700 to-violet-800 px-16 py-10 flex flex-col justify-center relative overflow-hidden"
        >
          {/* Decorative circles */}
          <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.12, 0.2, 0.12] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-16 -right-16 w-52 h-52 bg-white rounded-full pointer-events-none" />
          <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.07, 0.13, 0.07] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute -bottom-20 -left-12 w-60 h-60 bg-violet-300 rounded-full pointer-events-none" />

          <div className="relative z-10">
            <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-white mb-1">Welcome back 👋</motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              className="text-indigo-200/80 text-sm mb-8">Enter your credentials to continue</motion.p>

            <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="space-y-4" onSubmit={handleSubmit}>

              <div>
                <label className="block text-xs font-bold text-indigo-200 mb-1.5 uppercase tracking-wide">Email</label>
                <motion.input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                  placeholder="Enter your email" required
                  animate={{ boxShadow: focused === 'email' ? '0 0 0 3px rgba(255,255,255,0.25)' : '0 0 0 0px transparent' }}
                  className="w-full px-4 py-3 bg-white/15 border border-white/20 rounded-xl text-sm text-white placeholder:text-indigo-300/60 focus:outline-none focus:bg-white/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-indigo-200 mb-1.5 uppercase tracking-wide">Password</label>
                <motion.input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                  placeholder="Enter your password" required
                  animate={{ boxShadow: focused === 'password' ? '0 0 0 3px rgba(255,255,255,0.25)' : '0 0 0 0px transparent' }}
                  className="w-full px-4 py-3 bg-white/15 border border-white/20 rounded-xl text-sm text-white placeholder:text-indigo-300/60 focus:outline-none focus:bg-white/20 transition-all"
                />
              </div>

              {errorMsg && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-semibold text-red-200 bg-red-500/20 border border-red-400/30 px-3 py-2 rounded-lg">
                  {errorMsg}
                </motion.p>
              )}

              <motion.button
                type="submit" disabled={isLoading}
                whileHover={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
                whileTap={{ scale: 0.975 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="w-full mt-2 bg-white text-indigo-700 text-sm font-bold py-3.5 rounded-xl shadow-lg cursor-pointer transition-all disabled:opacity-60"
              >
                {isLoading ? 'Signing in…' : 'Sign in →'}
              </motion.button>
            </motion.form>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
              className="text-indigo-300/50 text-[11px] mt-8 text-center">© 2026 Nexus. All rights reserved.</motion.p>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
