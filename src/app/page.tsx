'use client';
import React from 'react';
import DashboardDark from '@/components/DashboardDark';
import ReviewQueueNew from '@/components/review/ReviewQueueNew';
import AdminLoginButton from '@/components/auth/AdminLoginButton';
import { Suspense, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { titleFont, notoDevanagari } from './fonts';

// Lazy load AnalyticsDashboard to avoid D3 import issues in tests
const AnalyticsDashboardDark = React.lazy(() => import('@/components/analytics/AnalyticsDashboardDark'));

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'review' | 'analytics'>('analytics'); // Default to analytics for public users

  // Update active tab when authentication changes
  useEffect(() => {
    if (!isAuthenticated && activeTab !== 'analytics') {
      setActiveTab('analytics');
    }
  }, [isAuthenticated, activeTab]);

  // Available tabs based on authentication
  const availableTabs = isAuthenticated
    ? ['home', 'review', 'analytics'] as const
    : ['analytics'] as const;

  return (
    <main className={`${notoDevanagari.className} min-h-screen bg-dark-gradient text-primary`}>
      {/* Background Effects - Enhanced with Kusha theme and subtle overlay */}
      <div className="fixed inset-0 -z-10 h-full w-full">
        {/* Subtle overlay gradient for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20"></div>
        <div className="absolute bottom-[-10%] left-[-20%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(91,44,135,0.5),rgba(255,255,255,0))]"></div>
        <div className="absolute right-[-20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(102,255,204,0.25),rgba(255,255,255,0))]"></div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8 relative">
          <div className="absolute top-0 right-0">
            <AdminLoginButton />
          </div>
          <h1 className={`${titleFont.className} text-4xl md:text-5xl text-primary font-bold mb-2`}>
            सोशल मीडिया एनालिटिक्स डैशबोर्ड
          </h1>
        </header>

        {/* Tab Navigation - Glassmorphic Style */}
        <div className={`flex justify-center mb-8 gap-2 glassmorphic-card rounded-lg p-1 ${availableTabs.length === 1 ? 'max-w-md' : 'max-w-2xl'} mx-auto`}>
          {availableTabs.includes('home') && (
            <button
              onClick={() => setActiveTab('home')}
              className={`flex-1 px-6 py-3 rounded-md font-semibold text-base transition-all ${
                activeTab === 'home'
                  ? 'tab-glassmorphic active text-mint-green'
                  : 'tab-glassmorphic text-secondary hover:text-primary'
              }`}
            >
              🏠 होम
            </button>
          )}
          {availableTabs.includes('review') && (
            <button
              onClick={() => setActiveTab('review')}
              className={`flex-1 px-6 py-3 rounded-md font-semibold text-base transition-all ${
                activeTab === 'review'
                  ? 'tab-glassmorphic active text-mint-green'
                  : 'tab-glassmorphic text-secondary hover:text-primary'
              }`}
            >
              📝 समीक्षा
            </button>
          )}
          {availableTabs.includes('analytics') && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex-1 px-6 py-3 rounded-md font-semibold text-base transition-all ${
                activeTab === 'analytics'
                  ? 'tab-glassmorphic active text-mint-green'
                  : 'tab-glassmorphic text-secondary hover:text-primary'
              }`}
            >
              📊 एनालिटिक्स
            </button>
          )}
        </div>

        {/* Tab Content - Glassmorphic Card Layout */}
        <div className="min-h-[600px] glassmorphic-card shadow-lg">
          {activeTab === 'home' && isAuthenticated && (
            <div className="p-6">
              <Suspense fallback={<div className="text-center p-8 text-muted">Loading Tweets...</div>}>
                <DashboardDark />
              </Suspense>
            </div>
          )}

          {activeTab === 'review' && isAuthenticated && (
            <div className="p-6">
              <Suspense fallback={<div className="text-center p-8 text-muted">Loading Review Interface...</div>}>
                <ReviewQueueNew />
              </Suspense>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="p-6">
              <Suspense fallback={<div className="text-center p-8 text-muted">Loading Analytics...</div>}>
                <AnalyticsDashboardDark />
              </Suspense>
            </div>
          )}

          {/* Fallback for unauthorized access */}
          {((activeTab === 'home' || activeTab === 'review') && !isAuthenticated) && (
            <div className="p-6 text-center">
              <div className="text-muted">
                <p className="text-lg mb-4">🔒 Admin Access Required</p>
                <p className="text-sm">Please log in to access this section.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
