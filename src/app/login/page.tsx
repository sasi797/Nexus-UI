'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useLoginMutation, useResetPasswordMutation } from '@/services/authApi';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/slices/authSlice';

type View = 'login' | 'reset';

const NexusLogo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <line x1="12" y1="11" x2="12"   y2="4"    strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="11" x2="4.5"  y2="18.5" strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="11" x2="19.5" y2="18.5" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="3.5"  r="1.8" fill="currentColor" stroke="none" />
    <circle cx="4"  cy="19.5" r="1.8" fill="currentColor" stroke="none" />
    <circle cx="20" cy="19.5" r="1.8" fill="currentColor" stroke="none" />
  </svg>
);

export default function LoginPage() {
  const router   = useRouter();
  const dispatch = useAppDispatch();

  const [view,          setView]          = useState<View>('login');
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [rememberMe,    setRememberMe]    = useState(false);
  const [showPassword,  setShowPassword]  = useState(false);
  const [newPass,       setNewPass]       = useState('');
  const [showNewPass,   setShowNewPass]   = useState(false);
  const [confirmPass,   setConfirmPass]   = useState('');
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [successMsg,    setSuccessMsg]    = useState('');

  const [login,         { isLoading: loggingIn }]  = useLoginMutation();
  const [resetPassword, { isLoading: resetting }]  = useResetPasswordMutation();

  // Remember me — load saved email on mount
  useEffect(() => {
    const saved = localStorage.getItem('bts_remember_email');
    if (saved) { setEmail(saved); setRememberMe(true); }
  }, []);

  const handleLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const tokens = await login({ email, password }).unwrap();
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const user = await res.json();
      dispatch(setCredentials({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, user }));
      if (rememberMe) {
        localStorage.setItem('bts_remember_email', email);
      } else {
        localStorage.removeItem('bts_remember_email');
      }
      router.push('/dashboard');
    } catch {
      setErrorMsg('Invalid email or password');
    }
  };

  const handleReset = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (newPass !== confirmPass) { setErrorMsg('Passwords do not match'); return; }
    if (newPass.length < 6)      { setErrorMsg('Password must be at least 6 characters'); return; }
    try {
      await resetPassword({ email, new_password: newPass, confirm_password: confirmPass }).unwrap();
      setSuccessMsg('Password reset successfully! You can now sign in.');
      setNewPass(''); setConfirmPass('');
      setTimeout(() => { setView('login'); setSuccessMsg(''); }, 2000);
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setErrorMsg(detail ?? 'Reset failed. Check your email and try again.');
    }
  };

  const switchView = (v: View) => {
    setErrorMsg(''); setSuccessMsg('');
    setNewPass(''); setConfirmPass('');
    setView(v);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 55%, #5b21b6 100%)' }}
    >
      {/* Dot grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="bg-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill="white" fillOpacity="0.12" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg-dots)" />
      </svg>

      {/* Glowing blobs */}
      <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] rounded-full bg-violet-400/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-48 -right-48 w-[34rem] h-[34rem] rounded-full bg-indigo-400/20 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[22rem] h-[22rem] rounded-full bg-purple-300/10 blur-3xl pointer-events-none" />

      {/* Outlined rings */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full border border-white/15 pointer-events-none" />
      <div className="absolute -top-8  -left-8  w-48 h-48 rounded-full border border-white/10 pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full border border-white/15 pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-56 h-56 rounded-full border border-white/10 pointer-events-none" />
      <div className="absolute top-[12%] right-[8%] w-20 h-20 rounded-full border border-white/15 pointer-events-none" />
      <div className="absolute bottom-[15%] left-[6%] w-16 h-16 rounded-full border border-white/15 pointer-events-none" />

      {/* Plus signs */}
      {[
        { top: '7%',  left: '5%',  size: '1.4rem' },
        { top: '5%',  left: '87%', size: '1.4rem' },
        { top: '87%', left: '5%',  size: '1.4rem' },
        { top: '91%', left: '91%', size: '1.4rem' },
        { top: '48%', left: '2%',  size: '1.1rem' },
        { top: '44%', left: '95%', size: '1.1rem' },
      ].map(({ size, ...s }, i) => (
        <span key={i} className="absolute text-white/25 font-light pointer-events-none select-none"
          style={{ ...s, fontSize: size }}>+</span>
      ))}

      {/* Floating card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[860px] min-h-[500px] rounded-2xl overflow-hidden shadow-2xl shadow-black/30 flex relative z-10"
      >

        {/* ── LEFT: purple panel ── */}
        <div
          className="hidden md:flex w-[52%] shrink-0 relative overflow-hidden flex-col justify-center px-12 py-10"
          style={{ background: 'linear-gradient(145deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)' }}
        >
          {/* Topographic contour lines */}
          <svg className="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="xMidYMid slice">
            {[
              'M-60 120 C 40 60,  160 180, 280 110 S 440  40, 560  90',
              'M-60 170 C 50 110, 170 230, 290 155 S 450  85, 570 135',
              'M-60 220 C 60 155, 180 280, 300 200 S 460 130, 580 178',
              'M-60 270 C 50 200, 175 325, 305 248 S 465 175, 585 222',
              'M-60  70 C 30  10, 145 130, 265  60 S 430 -10, 555  40',
              'M-60 320 C 55 250, 180 372, 310 295 S 468 220, 588 268',
              'M-60 370 C 45 298, 170 418, 300 342 S 462 265, 582 315',
              'M-60  20 C 20 -40, 130  80, 250  10 S 415 -60, 540 -10',
            ].map((d, i) => (
              <path key={i} d={d} stroke="white" strokeWidth="1.2" opacity={0.14 - i * 0.008} />
            ))}
          </svg>

          {/* Plus signs */}
          {[
            { top: '10%', left: '6%'  },
            { top: '18%', left: '68%' },
            { top: '62%', left: '8%'  },
            { top: '78%', left: '62%' },
            { top: '88%', left: '32%' },
          ].map((s, i) => (
            <span key={i} className="absolute text-white/30 text-xl font-light pointer-events-none select-none" style={s}>+</span>
          ))}

          {/* Small hollow circles */}
          {[
            { top: '28%', left: '14%', size: 10 },
            { top: '55%', left: '55%', size: 8  },
            { top: '72%', left: '22%', size: 12 },
            { top: '15%', left: '48%', size: 9  },
          ].map((c, i) => (
            <div key={i} className="absolute rounded-full border border-white/25 pointer-events-none"
              style={{ top: c.top, left: c.left, width: c.size, height: c.size }} />
          ))}

          {/* Corner rings */}
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full border border-white/20 pointer-events-none" />
          <div className="absolute -top-6  -right-6  w-24 h-24 rounded-full border border-white/15 pointer-events-none" />
          <div className="absolute -bottom-14 -left-14 w-44 h-44 rounded-full border border-white/20 pointer-events-none" />
          <div className="absolute -bottom-7  -left-7  w-28 h-28 rounded-full border border-white/15 pointer-events-none" />

          {/* Logo — bigger, no subtitle */}
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="absolute top-8 left-12 flex items-center gap-3"
          >
            <div className="w-12 h-12 bg-white/25 rounded-2xl flex items-center justify-center shadow-lg shadow-black/10 text-white">
              <NexusLogo size={24} />
            </div>
            <p className="font-black text-white text-lg tracking-tight">Nexus</p>
          </motion.div>

          {/* Welcome copy */}
          <div className="relative z-10">
            <motion.h1
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-4xl font-black text-white leading-tight mb-3"
            >
              Welcome back!
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="text-white/65 text-[15px] leading-relaxed max-w-[240px]"
            >
              You can sign in to access your existing account.
            </motion.p>
          </div>
        </div>

        {/* ── RIGHT: white form panel ── */}
        <div className="flex-1 bg-white flex flex-col overflow-hidden">
          {/* Accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 shrink-0" />

          <div className="flex-1 flex items-center justify-center px-10 py-8">
            <div className="w-full max-w-[310px]">

              <AnimatePresence mode="wait">

                {/* ── LOGIN VIEW ── */}
                {view === 'login' && (
                  <motion.div key="login"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="mb-7">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200 mb-4">
                        <NexusLogo size={22} />
                      </div>
                      <h2 className="text-2xl font-black text-gray-800">Sign In</h2>
                      <p className="text-[13px] text-gray-400 mt-1">Welcome back — enter your details below</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleLogin}>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </span>
                          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com" required
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700
                                       placeholder:text-gray-300 bg-gray-50/60
                                       focus:outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100 transition-all" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </span>
                          <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••" required
                            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm text-gray-700
                                       placeholder:text-gray-300 bg-gray-50/60
                                       focus:outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100 transition-all" />
                          <button type="button" onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-violet-500 transition-colors">
                            {showPassword
                              ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            }
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 accent-violet-600 cursor-pointer" />
                          <span className="text-[12px] text-gray-500">Remember me</span>
                        </label>
                        <button type="button" onClick={() => switchView('reset')}
                          className="text-[12px] text-violet-600 hover:text-violet-700 font-semibold transition-colors">
                          Forgot password?
                        </button>
                      </div>

                      {errorMsg && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                          {errorMsg}
                        </motion.p>
                      )}

                      <motion.button type="submit" disabled={loggingIn}
                        whileHover={{ scale: 1.015, boxShadow: '0 8px 28px rgba(109,40,217,0.4)' }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className="w-full py-3 mt-1 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-bold
                                   rounded-xl shadow-lg shadow-violet-200 transition-all disabled:opacity-60 cursor-pointer">
                        {loggingIn ? 'Signing in…' : 'Sign In →'}
                      </motion.button>
                    </form>
                  </motion.div>
                )}

                {/* ── RESET PASSWORD VIEW ── */}
                {view === 'reset' && (
                  <motion.div key="reset"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="mb-7">
                      <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200 mb-4">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-black text-gray-800">Reset Password</h2>
                      <p className="text-[13px] text-gray-400 mt-1">Enter your email and choose a new password</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleReset}>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </span>
                          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com" required
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700
                                       placeholder:text-gray-300 bg-gray-50/60
                                       focus:outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100 transition-all" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">New Password</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </span>
                          <input type={showNewPass ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)}
                            placeholder="••••••••" required minLength={6}
                            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm text-gray-700
                                       placeholder:text-gray-300 bg-gray-50/60
                                       focus:outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100 transition-all" />
                          <button type="button" onClick={() => setShowNewPass(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-violet-500 transition-colors">
                            {showNewPass
                              ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            }
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Confirm Password</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                          <input type={showConfirm ? 'text' : 'password'} value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                            placeholder="••••••••" required minLength={6}
                            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm text-gray-700
                                       placeholder:text-gray-300 bg-gray-50/60
                                       focus:outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100 transition-all" />
                          <button type="button" onClick={() => setShowConfirm(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-violet-500 transition-colors">
                            {showConfirm
                              ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            }
                          </button>
                        </div>
                      </div>

                      {errorMsg && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                          {errorMsg}
                        </motion.p>
                      )}
                      {successMsg && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl">
                          {successMsg}
                        </motion.p>
                      )}

                      <motion.button type="submit" disabled={resetting}
                        whileHover={{ scale: 1.015, boxShadow: '0 8px 28px rgba(109,40,217,0.4)' }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-bold
                                   rounded-xl shadow-lg shadow-violet-200 transition-all disabled:opacity-60 cursor-pointer">
                        {resetting ? 'Resetting…' : 'Reset Password →'}
                      </motion.button>

                      <button type="button" onClick={() => switchView('login')}
                        className="w-full py-2 text-[12px] text-gray-400 hover:text-violet-600 font-medium transition-colors flex items-center justify-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Sign In
                      </button>
                    </form>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
