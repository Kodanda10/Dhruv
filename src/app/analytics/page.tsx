import { Metadata } from 'next';
import AnalyticsDashboardDark from '@/components/analytics/AnalyticsDashboardDark';

export const metadata: Metadata = {
  title: 'Analytics - Project Dhruv Dashboard',
  description: 'Analytics dashboard showing approved tweets data',
};

export default function AnalyticsPage() {
  return <AnalyticsDashboardDark />;
}
