'use client';

import React from 'react';
import FaissSearchCard from '@/components/analytics/FaissSearchCard';
import AIAssistantCard from '@/components/analytics/AIAssistantCard';
import DynamicLearningCard from '@/components/analytics/DynamicLearningCard';

export default function ReviewDashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* This column will contain the main review components, like a table of tweets */}
        <div className="glassmorphic-card rounded-lg p-6 h-96">
          <h3 className="text-xl font-bold mb-4 text-white">Parsed Events Review</h3>
          <p className="text-white/70">Review queue will be implemented here.</p>
        </div>
      </div>
      <div className="lg:col-span-1 space-y-6">
        <AIAssistantCard />
        <FaissSearchCard />
        <DynamicLearningCard />
      </div>
    </div>
  );
}
