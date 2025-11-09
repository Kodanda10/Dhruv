"use client";
import { computeMetrics } from '@/utils/metrics';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

export default function Metrics() {
  const router = useRouter();
  // computeMetrics now requires data parameter - should fetch from API
  // For now, return empty metrics (component should fetch data from API)
  const { places, actions } = computeMetrics([]);
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6 text-gray-900">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">स्थान सारांश</h2>
        <ul className="list-disc list-inside mt-2">
          {places.map((p) => (
            <li key={p.key} className="leading-6">
              <button
                type="button"
                className="underline decoration-green-400/60 underline-offset-2 text-green-700 hover:text-green-800"
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
        <h2 className="text-2xl font-semibold text-gray-900">गतिविधि सारांश</h2>
        <ul className="list-disc list-inside mt-2">
          {actions.map((a) => (
            <li key={a.key} className="leading-6">
              <button
                type="button"
                className="underline decoration-green-400/60 underline-offset-2 text-green-700 hover:text-green-800"
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
