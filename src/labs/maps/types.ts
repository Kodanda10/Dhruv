/**
 * Map Types
 * 
 * Type definitions for map data (no database imports)
 */

export interface MapEvent {
  id: string;
  tweet_id: string;
  event_type: string;
  event_date: string | null;
  locations: any[];
  lat?: number;
  lng?: number;
  location_name?: string;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id: string;
    tweet_id: string;
    event_type: string;
    event_date: string | null;
    location_name: string;
    count?: number;
  };
}

export interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

