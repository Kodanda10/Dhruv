/* Project_Dhruv/src/app/review/page.tsx
   Review page with proper ReviewQueueNew component
*/

import type { Metadata } from 'next';
import ReviewQueueNew from '@/components/review/ReviewQueueNew';

export const metadata: Metadata = {
  title: 'Review Queue - Samiksha',
  description: 'Human review dashboard for tweet analysis and approval',
};

export default function ReviewPage() {
  return <ReviewQueueNew />;
}
