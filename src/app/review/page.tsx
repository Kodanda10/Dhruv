/* Project_Dhruv/src/app/review/page.tsx
   Minimal Review page to satisfy Next.js build/types.
   This is a simple server component with semantic structure and accessible labels.
*/

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Review Queue',
  description: 'Human review dashboard overview',
};

/**
 * Simple, non-interactive page that provides navigation to review-related endpoints.
 * Keep it minimal to avoid client-side dependencies and ensure build stability.
 */
export default function ReviewPage() {
  const generatedAt = new Date().toISOString();

  return (
    <main role="main" aria-labelledby="review-heading" className="container mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 id="review-heading" className="text-2xl font-semibold">
          Review Queue
        </h1>
        <p className="text-sm text-gray-600">
          Overview of review endpoints and basic documentation. Generated at: {generatedAt}
        </p>
      </header>

      <section aria-labelledby="quick-links-heading" className="mb-8">
        <h2 id="quick-links-heading" className="text-xl font-medium mb-3">
          Quick links
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <a href="/api/review/list?status=pending&limit=10" target="_blank" rel="noopener noreferrer">Pending review items (API)</a>
          </li>
          <li>
            <a href="/api/review/list?status=reviewed&limit=10" target="_blank" rel="noopener noreferrer">Reviewed items (API)</a>
          </li>
          <li>
            <a href="/api/review/status" target="_blank" rel="noopener noreferrer">Review status summary (API)</a>
          </li>
          <li>
            <a href="/api/reviewed-posts?limit=10" target="_blank" rel="noopener noreferrer">Recently reviewed posts (API)</a>
          </li>
          <li>
            <a href="/api/processed-posts?limit=10" target="_blank" rel="noopener noreferrer">Processed posts (API)</a>
          </li>
        </ul>
      </section>

      <section aria-labelledby="howto-heading" className="mb-8">
        <h2 id="howto-heading" className="text-xl font-medium mb-3">
          How to use
        </h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Use the API links above to fetch review queues and status summaries.</li>
          <li>
            Submit batch feedback via <code>/api/bulk-feedback</code> (POST JSON) from the review
            tools.
          </li>
          <li>
            For single item feedback, use <code>/api/feedback</code> (GET or POST).
          </li>
        </ol>
      </section>

      <footer className="mt-10 text-xs text-gray-500">
        <p>Review dashboard — minimal placeholder. Replace with the full UI when ready.</p>
      </footer>
    </main>
  );
}
