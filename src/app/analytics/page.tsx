import { Suspense } from 'react';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import DashboardShell from '@/components/layout/DashboardShell';

export const dynamic = 'force-dynamic';

export default function AnalyticsPage() {
  return (
    <DashboardShell activeTab="analytics">
      <Suspense fallback={<div className="text-center p-8 text-muted">Loading Analytics...</div>}>
        <AnalyticsDashboard />
      </Suspense>
    </DashboardShell>
  );
}
