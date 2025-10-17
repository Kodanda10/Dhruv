'use client';
import Dashboard from '@/components/Dashboard';
import Metrics from '@/components/Metrics';
import HumanReviewSimple from '@/components/HumanReviewSimple';
import { Suspense, useState } from 'react';
import { amita } from './fonts';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'home' | 'review' | 'analytics'>('home');

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="text-center mb-8">
        <h1 className={`${amita.className} heading-amita text-5xl md:text-6xl text-white font-bold drop-shadow-lg`}>
          श्री ओपी चौधरी - सोशल मीडिया एनालिटिक्स डैशबोर्ड
        </h1>
      </header>

      {/* Tab Navigation */}
      <div className="flex justify-center mb-8 gap-4">
        <button
          onClick={() => setActiveTab('home')}
          className={`px-8 py-3 rounded-lg font-semibold text-lg transition-all ${
            activeTab === 'home'
              ? 'bg-white text-teal-900 shadow-lg'
              : 'bg-teal-800 text-white hover:bg-teal-700'
          }`}
        >
          🏠 होम (All Tweets)
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`px-8 py-3 rounded-lg font-semibold text-lg transition-all ${
            activeTab === 'review'
              ? 'bg-white text-teal-900 shadow-lg'
              : 'bg-teal-800 text-white hover:bg-teal-700'
          }`}
        >
          📝 मानव समीक्षा (Human Review)
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-8 py-3 rounded-lg font-semibold text-lg transition-all ${
            activeTab === 'analytics'
              ? 'bg-white text-teal-900 shadow-lg'
              : 'bg-teal-800 text-white hover:bg-teal-700'
          }`}
        >
          📊 एनालिटिक्स (Analytics)
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === 'home' && (
          <section>
            <Suspense fallback={<div className="text-center p-8 text-white">Loading Tweets...</div>}>
              <Dashboard />
            </Suspense>
          </section>
        )}

        {activeTab === 'review' && (
          <section>
            <Suspense fallback={<div className="text-center p-8 text-white">Loading Review Interface...</div>}>
              <HumanReviewSimple />
            </Suspense>
          </section>
        )}

        {activeTab === 'analytics' && (
          <section>
            <Metrics />
          </section>
        )}
      </div>
    </main>
  );
}
