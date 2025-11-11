import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock data
const mockTweets = [
  {
    id: 'demo-1',
    tweet_id: '111',
    tweet_created_at: '2025-09-01T10:00:00Z',
    tweet_text: 'रायगढ़ विकास यात्रा का प्रथम पड़ाव #समारोह @PMOIndia',
    event_type: 'tour',
    event_type_confidence: 0.92,
    locations: [{ name: 'रायगढ़', district: 'रायगढ़' }],
    people_mentioned: ['@PMOIndia', 'ओपी चौधरी'],
    organizations: ['टीम विकास', 'समारोह कोर टीम'],
    schemes_mentioned: ['समारोह उत्थान मिशन'],
    overall_confidence: 0.9,
    needs_review: false,
    review_status: 'approved',
  },
];

const mockLocations = [
  { lat: 22.17, lng: 83.38, name: 'Raigarh' },
  { lat: 22.0, lng: 83.0, name: 'Another Place' },
];

const mockFaissCandidates = [
  { id: '1', name: 'Raigarh', score: 0.98, hierarchy: 'Raigarh › Pusaur › Raigarh' },
  { id: '2', name: 'Raigarh District', score: 0.95, hierarchy: 'Raigarh District › Raigarh' },
];

const mockGraph = {
  nodes: [
    { id: 'person-1', group: 'person', name: 'ओ.पी. चौधरी' },
    { id: 'event-1', group: 'event', name: 'जनसभा' },
  ],
  links: [
    { source: 'person-1', target: 'event-1', value: 1 },
  ],
};

// Define handlers
export const handlers = [
  http.get('/api/parsed-events', () => {
    return HttpResponse.json({
      success: true,
      events: mockTweets,
      count: mockTweets.length,
      total: mockTweets.length,
      total_op_choudhary: mockTweets.length,
    });
  }),

  http.get('/api/analytics/locations', () => {
    return HttpResponse.json({ success: true, locations: mockLocations });
  }),

  http.get('/api/labs/faiss/search', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q');
    if (q?.includes('बरमपुर')) {
      return HttpResponse.json([
        { id: '1', name: 'बरमपुर › पुसौर › रायगढ़', score: 0.98 },
        { id: '2', name: 'बरमपुर', score: 0.95 },
      ]);
    }
    return HttpResponse.json([]);
  }),

  http.post('/api/labs/ai/assist', async ({ request }) => {
    const body = await request.json() as any;
    if (body.text?.includes('protest')) {
      return HttpResponse.json({
        success: true,
        suggestions: {
          event_type: 'Protest',
          event_type_confidence: 0.85,
          locations: ['City Hall'],
          reasoning: 'The text mentions a gathering and demands.',
        },
      });
    }
    return HttpResponse.json({ success: true, suggestions: {} });
  }),

  http.post('/api/labs/learning/run', () => {
    return HttpResponse.json({ message: 'Learning job started successfully.' });
  }),

  http.get('/api/labs/mindmap/graph', () => {
    return HttpResponse.json(mockGraph);
  }),
];

// Setup server
export const server = setupServer(...handlers);
export { http, HttpResponse };