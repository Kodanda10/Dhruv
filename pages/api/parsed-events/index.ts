import { NextApiRequest, NextApiResponse } from 'next';

// Sample data for demonstration
const sampleTweets = [
  {
    id: 'sample_1',
    tweet_id: 'sample_1',
    timestamp: '2025-11-05T10:00:00Z',
    content: 'रायगढ़ में मुख्यमंत्री का दौरा - विकास कार्यों की समीक्षा',
    text: 'रायगढ़ में मुख्यमंत्री का दौरा - विकास कार्यों की समीक्षा',
    event_type: 'tour',
    event_type_hi: 'दौरा',
    event_type_confidence: 0.9,
    needs_review: false,
    review_status: 'approved',
    parsed_by: 'sample_data',
    parsed_at: '2025-11-05T10:00:00Z',
    locations: [{ name: 'रायगढ़', confidence: 0.95 }],
    people_mentioned: ['मुख्यमंत्री'],
    organizations: [],
    schemes_mentioned: ['विकास कार्य'],
    overall_confidence: 0.85
  },
  {
    id: 'sample_2',
    tweet_id: 'sample_2',
    timestamp: '2025-11-04T14:30:00Z',
    content: 'श्री ओ.पी. चौधरी जी का जन्मदिन - राज्यवासियों की शुभकामनाएं',
    text: 'श्री ओ.पी. चौधरी जी का जन्मदिन - राज्यवासियों की शुभकामनाएं',
    event_type: 'birthday_wishes',
    event_type_hi: 'जन्मदिन शुभकामनाएं',
    event_type_confidence: 0.95,
    needs_review: false,
    review_status: 'approved',
    parsed_by: 'sample_data',
    parsed_at: '2025-11-04T14:30:00Z',
    locations: [],
    people_mentioned: ['ओ.पी. चौधरी'],
    organizations: [],
    schemes_mentioned: [],
    overall_confidence: 0.92
  },
  {
    id: 'sample_3',
    tweet_id: 'sample_3',
    timestamp: '2025-11-03T09:15:00Z',
    content: 'मुख्यमंत्री कार्यालय में पत्रकार वार्ता संपन्न',
    text: 'मुख्यमंत्री कार्यालय में पत्रकार वार्ता संपन्न',
    event_type: 'press_conference',
    event_type_hi: 'प्रेस वार्ता',
    event_type_confidence: 0.88,
    needs_review: true,
    review_status: 'pending',
    parsed_by: 'sample_data',
    parsed_at: '2025-11-03T09:15:00Z',
    locations: [{ name: 'मुख्यमंत्री कार्यालय', confidence: 0.8 }],
    people_mentioned: [],
    organizations: [],
    schemes_mentioned: [],
    overall_confidence: 0.78
  }
];

interface ParsedEventsResponse {
  success: boolean;
  source: string;
  total: number;
  data: typeof sampleTweets;
  events: typeof sampleTweets;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ParsedEventsResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      source: 'api',
      total: 0,
      data: [],
      events: []
    });
  }

  try {
    // Get query parameters
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 100); // Limit to 100 for sample data
    const needsReview = req.query.needs_review === 'true';
    const reviewStatus = req.query.review_status as string;
    const analyticsMode = req.query.analytics === 'true';

    let filteredTweets = [...sampleTweets];

    // Apply filters
    if (needsReview !== undefined) {
      filteredTweets = filteredTweets.filter(tweet => tweet.needs_review === needsReview);
    }

    if (reviewStatus) {
      filteredTweets = filteredTweets.filter(tweet => tweet.review_status === reviewStatus);
    }

    // Limit results
    filteredTweets = filteredTweets.slice(0, limit);

    return res.status(200).json({
      success: true,
      source: 'sample_api',
      total: filteredTweets.length,
      data: filteredTweets,
      events: filteredTweets
    });

  } catch (error) {
    console.error('Parsed events API error:', error);
    return res.status(500).json({
      success: false,
      source: 'error',
      total: 0,
      data: [],
      events: []
    });
  }
}
