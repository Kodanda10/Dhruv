/**
 * Mapbox Maps Page
 */

'use client';

import React, { useState, useEffect } from 'react';
import MapboxView from '@/labs/maps/MapboxView';
import type { GeoJSONData } from '@/labs/maps/types';

export default function MapsPage() {
  const [geoJsonData, setGeoJsonData] = useState<GeoJSONData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalEvents: number; uniqueLocations: number; clusters: number } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/labs/maps/data');
        const data = await response.json();

        if (data.success) {
          setGeoJsonData(data.geoJson);
          setStats(data.stats);
        } else {
          setError(data.error || 'मानचित्र डेटा लोड करने में त्रुटि');
        }
      } catch (err: any) {
        setError(err.message || 'मानचित्र डेटा लोड करने में त्रुटि');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8 flex items-center justify-center">
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6">
          <p className="text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 shadow-xl border border-white/20 mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">🗺️ Mapbox Maps</h1>
          <p className="text-white/80 mb-4">वास्तविक घटना स्थानों का मानचित्र</p>

          {stats && (
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-white/60 text-sm">कुल घटनाएं</div>
                <div className="text-white text-2xl font-bold">{stats.totalEvents}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-white/60 text-sm">अद्वितीय स्थान</div>
                <div className="text-white text-2xl font-bold">{stats.uniqueLocations}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-white/60 text-sm">क्लस्टर</div>
                <div className="text-white text-2xl font-bold">{stats.clusters}</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-6 shadow-xl">
          {isLoading ? (
            <div className="flex items-center justify-center h-[600px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">मानचित्र लोड हो रहा है...</p>
              </div>
            </div>
          ) : (
            <MapboxView data={geoJsonData || undefined} />
          )}
        </div>
      </div>
    </div>
  );
}

