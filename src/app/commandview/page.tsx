import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import CommandViewDashboard from '@/components/admin/CommandViewDashboard';
import { getAdminSession } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export default function CommandViewPage() {
  const session = getAdminSession();
  if (!session) {
    redirect('/analytics');
  }

  return (
    <DashboardShell activeTab="commandview" requireAuth>
      <Suspense fallback={<div className="text-center p-8 text-muted">Loading Command Panel...</div>}>
        <CommandViewDashboard />
      </Suspense>
    </DashboardShell>
  );
}
