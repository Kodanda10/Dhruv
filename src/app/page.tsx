'use client';
import Dashboard from '@/components/Dashboard';
import Metrics from '@/components/Metrics';
import ReviewQueue from '@/components/review/ReviewQueue';
import { Suspense, useState } from 'react';
import { titleFont, notoDevanagari } from './fonts';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'home' | 'review' | 'analytics'>('home');

  return (
    <main className={`${notoDevanagari.className} min-h-screen bg-gray-50`}>
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className={`${titleFont.className} text-4xl md:text-5xl text-gray-900 font-bold mb-2`}>
            सोशल मीडिया एनालिटिक्स डैशबोर्ड
          </h1>
          <p className="text-gray-600 text-sm">OP Choudhary Social Media Analytics</p>
        </header>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8 gap-2 bg-white rounded-lg p-1 shadow-sm max-w-2xl mx-auto">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 px-6 py-3 rounded-md font-semibold text-base transition-all ${
              activeTab === 'home'
                ? 'bg-green-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            🏠 होम
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`flex-1 px-6 py-3 rounded-md font-semibold text-base transition-all ${
              activeTab === 'review'
                ? 'bg-green-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            📝 समीक्षा
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 px-6 py-3 rounded-md font-semibold text-base transition-all ${
              activeTab === 'analytics'
                ? 'bg-green-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            📊 एनालिटिक्स
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          {activeTab === 'home' && (
            <section>
              <Suspense fallback={<div className="text-center p-8 text-gray-600">Loading Tweets...</div>}>
                <Dashboard />
              </Suspense>
            </section>
          )}

          {activeTab === 'review' && (
            <section>
              <Suspense fallback={<div className="text-center p-8 text-gray-600">Loading Review Interface...</div>}>
                <ReviewQueue />
              </Suspense>
            </section>
          )}

          {activeTab === 'analytics' && (
            <section>
              <Metrics />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
