import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import ReviewQueue from '@/components/review/ReviewQueue';
import { getAdminSession } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export default function ReviewPage() {
  const session = getAdminSession();
  if (!session) {
    redirect('/analytics');
  }

  return (
    <DashboardShell activeTab="review" requireAuth>
      <Suspense fallback={<div className="text-center p-8 text-muted">Loading Review Interface...</div>}>
        <ReviewQueue />
      </Suspense>
    </DashboardShell>
  );
}
