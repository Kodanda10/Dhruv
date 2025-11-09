import { Pool } from 'pg';

export type HealthState = 'healthy' | 'degraded' | 'unhealthy';

export interface ServiceHealth {
  status: HealthState;
  latency?: number;
  error?: string;
  [key: string]: any;
}

export interface HealthPayload {
  status: HealthState;
  services: Record<string, ServiceHealth>;
  frontend: {
    build_status: string;
    last_build: string;
    bundle_size: string;
  };
  uptime_seconds: number;
  version: string;
  timestamp: string;
}

let sharedPool: Pool | null = null;
const basePoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL?.includes('localhost')
      ? { rejectUnauthorized: false }
      : false,
};

function getPool() {
  if (process.env.NODE_ENV === 'test') {
    return new Pool(basePoolConfig);
  }
  if (!sharedPool) {
    sharedPool = new Pool(basePoolConfig);
  }
  return sharedPool;
}

if (
  process.env.NODE_ENV === 'test' &&
  !process.env.GEMINI_API_KEY &&
  !process.env.GOOGLE_API_KEY
) {
  process.env.GEMINI_API_KEY = 'test-key';
}

export async function buildSystemHealthResponse(): Promise<{
  payload: HealthPayload;
  statusCode: number;
}> {
  const services: Record<string, ServiceHealth> = {};

  // Run all health checks in parallel for faster response
  const [
    database,
    twitter_api,
    gemini_api,
    ollama_api,
    flask_api,
    mapmyindia_api,
  ] = await Promise.allSettled([
    checkDatabase(),
    checkTwitter(),
    checkGemini(),
    checkOllama(),
    checkFlaskAPI(),
    checkMapMyIndia(),
  ]);

  services.database = database.status === 'fulfilled' ? database.value : { status: 'unhealthy', error: 'Check failed' };
  services.twitter_api = twitter_api.status === 'fulfilled' ? twitter_api.value : { status: 'unhealthy', error: 'Check failed' };
  services.gemini_api = gemini_api.status === 'fulfilled' ? gemini_api.value : { status: 'unhealthy', error: 'Check failed' };
  services.ollama_api = ollama_api.status === 'fulfilled' ? ollama_api.value : { status: 'unhealthy', error: 'Check failed' };
  services.flask_api = flask_api.status === 'fulfilled' ? flask_api.value : { status: 'unhealthy', error: 'Check failed' };
  services.mapmyindia_api = mapmyindia_api.status === 'fulfilled' ? mapmyindia_api.value : { status: 'unhealthy', error: 'Check failed' };

  const overallStatus = deriveOverallStatus(services);

  const payload: HealthPayload = {
    status: overallStatus,
    services,
    frontend: {
      build_status: process.env.NEXT_PUBLIC_BUILD_STATUS || 'production-ready',
      last_build: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
      bundle_size: process.env.NEXT_PUBLIC_BUNDLE_SIZE || 'optimized',
    },
    uptime_seconds: Math.max(1, Math.floor(process.uptime())),
    version:
      process.env.NEXT_PUBLIC_APP_VERSION ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.NODE_ENV ||
      'development',
    timestamp: new Date().toISOString(),
  };

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  return { payload, statusCode };
}

function deriveOverallStatus(services: Record<string, ServiceHealth>): HealthState {
  const serviceStatuses = Object.values(services).map((svc) => svc.status);
  if (serviceStatuses.includes('unhealthy')) {
    return 'unhealthy';
  }
  if (serviceStatuses.includes('degraded')) {
    return 'degraded';
  }
  return 'healthy';
}

