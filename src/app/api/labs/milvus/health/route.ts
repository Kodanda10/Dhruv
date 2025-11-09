import { NextResponse } from 'next/server';

/**
 * @swagger
 * /api/labs/milvus/health:
 *   get:
 *     summary: Milvus Health Check
 *     description: Returns the health status of the Milvus fallback service. Currently returns a static 'ok' as Milvus is deferred.
 *     tags:
 *       - Labs
 *     responses:
 *       200:
 *         description: Service is healthy.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
export async function GET(request: Request) {
  // Per the execution plan, Milvus is a deferred fallback.
  // This health check currently returns a static 'ok'.
  
  // [M-API-8] Structured logging
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    traceId: request.headers.get('x-trace-id') || 'local-dev',
    service: 'milvus-health-check',
    method: request.method,
    url: request.url,
    responseStatus: 200,
    message: 'Milvus health check successful (static response).',
  }));

  return NextResponse.json({ status: 'ok' });
}