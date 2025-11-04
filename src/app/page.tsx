'use client';
import React from 'react';
import DashboardDark from '@/components/DashboardDark';
import ReviewQueueNew from '@/components/review/ReviewQueueNew';
import { Suspense, useState } from 'react';
import { titleFont, notoDevanagari } from './fonts';

// Lazy load AnalyticsDashboard to avoid D3 import issues in tests
const AnalyticsDashboardDark = React.lazy(() => import('@/components/analytics/AnalyticsDashboardDark'));

export default function Home() {
  const [activeTab, setActiveTab] = useState<'home' | 'review' | 'analytics'>('home');

  return (
    <main className={`${notoDevanagari.className} min-h-screen bg-dark-gradient text-white`}>
      {/* Background Effects - Enhanced with Kusha theme */}
      <div className="fixed inset-0 -z-10 h-full w-full">
        <div className="absolute bottom-[-10%] left-[-20%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(91,44,135,0.6),rgba(255,255,255,0))]"></div>
        <div className="absolute right-[-20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(102,255,204,0.3),rgba(255,255,255,0))]"></div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className={`${titleFont.className} text-4xl md:text-5xl text-white font-bold mb-2`}>
            सोशल मीडिया एनालिटिक्स डैशबोर्ड
          </h1>
        </header>

        {/* Tab Navigation - Glassmorphic Style */}
        <div className="flex justify-center mb-8 gap-2 glassmorphic-card rounded-lg p-1 max-w-2xl mx-auto">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 px-6 py-3 rounded-md font-semibold text-base transition-all ${
              activeTab === 'home'
                ? 'tab-glassmorphic active text-mint-green'
                : 'tab-glassmorphic text-gray-300 hover:text-white'
            }`}
          >
            🏠 होम
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`flex-1 px-6 py-3 rounded-md font-semibold text-base transition-all ${
              activeTab === 'review'
                ? 'tab-glassmorphic active text-mint-green'
                : 'tab-glassmorphic text-gray-300 hover:text-white'
            }`}
          >
            📝 समीक्षा
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 px-6 py-3 rounded-md font-semibold text-base transition-all ${
              activeTab === 'analytics'
                ? 'tab-glassmorphic active text-mint-green'
                : 'tab-glassmorphic text-gray-300 hover:text-white'
            }`}
          >
            📊 एनालिटिक्स
          </button>
        </div>

        {/* Tab Content - Glassmorphic Card Layout */}
        <div className="min-h-[600px] glassmorphic-card shadow-lg">
          {activeTab === 'home' && (
            <div className="p-6">
              <Suspense fallback={<div className="text-center p-8 text-gray-400">Loading Tweets...</div>}>
                <DashboardDark />
              </Suspense>
            </div>
          )}

          {activeTab === 'review' && (
            <div className="p-6">
              <Suspense fallback={<div className="text-center p-8 text-gray-400">Loading Review Interface...</div>}>
                <ReviewQueueNew />
              </Suspense>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="p-6">
              <Suspense fallback={<div className="text-center p-8 text-gray-400">Loading Analytics...</div>}>
                <AnalyticsDashboardDark />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
