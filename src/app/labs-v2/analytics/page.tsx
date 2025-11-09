'use client';

import LabsAnalyticsPreview from './preview';

export default function LabsAnalyticsPage() {
  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <div className="rounded-2xl bg-white/5 border border-white/15 p-6 shadow-xl shadow-black/40">
        <p className="text-sm text-white/70">Previewing production analytics layout with mock data.</p>
        <p className="text-xs text-white/40 mt-1">
          Once validated, these cards can replace the existing `/analytics` modules.
        </p>
      </div>
      <LabsAnalyticsPreview />
    </section>
  );
}
