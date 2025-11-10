/**
 * Map Data Module
 * 
 * Pulls real event locations from database and transforms to GeoJSON format
 */

import { getDbPool } from '@/lib/db/pool';
import type { MapEvent, GeoJSONFeature, GeoJSONData } from './types';

export type { MapEvent, GeoJSONFeature, GeoJSONData };

/**
 * Fetch event locations from database
 */
export async function fetchMapEvents(): Promise<MapEvent[]> {
  const pool = getDbPool();

  try {
    const result = await pool.query(`
      SELECT 
        pe.id,
        pe.tweet_id,
        pe.event_type,
        pe.event_date,
        pe.locations,
        rt.created_at
      FROM parsed_events pe
      JOIN raw_tweets rt ON rt.tweet_id = pe.tweet_id
      WHERE pe.review_status IN ('approved', 'edited')
        AND pe.locations IS NOT NULL
        AND cardinality(pe.locations) > 0
      ORDER BY rt.created_at DESC
      LIMIT 500
    `);

    return result.rows.map((row) => ({
      id: String(row.id),
      tweet_id: row.tweet_id,
      event_type: row.event_type || 'other',
      event_date: row.event_date ? new Date(row.event_date).toISOString() : null,
      locations: Array.isArray(row.locations) ? row.locations : [],
    }));
  } catch (error) {
    console.error('Failed to fetch map events:', error);
    return [];
  }
}

/**
 * Transform events to GeoJSON format
 * Note: This is a simplified version - in production, you'd geocode location names
 */
export function transformToGeoJSON(events: MapEvent[]): GeoJSONData {
  const features: GeoJSONFeature[] = [];

  // Group events by location for clustering
  const locationMap = new Map<string, MapEvent[]>();

  for (const event of events) {
    if (event.locations && event.locations.length > 0) {
      for (const loc of event.locations) {
        const locationName = typeof loc === 'string' ? loc : (loc.name || loc.name_en || 'Unknown');
        if (!locationMap.has(locationName)) {
          locationMap.set(locationName, []);
        }
        locationMap.get(locationName)!.push(event);
      }
    }
  }

  // Create features (simplified - using approximate coordinates)
  // In production, you'd geocode location names to get lat/lng
  let featureIndex = 0;
  for (const [locationName, locationEvents] of locationMap.entries()) {
    // Approximate coordinates for Chhattisgarh (center)
    // In production, use geocoding service
    const lat = 21.2514 + (Math.random() - 0.5) * 2; // Approximate spread
    const lng = 81.6296 + (Math.random() - 0.5) * 2;

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      properties: {
        id: `feature-${featureIndex++}`,
        tweet_id: locationEvents[0].tweet_id,
        event_type: locationEvents[0].event_type,
        event_date: locationEvents[0].event_date,
        location_name: locationName,
        count: locationEvents.length,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Get map statistics
 */
export async function getMapStats(): Promise<{
  totalEvents: number;
  uniqueLocations: number;
  clusters: number;
}> {
  const events = await fetchMapEvents();
  const geoJson = transformToGeoJSON(events);

  const uniqueLocations = new Set(
    events.flatMap(e => e.locations.map(l => typeof l === 'string' ? l : (l.name || l.name_en || '')))
  ).size;

  return {
    totalEvents: events.length,
    uniqueLocations,
    clusters: geoJson.features.length,
  };
}

