'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import ErrorBoundary from '@/components/ErrorBoundary';
import DashboardGuard from '@/components/DashboardGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ErrorBoundary>
      <DashboardGuard>
        <div className="flex h-full overflow-hidden bg-gray-50">

          {/* Desktop sidebar — inline in flex flow at lg+ */}
          <div className="hidden lg:block shrink-0">
            <Sidebar />
          </div>

          {/* Mobile/tablet overlay sidebar — only mounts when open */}
          <AnimatePresence>
            {sidebarOpen && (
              <div className="lg:hidden fixed inset-0 z-50">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-black/40"
                  onClick={() => setSidebarOpen(false)}
                />
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="absolute inset-y-0 left-0"
                >
                  <Sidebar onClose={() => setSidebarOpen(false)} />
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Header onMenuToggle={() => setSidebarOpen(v => !v)} />
            <main className="flex-1 overflow-y-auto p-3 md:p-4">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </main>
          </div>

        </div>
      </DashboardGuard>
    </ErrorBoundary>
  );
}
