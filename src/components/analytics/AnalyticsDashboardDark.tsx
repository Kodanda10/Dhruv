'use client';
import React from 'react';
import GeoHierarchyMindmap from './GeoHierarchyMindmap';

export default function AnalyticsDashboardDark() {
  return (
    <div className="min-h-screen text-primary">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">एनालिटिक्स डैशबोर्ड</h1>
          <p className="text-muted">डेटा विश्लेषण और अंतर्दृष्टि</p>
        </div>

        <div className="space-y-8">
          {/* GeoHierarchy Mindmap */}
          <div className="w-full">
            <GeoHierarchyMindmap />
          </div>
        </div>
      </div>
    </div>
  );
}
