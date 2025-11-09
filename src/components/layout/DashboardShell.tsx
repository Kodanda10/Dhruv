'use client';

import Link from 'next/link';
import { ReactNode, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLoginButton from '@/components/auth/AdminLoginButton';
import { useAuth } from '@/hooks/useAuth';
import { titleFont, notoDevanagari } from '@/app/fonts';
import type { Route } from 'next';

type TabId = 'home' | 'review' | 'commandview' | 'analytics';

interface DashboardShellProps {
  activeTab: TabId;
  requireAuth?: boolean;
  children: ReactNode;
}

const TAB_CONFIG: Array<{
  id: TabId;
  label: string;
  href: Route;
  requiresAuth: boolean;
}> = [
  { id: 'home', label: '🏠 होम', href: '/home' as Route, requiresAuth: true },
  { id: 'review', label: '🧾 समीक्षा', href: '/review' as Route, requiresAuth: true },
  { id: 'commandview', label: '🧭 कंट्रोल पैनल', href: '/commandview' as Route, requiresAuth: true },
  { id: 'analytics', label: '📊 एनालिटिक्स', href: '/analytics' as Route, requiresAuth: false },
];

export default function DashboardShell({
  activeTab,
  requireAuth = false,
  children,
}: DashboardShellProps) {
  const { isAuthenticated, loading } = useAuth();

  const visibleTabs = isAuthenticated ? TAB_CONFIG : TAB_CONFIG.filter((tab) => !tab.requiresAuth);

  const showLockState = requireAuth && !isAuthenticated && !loading;

  return (
    <main className={`${notoDevanagari.className} min-h-screen bg-dark-gradient text-primary`}>
      {/* Removed decorative overlays to ensure consistent gradient across all tabs */}

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header at top - always visible */}
        <header className="text-center mb-4 sm:mb-6 lg:mb-8 relative z-50">
          {/* Admin Badge - Fixed positioning to prevent overlap */}
          <div className="absolute top-0 right-0 sm:top-2 sm:right-2 md:top-4 md:right-4 z-[100]">
            <AdminLoginButton className="text-xs sm:text-sm" />
          </div>
          <h1 className={`${titleFont.className} text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white font-black mb-2 drop-shadow-[0_0_6px_#12005E] transition-all duration-500 ease-in-out pr-24 sm:pr-32 md:pr-40`}>
            सोशल मीडिया एनालिटिक्स डैशबोर्ड
          </h1>
        </header>

        <nav
          className={`flex flex-wrap sm:flex-nowrap justify-center mb-4 sm:mb-6 lg:mb-8 gap-2 sm:gap-4 glassmorphic-card rounded-lg p-1 sm:p-2 transition-all duration-500 ease-in-out ${
            visibleTabs.length === 1 ? 'max-w-md' : 'max-w-full sm:max-w-2xl'
          } mx-auto`}
        >
          {visibleTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex-1 sm:flex-none text-center px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-md font-semibold text-sm sm:text-base transition-all duration-500 ease-in-out transform-gpu ${
                activeTab === tab.id
                  ? 'tab-glassmorphic active text-mint-green border-2 sm:border-[3px] shadow-[0_0_8px_rgba(173,255,250,0.5)]'
                  : 'tab-glassmorphic text-secondary hover:text-primary shadow-[0_0_6px_rgba(173,255,250,0.3)]'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="min-h-[600px] glassmorphic-card shadow-lg p-4 sm:p-6 lg:p-8 relative overflow-hidden transition-all duration-500 ease-in-out transform-gpu">
          <AnimatePresence mode="wait">
            {loading && requireAuth ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-center text-muted"
              >
                प्रमाणीकरण स्थिति लोड हो रही है...
              </motion.div>
            ) : showLockState ? (
              <motion.div
                key="locked"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-center text-muted"
              >
                <p className="text-lg mb-4">🔒 Admin Access Required</p>
                <p className="text-sm">कृपया लॉगिन करें ताकि यह अनुभाग खुल सके।</p>
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="w-full"
              >
                <Suspense fallback={
                  <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                      <div className="inline-block w-8 h-8 border-4 border-[#8BF5E6] border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-muted">लोड हो रहा है...</p>
                    </div>
                  </div>
                }>
                  {children}
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
