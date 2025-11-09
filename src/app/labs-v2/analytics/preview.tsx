'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
} from 'recharts';
import GeoHierarchyMindmap from '@/components/analytics/GeoHierarchyMindmap';

type AnalyticsPreviewData = {
  total_tweets: number;
  event_distribution: Record<string, number>;
  location_distribution: Record<string, number>;
  scheme_usage: Record<string, number>;
  timeline: { date: string; count: number }[];
  day_of_week: Record<string, number>;
  caste_community: Record<string, number>;
  target_groups: Record<string, number>;
  thematic_analysis: Record<string, number>;
  raigarh_section: {
    coverage_percentage: number;
    total_villages?: number;
    visited_villages?: number;
    local_events: { date: string; location: string; type: string; description: string }[];
    community_data: Record<string, number>;
    engagement_metrics: {
      total_likes: number;
      total_retweets: number;
      total_replies: number;
    };
  };
};

const cardClass =
  'rounded-3xl border border-white/10 bg-gradient-to-b from-white/8 to-white/2 p-6 shadow-xl shadow-black/30';

export default function LabsAnalyticsPreview() {
  const [data, setData] = useState<AnalyticsPreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/labs/analytics');
        const json = await res.json();
        if (mounted && json.success) {
          setData(json.data);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const timelineData = useMemo(() => data?.timeline ?? [], [data]);
  const coverageMeta = useMemo(() => {
    if (!data) return { visited: 0, total: 0, percent: 0 };
    const total = data.raigarh_section.total_villages ?? 0;
    const visited =
      data.raigarh_section.visited_villages ??
      Math.round((data.raigarh_section.coverage_percentage / 100) * total);
    const percent = total ? Math.round((visited / total) * 100) : data.raigarh_section.coverage_percentage;
    return { visited, total, percent };
  }, [data]);

  if (loading) {
    return (
      <div className={`${cardClass} text-center`}>
        <p className="text-white/70">Mock analytics loading…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`${cardClass} text-center text-red-200`}>
        Mock analytics endpoint returned no data.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <header className="flex items-center justify-between text-white/70">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-white/40">A.</p>
            <h2 className="text-2xl font-semibold text-white">इवेंट और एंगेजमेंट कार्ड</h2>
            <p className="text-sm text-white/60">Production शीर्ष सेक्शन का हूबहू लेआउट</p>
          </div>
          <span className="text-xs border border-white/15 rounded-full px-3 py-1 text-white/60">Labs Mock</span>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          <div className={cardClass}>
            <p className="text-white/60 text-sm mb-1">कुल सत्यापित ट्वीट</p>
            <p className="text-4xl font-black text-white">{data.total_tweets.toLocaleString()}</p>
            <p className="text-xs text-white/40 mt-2">Gemini + Ollama पास हुई एंट्री</p>
          </div>
          <div className={cardClass}>
            <p className="text-white/60 text-sm mb-1">रायगढ़ कवरेज</p>
            <p className="text-4xl font-black text-teal-200">{coverageMeta.percent}%</p>
            <p className="text-xs text-white/40 mt-2">
              {coverageMeta.visited}/{coverageMeta.total} ग्राम
            </p>
          </div>
          <div className={cardClass}>
            <p className="text-white/60 text-sm mb-1">एंगेजमेंट</p>
            <p className="text-4xl font-black text-white">
              {(data.raigarh_section.engagement_metrics.total_likes +
                data.raigarh_section.engagement_metrics.total_retweets +
                data.raigarh_section.engagement_metrics.total_replies
              ).toLocaleString()}
            </p>
            <p className="text-xs text-white/40 mt-2">लाइक्स + रीट्वीट + जवाब</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">इवेंट वितरण</h2>
            <span className="text-xs text-white/50">recharts preview</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={Object.entries(data.event_distribution).map(([name, value]) => ({ name, value }))}
            >
              <XAxis dataKey="name" stroke="#ddd" />
              <YAxis stroke="#ddd" />
              <Tooltip contentStyle={{ background: '#090014', border: '1px solid rgba(255,255,255,0.1)' }} />
              <Bar dataKey="value" fill="#8BF5E6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">शीर्ष स्थान</h2>
            <span className="text-xs text-white/50">sample drilldown</span>
          </div>
          <ul className="space-y-3">
            {Object.entries(data.location_distribution).map(([location, count]) => (
              <li key={location} className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{location}</p>
                  <p className="text-xs text-white/50">AI validated events</p>
                </div>
                <span className="text-lg text-teal-200 font-bold">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <header className="flex items-center justify-between text-white/70">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-white/40">B.</p>
            <h2 className="text-2xl font-semibold text-white">भू-मानचित्रण + कवरेज</h2>
            <p className="text-sm text-white/60">जिला → विधानसभा माइंडमैप + कवरेज गणना</p>
          </div>
        </header>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={cardClass}>
            <GeoHierarchyMindmap data={mindmapData} />
          </div>
          <div className="space-y-4">
            <div className={cardClass}>
              <h3 className="text-xl font-semibold text-white mb-2">कवरेज गणना</h3>
              <p className="text-sm text-white/60">
                {coverageMeta.visited} ग्राम / {coverageMeta.total} कुल ग्राम ={' '}
                <span className="text-teal-200 font-bold">{coverageMeta.percent}%</span>
              </p>
              <div className="mt-4">
                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-sky-500"
                    style={{ width: `${coverageMeta.percent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-white/50 mt-1">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
              <p className="text-xs text-white/50 mt-3">
                सूत्र: (दौरा किए गए ग्राम ÷ कुल ग्राम) × 100 — यही production `/api/analytics` में लागू होगा।
              </p>
            </div>
            <div className={cardClass}>
              <h3 className="text-xl font-semibold text-white mb-3">लक्ष्य समूह विभाजन</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(data.target_groups).map(([group, count]) => (
                  <div key={group} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-xs text-white/50">{group}</p>
                    <p className="text-lg font-bold text-white">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className={cardClass}>
          <h2 className="text-xl font-semibold mb-4">गत 10 दिन की टाइमलाइन</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={timelineData}>
              <XAxis dataKey="date" stroke="#ddd" />
              <YAxis stroke="#ddd" />
              <Tooltip contentStyle={{ background: '#090014', border: '1px solid rgba(255,255,255,0.1)' }} />
              <Line type="monotone" dataKey="count" stroke="#8BF5E6" strokeWidth={3} dot={{ fill: '#fff' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className={cardClass}>
          <h2 className="text-xl font-semibold mb-4">रायगढ़ स्थानीय घटनाएँ</h2>
          <div className="space-y-4">
            {data.raigarh_section.local_events.map((event) => (
              <article key={`${event.date}-${event.location}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/50">{event.date}</p>
                <h3 className="text-lg font-semibold">{event.location}</h3>
                <p className="text-sm text-white/70">{event.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
