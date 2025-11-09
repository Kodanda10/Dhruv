/**
 * Dynamic Learning Page
 */

'use client';

import React, { useState, useEffect } from 'react';

export default function LearningPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    // Load stats on mount
    const loadStats = async () => {
      try {
        const response = await fetch('/api/labs/learning/run');
        const data = await response.json();
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    };

    loadStats();
  }, []);

  const handleRunLearning = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/labs/learning/run', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        // Reload stats
        const statsResponse = await fetch('/api/labs/learning/run');
        const statsData = await statsResponse.json();
        if (statsData.success && statsData.stats) {
          setStats(statsData.stats);
        }
      } else {
        setError(data.error || 'Learning job failed');
      }
    } catch (err: any) {
      setError(err.message || 'Learning job failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 shadow-xl border border-white/20 mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">🧠 Dynamic Learning</h1>
          <p className="text-white/80 mb-4">मानव समीक्षा से सीखने वाला सिस्टम</p>

          {stats && (
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-white/60 text-sm">कुल फीडबैक</div>
                <div className="text-white text-2xl font-bold">{stats.totalFeedback}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-white/60 text-sm">पैटर्न</div>
                <div className="text-white text-2xl font-bold">{stats.totalPatterns}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-white/60 text-sm">आर्टिफैक्ट्स</div>
                <div className="text-white text-2xl font-bold">{stats.artifacts?.length || 0}</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-6 shadow-xl mb-6">
          <button
            onClick={handleRunLearning}
            disabled={isRunning}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
          >
            {isRunning ? 'चल रहा है...' : 'Learning Job चलाएं'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-4">परिणाम</h2>
            <div className="space-y-3">
              <div>
                <span className="text-gray-600">सफलता:</span>
                <span className="ml-2 font-semibold">{result.success ? 'हाँ' : 'नहीं'}</span>
              </div>
              <div>
                <span className="text-gray-600">सीखे गए इकाई:</span>
                <span className="ml-2 font-semibold">{result.learnedEntities?.length || 0}</span>
              </div>
              <div>
                <span className="text-gray-600">अपडेट किए गए पैटर्न:</span>
                <span className="ml-2 font-semibold">{result.patternsUpdated || 0}</span>
              </div>
              <div>
                <span className="text-gray-600">लेटेंसी:</span>
                <span className="ml-2 font-semibold">{result.latency_ms}ms</span>
              </div>
              {result.artifacts && result.artifacts.length > 0 && (
                <div>
                  <span className="text-gray-600">आर्टिफैक्ट्स:</span>
                  <ul className="list-disc list-inside mt-2">
                    {result.artifacts.map((artifact: string, index: number) => (
                      <li key={index} className="text-sm text-gray-700">
                        {artifact.split('/').pop()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

