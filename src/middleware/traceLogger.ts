/**
 * Trace Logger Middleware
 * Phase 8.1: Trace ID System Implementation
 * Generates trace IDs and logs all requests with trace metadata
 */

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export interface TraceLog {
  trace_id: string;
  timestamp: string;
  latency_ms: number;
  status_code: number;
  component: string;
  endpoint: string;
  method: string;
  error_message?: string;
}

// In-memory trace store (in production, use Redis or database)
const traceStore: TraceLog[] = [];

// Keep only last 1000 traces
function addTrace(trace: TraceLog) {
  traceStore.push(trace);
  if (traceStore.length > 1000) {
    traceStore.shift();
  }
}

export function getTraces(limit: number = 100): TraceLog[] {
  return traceStore.slice(-limit);
}

export function getTracesByComponent(component: string, limit: number = 100): TraceLog[] {
  return traceStore.filter((t) => t.component === component).slice(-limit);
}

export function getTraceById(traceId: string): TraceLog | undefined {
  return traceStore.find((t) => t.trace_id === traceId);
}

export function traceMiddleware(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const traceId = randomUUID();
    const startTime = Date.now();
    const component = req.nextUrl.pathname.split('/')[2] || 'unknown';
    const endpoint = req.nextUrl.pathname;
    const method = req.method;

    try {
      const response = await handler(req);
      const latency = Date.now() - startTime;

      // Record trace
      addTrace({
        trace_id: traceId,
        timestamp: new Date().toISOString(),
        latency_ms: latency,
        status_code: response.status,
        component,
        endpoint,
        method,
      });

      // Add trace ID to response headers
      response.headers.set('X-Trace-Id', traceId);
      response.headers.set('X-Latency-Ms', latency.toString());

      // Record metric for telemetry dashboard
      try {
        await fetch(`${req.nextUrl.origin}/api/system/telemetry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint,
            latency,
            success: response.status < 400,
          }),
        });
      } catch {
        // Ignore telemetry recording errors
      }

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;

      // Record error trace
      addTrace({
        trace_id: traceId,
        timestamp: new Date().toISOString(),
        latency_ms: latency,
        status_code: 500,
        component,
        endpoint,
        method,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      // Re-throw error
      throw error;
    }
  };
}


