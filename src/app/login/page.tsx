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

        {/* ── LEFT: branding panel ── */}
        <motion.div
          initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="flex-1 flex flex-col justify-between px-14 py-10 relative overflow-hidden"
          style={{ background: 'linear-gradient(145deg, #ffffff 0%, #ffffff 50%, #f3f0ff 100%)' }}
        >
          {/* Subtle blobs */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-100/40 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-100/40 rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/3" />

          {/* Logo */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="flex items-center gap-3 relative z-10">
            <motion.div whileHover={{ rotate: 12, scale: 1.1 }} transition={{ type: 'spring', stiffness: 400 }}
              className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <p className="font-bold text-gray-900 text-[15px] leading-tight">Nexus</p>
              <p className="text-[11px] text-gray-400 font-medium">BookOps AI</p>
            </div>
          </motion.div>

          {/* Hero brand block */}
          <div className="flex flex-col items-center text-center relative z-10">
            {/* Layered orb */}
            <div className="relative w-44 h-44 mb-7">
              <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 shadow-xl shadow-indigo-200/60" />
              <motion.div animate={{ scale: [1.06, 1, 1.06] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-5 rounded-full bg-gradient-to-br from-indigo-200 to-violet-200" />
              <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-400/40">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <line x1="12" y1="11" x2="12" y2="4" strokeWidth="1.8" strokeLinecap="round" stroke="currentColor" />
                  <line x1="12" y1="11" x2="4.5" y2="18.5" strokeWidth="1.8" strokeLinecap="round" stroke="currentColor" />
                  <line x1="12" y1="11" x2="19.5" y2="18.5" strokeWidth="1.8" strokeLinecap="round" stroke="currentColor" />
                  <circle cx="12" cy="3.5" r="1.6" fill="currentColor" stroke="none" />
                  <circle cx="4" cy="19.5" r="1.6" fill="currentColor" stroke="none" />
                  <circle cx="20" cy="19.5" r="1.6" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="11" r="2" fill="currentColor" stroke="none" opacity="0.4" />
                </svg>
              </motion.div>
            </div>

            <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-[26px] font-black text-gray-900 leading-tight mb-2">
              Power your{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                booking ops
              </span>
              <br />with AI
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              className="text-[13px] text-gray-500 max-w-[260px] leading-relaxed">
              From email intake to agent dispatch — fully automated and real-time.
            </motion.p>
          </div>

          {/* Features 2-column grid */}
          <div className="grid grid-cols-2 gap-2.5 relative z-10">
            {features.map((f, i) => (
              <motion.div key={f.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.07 }}
                className="flex items-start gap-2.5 bg-white/70 backdrop-blur-sm border border-white/80 rounded-xl px-3 py-2.5 shadow-sm hover:shadow-md hover:bg-white/90 transition-all cursor-default"
              >
                <span className="text-base mt-0.5 shrink-0">{f.icon}</span>
                <div>
                  <p className="text-[11.5px] font-bold text-gray-800 leading-tight">{f.label}</p>
                  <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
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
