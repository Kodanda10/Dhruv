import Dashboard from '@/components/Dashboard';
import Metrics from '@/components/Metrics';
import { Suspense } from 'react';
import { amita } from './fonts';

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <header className="text-center mb-8">
        <h1 className={`${amita.className} heading-amita text-5xl md:text-6xl text-white font-bold`}>
          श्री ओपी चौधरी - सोशल मीडिया एनालिटिक्स डैशबोर्ड
        </h1>
      </header>
      <Suspense fallback={<div className="text-center p-8">Loading Dashboard...</div>}>
        <Dashboard />
      </Suspense>
      <Metrics />
    </main>
  );
}
