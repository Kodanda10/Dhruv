import type { Metadata } from 'next';
import ReviewClientPage from './ReviewClientPage';

export const metadata: Metadata = {
  title: 'Labs V2 Review',
  description: 'Review and AI assistant preview.',
};

export default function LabsV2ReviewPage() {
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <ReviewClientPage />
    </div>
  );
}
