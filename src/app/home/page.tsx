import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import Dashboard from '@/components/Dashboard';
import { getAdminSession } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const session = getAdminSession();
  if (!session) {
    redirect('/analytics');
  }

  return (
    <DashboardShell activeTab="home" requireAuth>
      <Suspense fallback={<div className="text-center p-8 text-muted">Loading Tweets...</div>}>
        <Dashboard />
      </Suspense>
    </DashboardShell>
  );
}
