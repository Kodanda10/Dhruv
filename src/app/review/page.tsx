import { Suspense } from 'react';
import ReviewQueue from '@/components/review/ReviewQueue';
import AIReviewAssistant from '@/components/review/AIReviewAssistant';
import FaissSearchCard from '@/components/analytics/FaissSearchCard';
import DynamicLearningCard from '@/components/analytics/DynamicLearningCard';
import GlassSectionCard from '@/components/GlassSectionCard';
import DashboardShell from '@/components/layout/DashboardShell';

export const dynamic = 'force-dynamic';

export default function ReviewPage() {
  return (
    <DashboardShell activeTab="review" requireAuth>
      <div className="space-y-6">
        {/* Review Panel Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-[0_0_6px_#12005E]">
            समीक्षा पैनल - Review Panel
          </h1>
          <p className="text-secondary mt-2">
            पार्स किए गए ट्वीट्स की समीक्षा करें और एनालिटिक्स के लिए अप्रूव करें
          </p>
        </div>

        {/* 4-Card Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Parsed Events Review (Main Card) */}
          <div className="lg:col-span-2">
            <GlassSectionCard className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">📋 पार्स किए गए इवेंट्स की समीक्षा - Parsed Events Review</h2>
              <Suspense fallback={<div className="text-center p-8 text-secondary">Loading Review Queue...</div>}>
                <ReviewQueue />
              </Suspense>
            </GlassSectionCard>
          </div>

          {/* 2. AI Review Assistant */}
          <GlassSectionCard className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">🤖 AI समीक्षा सहायक - AI Review Assistant</h3>
            <Suspense fallback={<div className="text-center p-4 text-secondary">Loading AI Assistant...</div>}>
              {/* Note: AIReviewAssistant expects props, we'll need to integrate it properly */}
              <div className="text-center py-8 text-secondary">
                <p>AI सहायक एकीकरण प्रगति में है</p>
                <p className="text-sm mt-2">AI Review Assistant integration in progress</p>
              </div>
            </Suspense>
          </GlassSectionCard>

          {/* 3. FAISS Search Card */}
          <GlassSectionCard className="p-6">
            <Suspense fallback={<div className="text-center p-4 text-secondary">Loading FAISS Search...</div>}>
              <FaissSearchCard />
            </Suspense>
          </GlassSectionCard>

          {/* 4. Dynamic Learning Card */}
          <GlassSectionCard className="p-6 lg:col-span-2">
            <Suspense fallback={<div className="text-center p-4 text-secondary">Loading Dynamic Learning...</div>}>
              <DynamicLearningCard />
            </Suspense>
          </GlassSectionCard>
        </div>
      </div>
    </DashboardShell>
  );
}
