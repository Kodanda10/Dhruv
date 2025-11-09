'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { notoDevanagari, titleFont } from '@/app/fonts';

export default function LabsV2Layout({ children }: { children: ReactNode }) {
  return (
    <div className={`${notoDevanagari.className} min-h-screen bg-[radial-gradient(circle_at_top,_#110437,_#050211)] text-white`}>
      <header className="border-b border-white/10 bg-black/30 backdrop-blur px-6 py-4 sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Labs v2 Preview</p>
          <h1 className={`${titleFont.className} text-2xl sm:text-3xl font-black`}>Dhruv Dashboard Experiments</h1>
        </div>
        <div className="flex gap-3 text-sm">
          <Link
            href="/labs-v2/analytics"
            className="rounded-full border border-white/40 px-4 py-2 hover:border-teal-300 hover:text-teal-200 transition"
          >
            📊 Analytics Preview
          </Link>
          <Link
            href="/labs-v2/review"
            className="rounded-full border border-white/40 px-4 py-2 hover:border-teal-300 hover:text-teal-200 transition"
          >
            ✍️ Review + AI Preview
          </Link>
        </div>
      </header>
      <main className="px-4 sm:px-8 py-10">{children}</main>
    </div>
  );
}
