'use client';
import React from 'react';
import AnalyticsDashboard from './AnalyticsDashboard';

export default function AnalyticsDashboardDark() {
  // Wrapper component that uses the new Hindi AnalyticsDashboard
  // This maintains backward compatibility while using the new implementation
  return <AnalyticsDashboard />;
}
