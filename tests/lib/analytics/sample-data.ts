import { AnalyticsData } from '@/lib/analytics/data-source';

export const sampleAnalyticsData: AnalyticsData = {
  total_tweets: 2504,
  event_distribution: {
    'विकास कार्य': 485,
    'निरीक्षण': 111,
    'रैली': 93,
  },
  location_distribution: {
    'रायगढ़': 120,
    'कोरबा': 75,
    'रायपुर': 60,
  },
  scheme_usage: {
    'प्रधानमंत्री आवास योजना': 88,
    'जल जीवन मिशन': 64,
  },
  timeline: [
    { date: '2025-10-10', count: 25 },
    { date: '2025-10-11', count: 35 },
  ],
  day_of_week: {
    'सोमवार': 30,
    'मंगलवार': 45,
  },
  caste_community: {
    'साहू समाज': 14,
    'यादव समाज': 10,
  },
  target_groups: {
    'महिला': 45,
    'युवा': 67,
    'किसान': 34,
    'वरिष्ठ नागरिक': 23,
  },
  thematic_analysis: {
    'रोज़गार': 120,
    'शिक्षा': 80,
  },
  raigarh_section: {
    coverage_percentage: 36,
    local_events: [
      {
        date: '2025-10-09',
        location: 'खरसिया',
        type: 'दौरा',
        description: 'ग्राम दौरे में विकास कार्यों की समीक्षा',
      },
      {
        date: '2025-10-08',
        location: 'बरमकेला',
        type: 'जनसंवाद',
        description: 'नागरिकों के साथ संवाद कार्यक्रम',
      },
    ],
    community_data: {
      'रायगढ़ समाज': 14,
      'तेली समाज': 9,
    },
    engagement_metrics: {
      total_likes: 87939,
      total_retweets: 17451,
      total_replies: 17542,
    },
  },
};
