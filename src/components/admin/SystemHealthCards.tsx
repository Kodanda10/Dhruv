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
    flask_api?: HealthService;
    mapmyindia_api?: HealthService;
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
        "glassmorphic-card p-4 cursor-pointer border border-white/10",
        "hover:border-[#8BF5E6]/30 hover:shadow-[0_0_15px_rgba(139,245,230,0.2)] transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-[#8BF5E6]/50"
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
        <h3 className="text-lg font-semibold text-white">
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
          <p key={index} className="text-sm text-secondary">
            {metric}
          </p>
        ))}
      </div>

      {selectedCard === testId && details && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-sm text-muted">
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
          <div key={i} className="glassmorphic-card p-4 animate-pulse">
            <div className="h-4 bg-white/10 rounded mb-2"></div>
            <div className="h-3 bg-white/10 rounded mb-1"></div>
            <div className="h-3 bg-white/10 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("glassmorphic-card border border-red-500/30 p-4", className)}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-red-300">
              स्वास्थ्य स्थिति लोड करने में असमर्थ
            </h3>
            <p className="text-sm text-red-400 mt-1">
              {error}
            </p>
          </div>
          <button
            onClick={fetchHealthData}
            className="neon-button px-3 py-1 rounded focus:outline-none"
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
        <p className="text-secondary">कोई स्वास्थ्य डेटा उपलब्ध नहीं</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          सिस्टम स्वास्थ्य अवलोकन
        </h2>
        <button
          onClick={fetchHealthData}
          className="neon-button px-4 py-2 rounded focus:outline-none"
          aria-label="स्वास्थ्य डेटा रिफ्रेश करें"
        >
          रिफ्रेश
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

        {/* Twitter API Health */}
        {healthData.services?.twitter_api && (
          <HealthCard
            title="Twitter API"
            status={healthData.services.twitter_api.status}
            metrics={[
              `स्थिति: ${getStatusText(healthData.services.twitter_api.status)}`,
              `Latency: ${healthData.services.twitter_api.latency || 'N/A'}ms`,
              healthData.services.twitter_api.remaining_calls !== undefined
                ? `Rate Limit: ${healthData.services.twitter_api.remaining_calls} remaining`
                : healthData.services.twitter_api.error || 'Connected'
            ]}
            details={healthData.services.twitter_api.user_found 
              ? "Twitter API v2 connectivity verified - user lookup successful"
              : "Twitter API connectivity and rate limit status"}
            testId="twitter-api"
          />
        )}

        {/* Gemini API Health */}
        {healthData.services?.gemini_api && (
          <HealthCard
            title="Gemini API"
            status={healthData.services.gemini_api.status}
            metrics={[
              `स्थिति: ${getStatusText(healthData.services.gemini_api.status)}`,
              `Latency: ${healthData.services.gemini_api.latency || 'N/A'}ms`,
              healthData.services.gemini_api.models_available !== undefined
                ? `Models: ${healthData.services.gemini_api.models_available} available`
                : healthData.services.gemini_api.error || 'Connected'
            ]}
            details="Google Gemini API connectivity and model availability"
            testId="gemini-api"
          />
        )}

        {/* Ollama API Health */}
        {healthData.services?.ollama_api && (
          <HealthCard
            title="Ollama API"
            status={healthData.services.ollama_api.status}
            metrics={[
              `स्थिति: ${getStatusText(healthData.services.ollama_api.status)}`,
              `Latency: ${healthData.services.ollama_api.latency || 'N/A'}ms`,
              healthData.services.ollama_api.models_available !== undefined
                ? `Models: ${healthData.services.ollama_api.models_available} available`
                : healthData.services.ollama_api.error || 'Connected'
            ]}
            details="Ollama local AI service connectivity and model availability"
            testId="ollama-api"
          />
        )}

        {/* Flask API Health */}
        {healthData.services?.flask_api && (
          <HealthCard
            title="Flask API Server"
            status={healthData.services.flask_api.status}
            metrics={[
              `स्थिति: ${getStatusText(healthData.services.flask_api.status)}`,
              `Latency: ${healthData.services.flask_api.latency || 'N/A'}ms`,
              healthData.services.flask_api.note || healthData.services.flask_api.error || 'Connected'
            ]}
            details={healthData.services.flask_api.note || "Flask API server health and status"}
            testId="flask-api"
          />
        )}

        {/* MapMyIndia API Health */}
        {healthData.services?.mapmyindia_api && (
          <HealthCard
            title="MapMyIndia API"
            status={healthData.services.mapmyindia_api.status}
            metrics={[
              `स्थिति: ${getStatusText(healthData.services.mapmyindia_api.status)}`,
              `Latency: ${healthData.services.mapmyindia_api.latency || 'N/A'}ms`,
              healthData.services.mapmyindia_api.note || healthData.services.mapmyindia_api.error || 'Connected'
            ]}
            details={healthData.services.mapmyindia_api.note || "MapMyIndia geocoding API connectivity"}
            testId="mapmyindia-api"
          />
        )}

        {/* API Chain Health */}
        <HealthCard
          title="API Chain Health"
          status={healthData.status}
          metrics={[
            `Overall: ${getStatusText(healthData.status)}`,
            `Twitter: ${getStatusText(healthData.services?.twitter_api?.status || 'unknown')}`,
            `Gemini: ${getStatusText(healthData.services?.gemini_api?.status || 'unknown')}`,
            `Ollama: ${getStatusText(healthData.services?.ollama_api?.status || 'unknown')}`
          ]}
          details="Complete API chain health: Fetch → Parse → Review → Analytics"
          testId="api-chain"
        />

        {/* Frontend Build Health */}
        {healthData.frontend && (
          <HealthCard
            title="Frontend Build"
            status={healthData.frontend.build_status === 'success' || healthData.frontend.build_status === 'production-ready' ? 'healthy' : 'degraded'}
            metrics={[
              `Status: ${healthData.frontend.build_status}`,
              `Bundle: ${healthData.frontend.bundle_size}`,
              `Build: ${healthData.frontend.last_build.substring(0, 8)}...`
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
