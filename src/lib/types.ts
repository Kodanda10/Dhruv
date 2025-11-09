export interface AnalyticsData {
  total_tweets: number;
  event_distribution: Record<string, number>;
  location_distribution: Record<string, number>;
  scheme_usage: Record<string, number>;
  timeline: { date: string; count: number }[];
  day_of_week: Record<string, number>;
  caste_community: Record<string, number>;
  target_groups: Record<string, number>;
  thematic_analysis: Record<string, number>;
  raigarh_section: {
    coverage_percentage: number;
    local_events: {
      date: string;
      location: string;
      type: string;
      description: string;
    }[];
    community_data: Record<string, number>;
    engagement_metrics: {
      total_likes: number;
      total_retweets: number;
      total_replies: number;
    };
  };
}

export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  location?: string;
}

export type TagRow = {
  label_hi: string | null;
  label_en: string | null;
  slug: string | null;
  count: number;
};

export type RaigarhEventRow = {
  event_date: string | null;
  event_type: string | null;
  text: string | null;
  location_name: string | null;
  district: string | null;
};
