'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export default function DynamicLearningCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleRunJob = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/labs/learning/run', { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run learning job.');
      }
      const data = await response.json();
      setResult(data.message || 'Learning job completed successfully.');
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="glassmorphic-card rounded-lg p-6"
    >
      <h3 className="text-xl font-bold mb-4 text-white">Dynamic Learning</h3>
      <p className="text-sm text-white/80 mb-4">
        Process approved reviews and generate new learning artifacts to improve the AI model.
      </p>
      <button
        onClick={handleRunJob}
        className="neon-button px-4 py-2 text-sm font-semibold rounded-lg"
        disabled={loading}
      >
        {loading ? 'Running Job...' : 'Run Learning Job'}
      </button>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 px-3 py-2 rounded-md text-sm mt-4" role="alert">
          {error}
        </div>
      )}
      {result && (
        <div className="bg-green-900/50 border border-green-700 text-green-300 px-3 py-2 rounded-md text-sm mt-4" role="alert">
          {result}
        </div>
      )}
    </motion.div>
  );
}
