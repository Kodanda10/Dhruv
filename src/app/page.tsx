'use client';
import React from 'react';
import Dashboard from '@/components/Dashboard';
import DashboardDark from '@/components/DashboardDark';
import ReviewQueue from '@/components/review/ReviewQueue';
import ReviewQueueNew from '@/components/review/ReviewQueueNew';
import { Suspense, useState } from 'react';
import { titleFont, notoDevanagari } from './fonts';

// Lazy load AnalyticsDashboard to avoid D3 import issues in tests
const AnalyticsDashboard = React.lazy(() => import('@/components/analytics/AnalyticsDashboard'));
const AnalyticsDashboardDark = React.lazy(() => import('@/components/analytics/AnalyticsDashboardDark'));

export default function Home() {
  const [activeTab, setActiveTab] = useState<'home' | 'review' | 'analytics'>('home');

  return (
    <main className={`${notoDevanagari.className} min-h-screen bg-[#101922] text-gray-200`}>
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10 h-full w-full">
        <div className="absolute bottom-[-10%] left-[-20%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(44,0,95,0.7),rgba(255,255,255,0))]"></div>
        <div className="absolute right-[-20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(0,75,79,0.6),rgba(255,255,255,0))]"></div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className={`${titleFont.className} text-4xl md:text-5xl text-white font-bold mb-2`}>
            सोशल मीडिया एनालिटिक्स डैशबोर्ड
          </h1>
        </header>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8 gap-2 bg-[#192734] rounded-lg p-1 shadow-sm max-w-2xl mx-auto border border-gray-800">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 px-6 py-3 rounded-md font-semibold text-base transition-all ${
              activeTab === 'home'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            🏠 होम
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`flex-1 px-6 py-3 rounded-md font-semibold text-base transition-all ${
              activeTab === 'review'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            📝 समीक्षा
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 px-6 py-3 rounded-md font-semibold text-base transition-all ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            📊 एनालिटिक्स
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          {activeTab === 'home' && (
            <section>
              <Suspense fallback={<div className="text-center p-8 text-gray-400">Loading Tweets...</div>}>
                <DashboardDark />
              </Suspense>
            </section>
          )}

          {activeTab === 'review' && (
            <section>
              <Suspense fallback={<div className="text-center p-8 text-gray-400">Loading Review Interface...</div>}>
                <ReviewQueueNew />
              </Suspense>
            </section>
          )}

          {activeTab === 'analytics' && (
            <section>
              <Suspense fallback={<div className="text-center p-8 text-gray-400">Loading Analytics...</div>}>
                <AnalyticsDashboardDark />
              </Suspense>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
