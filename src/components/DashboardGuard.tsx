'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import { useBookingEvents } from '@/hooks/useBookingEvents';

const ADMIN_ONLY_PATHS = [
  '/dashboard/attendance',
  '/dashboard/allocations',
  '/dashboard/agents',
  '/dashboard/notifications',
  '/dashboard/reports',
  '/dashboard/settings',
];

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
  </div>
);

export default function DashboardGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { accessToken, user } = useAppSelector(state => state.auth);
  useBookingEvents(accessToken);

  // Prevent hydration mismatch: localStorage is unavailable on the server,
  // so auth state is always null there. Wait for client mount before deciding.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isAdminOnlyPath = ADMIN_ONLY_PATHS.some(p => pathname.startsWith(p));
  const isAgent = user?.role === 'agent';
  const blocked = isAgent && isAdminOnlyPath;

  useEffect(() => {
    if (!mounted) return;
    if (!accessToken) {
      router.replace('/login');
    }
  }, [mounted, accessToken, router]);

  // Server render + pre-hydration: show neutral spinner (matches server HTML)
  if (!mounted) return <Spinner />;

  if (!accessToken) return <Spinner />;

  if (blocked) {
    return (
      <div className="flex h-full overflow-hidden bg-gray-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Access Restricted</p>
              <p className="text-xs text-gray-400 mt-1">You don&apos;t have permission to view this page.</p>
            </div>
            <button
              onClick={() => router.replace('/dashboard')}
              className="text-xs font-bold bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