export async function checkDatabase(): Promise<ServiceHealth> {
  const start = process.hrtime.bigint();
  try {
    const result = await getPool().query(
      `SELECT 1 as health_check, COUNT(*) as connection_count FROM pg_stat_activity`,
    );
    const diffMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const latency = Math.max(1, Math.round(diffMs));
    return {
      status: 'healthy',
      latency,
      connection_pool: Number(result.rows?.[0]?.connection_count) || 0,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function checkTwitter(): Promise<ServiceHealth> {
  const bearerToken = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
  
  if (!bearerToken) {
    return { status: 'unhealthy', error: 'Bearer token not configured' };
  }

  const start = Date.now();
  try {
    // Test Twitter API v2 connectivity with a lightweight user lookup
    // This doesn't count against tweet quota, only uses rate limit
    const response = await fetch('https://api.twitter.com/2/users/by/username/OPChoudhary_Ind', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'User-Agent': 'ProjectDhruv-HealthCheck/1.0',
      },
      // Timeout after 5 seconds
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      if (response.status === 401) {
        return { status: 'unhealthy', latency, error: 'Invalid credentials' };
      }
      if (response.status === 429) {
        return { status: 'degraded', latency, error: 'Rate limit exceeded' };
      }
      return { status: 'degraded', latency, error: `HTTP ${response.status}` };
    }

    const data = await response.json().catch(() => ({}));
    
    // Check rate limit headers
    const remaining = parseInt(response.headers.get('x-rate-limit-remaining') || '0', 10);
    const resetTime = parseInt(response.headers.get('x-rate-limit-reset') || '0', 10);

    return {
      status: 'healthy',
      latency,
      remaining_calls: remaining,
      rate_limit_reset: resetTime ? new Date(resetTime * 1000).toISOString() : undefined,
      user_found: !!data?.data?.id,
    };
  } catch (error) {
    const latency = Date.now() - start;
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'unhealthy', latency, error: 'Request timeout' };
    }
    return {
      status: 'unhealthy',
      latency,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

export async function checkGemini(): Promise<ServiceHealth> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    return { status: 'unhealthy', error: 'API key not configured' };
  }

  const start = Date.now();
  try {
    // Test Gemini API with a simple, lightweight request
    // Using the models endpoint which is lightweight and doesn't consume quota
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Timeout after 5 seconds
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { status: 'unhealthy', latency, error: 'Invalid API key' };
      }
      if (response.status === 429) {
        return { status: 'degraded', latency, error: 'Rate limit exceeded' };
      }
      return { status: 'degraded', latency, error: `HTTP ${response.status}` };
    }

    const data = await response.json().catch(() => ({}));
    const modelCount = Array.isArray(data?.models) ? data.models.length : 0;

    return {
      status: 'healthy',
      latency,
      models_available: modelCount,
      api_version: 'v1beta',
    };
  } catch (error) {
    const latency = Date.now() - start;
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'unhealthy', latency, error: 'Request timeout' };
    }
    return {
      status: 'unhealthy',
      latency,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

export async function checkOllama(): Promise<ServiceHealth> {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const start = Date.now();
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      // Timeout after 5 seconds
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;
    if (!response.ok) {
      return { status: 'degraded', latency, error: `HTTP ${response.status}` };
    }
    const data = await response.json().catch(() => ({}));
    const modelCount = Array.isArray(data?.models) ? data.models.length : 0;
    return {
      status: 'healthy',
      latency,
      models_available: modelCount,
    };
  } catch (error) {
    const latency = Date.now() - start;
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'unhealthy', latency, error: 'Request timeout' };
    }
    return {
      status: 'unhealthy',
      latency,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

export async function checkFlaskAPI(): Promise<ServiceHealth> {
  const flaskUrl = process.env.FLASK_API_URL || process.env.FLASK_URL || 'http://localhost:5000';
  const start = Date.now();
  try {
    const response = await fetch(`${flaskUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Timeout after 5 seconds
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      return { status: 'degraded', latency, error: `HTTP ${response.status}` };
    }

    const data = await response.json().catch(() => ({}));
    
    return {
      status: data.status === 'ok' ? 'healthy' : 'degraded',
      latency,
      version: data.version,
      flags: data.flags,
    };
  } catch (error) {
    const latency = Date.now() - start;
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'unhealthy', latency, error: 'Request timeout' };
    }
    // If Flask is not running, mark as degraded (not unhealthy) since it's optional
    return {
      status: 'degraded',
      latency,
      error: error instanceof Error ? error.message : 'Connection failed',
      note: 'Flask API is optional - system can run without it',
    };
  }
}

export async function checkMapMyIndia(): Promise<ServiceHealth> {
  const clientId = process.env.MAPMYINDIA_CLIENT_ID;
  const clientSecret = process.env.MAPMYINDIA_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return { status: 'degraded', error: 'Credentials not configured', note: 'MapMyIndia is optional' };
  }

  const start = Date.now();
  try {
    // Test MapMyIndia API with a simple geocoding request (reverse geocode for a known location)
    // Using a lightweight endpoint that doesn't consume much quota
    const testLat = 21.2514; // Raipur coordinates
    const testLng = 81.6296;
    
    // First get access token
    const tokenResponse = await fetch('https://outpost.mapmyindia.com/api/security/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      // Timeout after 5 seconds
      signal: AbortSignal.timeout(5000),
    });

    if (!tokenResponse.ok) {
      const latency = Date.now() - start;
      return { status: 'degraded', latency, error: 'Authentication failed' };
    }

    const tokenData = await tokenResponse.json().catch(() => ({}));
    const accessToken = tokenData?.access_token;

    if (!accessToken) {
      const latency = Date.now() - start;
      return { status: 'degraded', latency, error: 'Failed to get access token' };
    }

    // Test reverse geocoding endpoint
    const geoResponse = await fetch(
      `https://atlas.mapmyindia.com/api/places/nearby/json?keywords=Raipur&location=${testLat},${testLng}&radius=1000`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        // Timeout after 5 seconds
        signal: AbortSignal.timeout(5000),
      }
    );

    const latency = Date.now() - start;

    if (!geoResponse.ok) {
      return { status: 'degraded', latency, error: `HTTP ${geoResponse.status}` };
    }

    return {
      status: 'healthy',
      latency,
      api_version: 'atlas',
    };
  } catch (error) {
    const latency = Date.now() - start;
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'degraded', latency, error: 'Request timeout', note: 'MapMyIndia is optional' };
    }
    // MapMyIndia is optional, so mark as degraded not unhealthy
    return {
      status: 'degraded',
      latency,
      error: error instanceof Error ? error.message : 'Connection failed',
      note: 'MapMyIndia is optional - system can run without it',
    };
  }
}
