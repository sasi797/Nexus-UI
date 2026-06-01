'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useLoginMutation } from '@/services/authApi';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/slices/authSlice';

export default function LoginPage() {
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg,   setErrorMsg]   = useState('');
  const [login, { isLoading }]      = useLoginMutation();

  const handleSubmit = async (e: React.SyntheticEvent) => {
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
    /* Full-page purple background */
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

      {/* Outlined rings — top-left */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full border border-white/15 pointer-events-none" />
      <div className="absolute -top-8  -left-8  w-48 h-48 rounded-full border border-white/10 pointer-events-none" />

      {/* Outlined rings — bottom-right */}
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full border border-white/15 pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-56 h-56 rounded-full border border-white/10 pointer-events-none" />

      {/* Outlined rings — scattered */}
      <div className="absolute top-[12%] right-[8%] w-20 h-20 rounded-full border border-white/15 pointer-events-none" />
      <div className="absolute bottom-[15%] left-[6%] w-16 h-16 rounded-full border border-white/15 pointer-events-none" />
      <div className="absolute top-[55%] right-[3%] w-10 h-10 rounded-full border border-white/15 pointer-events-none" />

      {/* Plus signs */}
      {[
        { top: '7%',  left: '5%',  size: '1.4rem' },
        { top: '5%',  left: '87%', size: '1.4rem' },
        { top: '87%', left: '5%',  size: '1.4rem' },
        { top: '91%', left: '91%', size: '1.4rem' },
        { top: '48%', left: '2%',  size: '1.1rem' },
        { top: '44%', left: '95%', size: '1.1rem' },
        { top: '22%', left: '18%', size: '1rem'   },
        { top: '75%', left: '80%', size: '1rem'   },
      ].map(({ size, ...s }, i) => (
        <span key={i} className="absolute text-white/25 font-light pointer-events-none select-none"
          style={{ ...s, fontSize: size }}>+</span>
      ))}

      {/* Floating card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[860px] min-h-[480px] rounded-2xl overflow-hidden shadow-2xl shadow-black/30 flex"
      >

        {/* ── LEFT: purple panel inside card ── */}
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

          {/* Large decorative circle — top-right corner */}
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full border border-white/20 pointer-events-none" />
          <div className="absolute -top-6  -right-6  w-24 h-24 rounded-full border border-white/15 pointer-events-none" />

          {/* Large decorative circle — bottom-left corner */}
          <div className="absolute -bottom-14 -left-14 w-44 h-44 rounded-full border border-white/20 pointer-events-none" />
          <div className="absolute -bottom-7  -left-7  w-28 h-28 rounded-full border border-white/15 pointer-events-none" />

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="absolute top-8 left-12 flex items-center gap-2.5"
          >
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <line x1="12" y1="11" x2="12"   y2="4"    strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="11" x2="4.5"  y2="18.5" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="11" x2="19.5" y2="18.5" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="3.5"  r="1.8" fill="currentColor" stroke="none" />
                <circle cx="4"  cy="19.5" r="1.8" fill="currentColor" stroke="none" />
                <circle cx="20" cy="19.5" r="1.8" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-white text-[14px] leading-tight">Nexus</p>
              <p className="text-[10px] text-white/55 font-medium">BookOps AI</p>
            </div>
          </motion.div>

          {/* Welcome copy */}
          <div className="relative z-10">
            <motion.h1
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-3xl font-black text-white leading-tight mb-2.5"
            >
              Welcome back!
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="text-white/65 text-sm leading-relaxed max-w-[220px]"
            >
              You can sign in to access your existing account.
            </motion.p>
          </div>
        </div>

        {/* ── RIGHT: white form panel inside card ── */}
        <div className="flex-1 bg-white flex flex-col relative overflow-hidden">
          {/* Purple accent bar at top */}
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 shrink-0" />

          <div className="flex-1 flex items-center justify-center px-10 py-8">
            <div className="w-full max-w-[310px]">

              {/* Icon + heading */}
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="mb-7"
              >
                <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200 mb-4">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-gray-800 leading-tight">Sign In</h2>
                <p className="text-[13px] text-gray-400 mt-1">Welcome back — enter your details below</p>
              </motion.div>

              <motion.form
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                className="space-y-4" onSubmit={handleSubmit}
              >

                {/* Email */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </span>
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com" required
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700
                                 placeholder:text-gray-300 bg-gray-50/60
                                 focus:outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100 transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </span>
                    <input
                      type="password" value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" required
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700
                                 placeholder:text-gray-300 bg-gray-50/60
                                 focus:outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100 transition-all"
                    />
                  </div>
                </div>

                {/* Remember me + Forgot */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 accent-violet-600 cursor-pointer"
                    />
                    <span className="text-[12px] text-gray-500">Remember me</span>
                  </label>
                  <button type="button" className="text-[12px] text-violet-600 hover:text-violet-700 font-semibold transition-colors">
                    Forgot password?
                  </button>
                </div>

                {errorMsg && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl"
                  >
                    {errorMsg}
                  </motion.p>
                )}

                <motion.button
                  type="submit" disabled={isLoading}
                  whileHover={{ scale: 1.015, boxShadow: '0 8px 28px rgba(109,40,217,0.4)' }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="w-full py-3 mt-1 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold
                             rounded-xl shadow-lg shadow-violet-200 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? 'Signing in…' : 'Sign In →'}
                </motion.button>

              </motion.form>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[11px] text-gray-300 font-medium">OR</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                className="text-center text-[12px] text-gray-400"
              >
                New here?{' '}
                <span className="text-violet-600 font-bold cursor-pointer hover:text-violet-700 transition-colors">
                  Create an Account
                </span>
              </motion.p>

            </div>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
