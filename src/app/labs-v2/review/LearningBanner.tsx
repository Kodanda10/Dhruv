'use client';

import { useState, useEffect } from 'react';

export default function LearningBanner() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch initial status from the backend
    async function fetchStatus() {
      try {
        const response = await fetch('/api/labs-v2/learning/status');
        const data = await response.json();
        setIsEnabled(data.isEnabled);
      } catch (error) {
        console.error('Failed to fetch learning banner status:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  const handleToggle = async () => {
    const newStatus = !isEnabled;
    setIsEnabled(newStatus); // Optimistic update

    try {
      await fetch('/api/labs-v2/learning/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: newStatus }),
      });
    } catch (error) {
      console.error('Failed to toggle learning banner:', error);
      setIsEnabled(!newStatus); // Revert on error
    }
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  return (
    <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded-md mb-6" role="alert">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold">Dynamic Learning Active</p>
          <p className="text-sm">Your reviews are used to improve the AI model.</p>
        </div>
        <div className="flex items-center">
          <span className="mr-3 text-sm font-medium">{isEnabled ? 'ON' : 'OFF'}</span>
          <label htmlFor="learning-toggle" className="flex items-center cursor-pointer">
            <div className="relative">
              <input
                id="learning-toggle"
                type="checkbox"
                className="sr-only"
                checked={isEnabled}
                onChange={handleToggle}
              />
              <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
              <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isEnabled ? 'transform translate-x-6' : ''}`}></div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
