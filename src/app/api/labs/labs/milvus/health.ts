import type { NextApiRequest, NextApiResponse } from 'next';

type HealthStatus = {
  status: 'ok' | 'error';
  details?: string;
};

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
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthStatus>
) {
  // Per the execution plan, Milvus is a deferred fallback.
  // This health check currently returns a static 'ok'.
  // The logic can be expanded if/when Milvus is actively used.
  
  // [M-API-8] Structured logging
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    traceId: req.headers['x-trace-id'] || 'local-dev',
    service: 'milvus-health-check',
    method: req.method,
    url: req.url,
    responseStatus: 200,
    message: 'Milvus health check successful (static response).',
  }));

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ status: 'ok' });
}
