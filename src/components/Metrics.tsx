"use client";
import { computeMetrics } from '@/utils/metrics';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

export default function Metrics() {
  const router = useRouter();
  const { places, actions } = computeMetrics();
  return (
    <section className="card-soft p-4 space-y-6 text-teal-50">
      <div>
        <h2 className="text-2xl font-semibold text-white">स्थान सारांश</h2>
        <ul className="list-disc list-inside mt-2">
          {places.map((p) => (
            <li key={p.key} className="leading-6">
              <button
                type="button"
                className="underline decoration-cyan-400/60 underline-offset-2 text-cyan-200 hover:text-white"
                onClick={() => router.push((`/?loc=${encodeURIComponent(p.key)}`) as Route)}
                aria-label={`${p.key} पर फ़िल्टर करें`}
                title={`${p.key} पर फ़िल्टर करें`}
              >
                {`${p.key} — ${p.count} बार`}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-2xl font-semibold text-white">गतिविधि सारांश</h2>
        <ul className="list-disc list-inside mt-2">
          {actions.map((a) => (
            <li key={a.key} className="leading-6">
              <button
                type="button"
                className="underline decoration-cyan-400/60 underline-offset-2 text-cyan-200 hover:text-white"
                onClick={() => router.push((`/?action=${encodeURIComponent(a.key)}`) as Route)}
                aria-label={`${a.key} पर फ़िल्टर करें`}
                title={`${a.key} पर फ़िल्टर करें`}
              >
                {`${a.key} — ${a.count} बार`}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
