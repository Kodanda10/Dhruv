import { Suspense } from 'react';
import ReviewDashboard from '@/components/review/ReviewDashboard';
import DashboardShell from '@/components/layout/DashboardShell';

export const dynamic = 'force-dynamic';

export default function ReviewPage() {
  return (
    <DashboardShell activeTab="review" requireAuth>
      <Suspense fallback={<div className="text-center p-8 text-muted">Loading Review Interface...</div>}>
        <ReviewDashboard />
      </Suspense>
    </DashboardShell>
  );
}
