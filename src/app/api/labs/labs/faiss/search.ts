import type { NextApiRequest, NextApiResponse } from 'next';
import { search, FaissSearchResult } from '@/labs/faiss/search'; // Import the search function

type ErrorResponse = {
  error: string;
};

/**
 * @swagger
 * /api/labs/faiss/search:
 *   get:
 *     summary: FAISS Vector Search
 *     description: Performs a semantic search using a FAISS index for a given query.
 *     tags:
 *       - Labs
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: The search query string.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: The maximum number of results to return.
 *     responses:
 *       200:
 *         description: Search results.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   score:
 *                     type: number
 *       400:
 *         description: Bad Request, query parameter is missing.
 *       500:
 *         description: Internal Server Error.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FaissSearchResult[] | ErrorResponse>
) {
  const { q, limit } = req.query;

  // [F-API-9] Structured logging for the request
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    traceId: req.headers['x-trace-id'] || 'local-dev',
    service: 'faiss-search',
    method: req.method,
    url: req.url,
    query: req.query,
    message: 'Received FAISS search request.',
  }));

  // [F-API-3] Validate that 'q' is a non-empty string
  if (typeof q !== 'string' || q.trim() === '') {
    return res.status(400).json({ error: 'Query parameter "q" is required.' });
  }

  const parsedLimit = parseInt(limit as string, 10) || 5;

  try {
    const results = await search(q, parsedLimit); // Call the search function
    res.status(200).json(results);
  } catch (error: any) {
    // [F-API-6] Handle errors from the search function
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      traceId: req.headers['x-trace-id'] || 'local-dev',
      service: 'faiss-search',
      method: req.method,
      url: req.url,
      query: req.query,
      error: error.message,
      stack: error.stack,
      message: 'Error during FAISS search.',
    }));
    res.status(500).json({ error: 'An error occurred during the search.' });
  }
}