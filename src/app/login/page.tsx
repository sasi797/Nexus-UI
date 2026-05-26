'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, fadeUp } from '@/lib/animations';
import { useLoginMutation } from '@/services/authApi';
import { useMeQuery } from '@/services/authApi';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/slices/authSlice';

const features = [
  { label: 'Email Intake', desc: 'Auto booking ingestion from email', icon: '📩' },
  { label: 'Agent Analysis', desc: 'Smart cargo analysis & classification', icon: '🔍' },
  { label: 'Round Robin Allocation', desc: 'Fair and automatic agent assignment', icon: '🔄' },
  { label: 'Transport Submission', desc: 'One-click submission to transport API', icon: '🚚' },
  { label: 'Real-time Notifications', desc: 'Instant alerts on booking updates', icon: '🔔' },
];

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState('admin@bts.com');
  const [password, setPassword] = useState('Admin@123');
  const [focused, setFocused] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [login, { isLoading }] = useLoginMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const tokens = await login({ email, password }).unwrap();
      // Fetch user profile with the new token
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const user = await res.json();
      dispatch(setCredentials({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        user,
      }));
      router.push('/dashboard');
    } catch {
      setErrorMsg('Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-4 overflow-hidden">
      <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-20 left-20 w-64 h-64 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />
      <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute bottom-20 right-20 w-80 h-80 bg-violet-200/30 rounded-full blur-3xl pointer-events-none" />

      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl shadow-indigo-100/50 overflow-hidden flex">
        {/* Left – Login Form */}
        <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="flex-1 p-10">
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="flex items-center gap-3 mb-8">
            <motion.div whileHover={{ rotate: 12, scale: 1.1 }} transition={{ type: 'spring', stiffness: 400 }}
              className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </motion.div>
            <div>
              <p className="font-bold text-gray-900 text-base leading-tight">Bookings to Ticket System</p>
              <p className="text-xs text-gray-400">Sign in to your account</p>
            </div>
          </motion.div>

          <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="text-2xl font-bold text-gray-900 mb-1">Welcome back 👋</motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="text-sm text-gray-500 mb-8">Enter your credentials to access your dashboard</motion.p>

          <motion.form variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5" onSubmit={handleSubmit}>
            <motion.div variants={staggerItem}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <motion.div animate={{ boxShadow: focused === 'email' ? '0 0 0 3px rgba(99,102,241,0.2)' : '0 0 0 0px transparent' }} className="rounded-xl overflow-hidden">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                  placeholder="Enter your email" required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all bg-gray-50/50" />
              </motion.div>
            </motion.div>

            <motion.div variants={staggerItem}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <motion.div animate={{ boxShadow: focused === 'password' ? '0 0 0 3px rgba(99,102,241,0.2)' : '0 0 0 0px transparent' }} className="rounded-xl overflow-hidden">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                  placeholder="Enter your password" required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all bg-gray-50/50" />
              </motion.div>
            </motion.div>

            {errorMsg && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-xs font-semibold text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                {errorMsg}
              </motion.p>
            )}

            <motion.div variants={staggerItem}>
              <motion.button type="submit" disabled={isLoading}
                whileHover={{ scale: 1.015, boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}
                whileTap={{ scale: 0.975 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold py-3.5 px-4 rounded-xl text-center cursor-pointer shadow-lg shadow-indigo-200 transition-all disabled:opacity-60">
                {isLoading ? 'Signing in…' : 'Sign in →'}
              </motion.button>
            </motion.div>
          </motion.form>
        </motion.div>

        {/* Right – Features */}
        <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="w-80 bg-gradient-to-b from-indigo-600 via-indigo-700 to-violet-800 p-10 flex flex-col justify-between relative overflow-hidden">
          <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-16 -right-16 w-48 h-48 bg-white rounded-full pointer-events-none" />
          <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.08, 0.15, 0.08] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute -bottom-20 -left-12 w-56 h-56 bg-violet-300 rounded-full pointer-events-none" />
          <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
            className="flex justify-center mb-6 relative z-10">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-28 h-28 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center ring-1 ring-white/20 shadow-2xl">
              <svg className="w-16 h-16 text-white opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </motion.div>
          </motion.div>
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="relative z-10">
            <motion.h3 variants={fadeUp} className="text-white font-bold text-sm mb-5 opacity-95 tracking-wide uppercase">Platform Features</motion.h3>
            <ul className="space-y-3.5">
              {features.map((f) => (
                <motion.li key={f.label} variants={staggerItem}>
                  <motion.div whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 400 }} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center text-sm shrink-0 mt-0.5">{f.icon}</div>
                    <div>
                      <p className="text-white text-sm font-semibold leading-tight">{f.label}</p>
                      <p className="text-indigo-200/80 text-xs mt-0.5">{f.desc}</p>
                    </div>
                  </motion.div>
                </motion.li>
              ))}
            </ul>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
            className="text-indigo-300/60 text-xs mt-6 relative z-10">© 2026 Nexus. All rights reserved.</motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}
