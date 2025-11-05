/**
 * System Health Cards Component
 *
 * Displays system health overview dashboard with API chain health,
 * database connection status, frontend build health, and backend service uptime.
 * Meets WCAG 2.1 AA accessibility standards with keyboard navigation.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface HealthService {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  [key: string]: any;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database?: HealthService;
    twitter_api?: HealthService;
    gemini_api?: HealthService;
    ollama_api?: HealthService;
  };
  frontend?: {
    build_status: string;
    last_build: string;
    bundle_size: string;
  };
  uptime_seconds?: number;
  version?: string;
}

interface SystemHealthCardsProps {
  refreshInterval?: number; // in milliseconds
  className?: string;
}

const SystemHealthCards: React.FC<SystemHealthCardsProps> = ({
  refreshInterval = 30000, // 30 seconds
  className
}) => {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const fetchHealthData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/system/health');
      if (!response.ok) {
        throw new Error('Failed to fetch health data');
      }
      const data: HealthResponse = await response.json();
      setHealthData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthData();

    const interval = setInterval(fetchHealthData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchHealthData, refreshInterval]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'unhealthy': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return 'स्वस्थ';
      case 'degraded': return 'क्षीण';
      case 'unhealthy': return 'अस्वस्थ';
      default: return 'अज्ञात';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days} दिन`;
    if (hours > 0) return `${hours} घंटे`;
    if (minutes > 0) return `${minutes} मिनट`;
    return `${seconds} सेकंड`;
  };

  const HealthCard: React.FC<{
    title: string;
    status: string;
    metrics: string[];
    details?: string;
    testId: string;
  }> = ({ title, status, metrics, details, testId }) => (
    <div
      className={cn(
        "bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border cursor-pointer",
        "hover:shadow-lg transition-shadow duration-200",
        "focus:outline-none focus:ring-2 focus:ring-blue-500"
      )}
      onClick={() => setSelectedCard(selectedCard === testId ? null : testId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSelectedCard(selectedCard === testId ? null : testId);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${title} स्वास्थ्य स्थिति`}
      aria-expanded={selectedCard === testId}
      data-testid={`health-card-${testId}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <div
          className={cn("w-3 h-3 rounded-full", getStatusColor(status))}
          data-testid={`${testId}-status`}
          aria-label={`स्थिति: ${getStatusText(status)}`}
        />
      </div>

      <div className="space-y-1">
        {metrics.map((metric, index) => (
          <p key={index} className="text-sm text-gray-600 dark:text-gray-300">
            {metric}
          </p>
        ))}
      </div>

      {selectedCard === testId && details && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {details}
          </p>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded mb-1"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4", className)}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-red-800 dark:text-red-200">
              स्वास्थ्य स्थिति लोड करने में असमर्थ
            </h3>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">
              {error}
            </p>
          </div>
          <button
            onClick={fetchHealthData}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label="पुनः प्रयास करें"
          >
            पुनः प्रयास
          </button>
        </div>
      </div>
    );
  }

  if (!healthData) {
    return (
      <div className={cn("text-center py-8", className)}>
        <p className="text-gray-500 dark:text-gray-400">कोई स्वास्थ्य डेटा उपलब्ध नहीं</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          सिस्टम स्वास्थ्य अवलोकन
        </h2>
        <button
          onClick={fetchHealthData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="स्वास्थ्य डेटा रिफ्रेश करें"
        >
          रिफ्रेश
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Database Health */}
        {healthData.services?.database && (
          <HealthCard
            title="Database Connection"
            status={healthData.services.database.status}
            metrics={[
              `स्थिति: ${getStatusText(healthData.services.database.status)}`,
              `Latency: ${healthData.services.database.latency || 'N/A'}ms`,
              `Connection Pool: ${healthData.services.database.connection_pool || 'N/A'}`
            ]}
            details="PostgreSQL database connection status and performance metrics"
            testId="database"
          />
        )}

        {/* API Chain Health */}
        <HealthCard
          title="API Chain Health"
          status={healthData.status}
          metrics={[
            `स्थिति: ${getStatusText(healthData.status)}`,
            `Twitter API: ${getStatusText(healthData.services?.twitter_api?.status || 'unknown')}`,
            `Gemini API: ${getStatusText(healthData.services?.gemini_api?.status || 'unknown')}`,
            `Ollama API: ${getStatusText(healthData.services?.ollama_api?.status || 'unknown')}`
          ]}
          details="Complete API chain health: Fetch → Parse → Review → Analytics"
          testId="api-chain"
        />

        {/* Frontend Build Health */}
        {healthData.frontend && (
          <HealthCard
            title="Frontend Build"
            status={healthData.frontend.build_status === 'success' ? 'healthy' : 'unhealthy'}
            metrics={[
              `Build Status: ${healthData.frontend.build_status}`,
              `Bundle Size: ${healthData.frontend.bundle_size}`,
              `Last Build: ${new Date(healthData.frontend.last_build).toLocaleString('hi-IN')}`
            ]}
            details="Next.js build status and performance metrics"
            testId="frontend"
          />
        )}

        {/* Backend Service Health */}
        <HealthCard
          title="Backend Service"
          status={healthData.status}
          metrics={[
            `स्थिति: ${getStatusText(healthData.status)}`,
            `Uptime: ${healthData.uptime_seconds ? formatUptime(healthData.uptime_seconds) : 'N/A'}`,
            `Version: ${healthData.version || 'N/A'}`
          ]}
          details="Backend service uptime and version information"
          testId="backend"
        />
      </div>
    </div>
  );
};

export default SystemHealthCards;
