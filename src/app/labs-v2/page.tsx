'use client';

import Link from 'next/link';

export default function LabsV2Home() {
  return (
    <section className="mx-auto max-w-4xl space-y-6 text-white">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/30">
        <p className="text-sm uppercase tracking-[0.35em] text-white/50 mb-3">Labs v2</p>
        <h1 className="text-4xl font-black mb-4">Preview Production Experiments</h1>
        <p className="text-white/70">
          यहाँ हम AI Review Assistant और Analytics redesign को production code से अलग रखते हैं। पूरी तरह से
          mock data पर आधारित है ताकि आप layout और interaction को बिना किसी जोखिम के देख सकें।
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <Link
          href="/labs-v2/analytics"
          className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/30 to-indigo-900/10 p-6 transition hover:scale-[1.01]"
        >
          <p className="text-xs text-white/60 mb-2">Step 1</p>
          <h2 className="text-2xl font-semibold mb-2">Analytics Preview</h2>
          <p className="text-white/70 text-sm">Updated cards, charts, and coverage map powered by mock analytics API.</p>
        </Link>
        <Link
          href="/labs-v2/review"
          className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/30 to-emerald-900/10 p-6 transition hover:scale-[1.01]"
        >
          <p className="text-xs text-white/60 mb-2">Step 2</p>
          <h2 className="text-2xl font-semibold mb-2">Review + AI Preview</h2>
          <p className="text-white/70 text-sm">Gemini-style assistant, deterministic tweets, safe to iterate.</p>
        </Link>
      </div>
    </section>
  );
}
