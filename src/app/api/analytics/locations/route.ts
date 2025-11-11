import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

interface EventLocation {
  lat: number;
  lng: number;
  name: string;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Fetch unique locations from parsed events
    const locationQuery = `
      SELECT DISTINCT
        TRIM((loc->>'name')::text) AS location_name,
        TRIM((loc->>'district')::text) AS district,
        COUNT(*)::INT AS event_count
      FROM parsed_events pe
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pe.locations, '[]'::jsonb)) AS loc
      WHERE loc->>'name' IS NOT NULL
        AND TRIM((loc->>'name')::text) != ''
      GROUP BY location_name, district
      ORDER BY event_count DESC
      LIMIT 100
    `;

    const result = await db.query(locationQuery);

    // Geocode locations to get coordinates
    const locations: EventLocation[] = [];

    for (const row of result.rows) {
      const locationName = row.location_name;
      const district = row.district;

      try {
        // Use MapMyIndia geocoding API
        const geocodeQuery = `${locationName}${district ? `, ${district}` : ''}, Chhattisgarh, India`;
        const encodedQuery = encodeURIComponent(geocodeQuery);

        const geocodeResponse = await fetch(
          `https://atlas.mapmyindia.com/api/places/geocode?address=${encodedQuery}&region=ind&itemCount=1&clientId=${process.env.MAPMYINDIA_CLIENT_ID}&clientSecret=${process.env.MAPMYINDIA_CLIENT_SECRET}`
        );

        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json();

          if (geocodeData.copResults && geocodeData.copResults.length > 0) {
            const place = geocodeData.copResults[0];
            locations.push({
              lat: parseFloat(place.lat),
              lng: parseFloat(place.lng),
              name: locationName,
            });
          } else {
            // Fallback: Try without district
            const fallbackQuery = `${locationName}, Chhattisgarh, India`;
            const fallbackEncoded = encodeURIComponent(fallbackQuery);

            const fallbackResponse = await fetch(
              `https://atlas.mapmyindia.com/api/places/geocode?address=${fallbackEncoded}&region=ind&itemCount=1&clientId=${process.env.MAPMYINDIA_CLIENT_ID}&clientSecret=${process.env.MAPMYINDIA_CLIENT_SECRET}`
            );

            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              if (fallbackData.copResults && fallbackData.copResults.length > 0) {
                const place = fallbackData.copResults[0];
                locations.push({
                  lat: parseFloat(place.lat),
                  lng: parseFloat(place.lng),
                  name: locationName,
                });
              }
            }
          }
        }
      } catch (geocodeError) {
        console.warn(`Failed to geocode location "${locationName}":`, geocodeError);
        // Skip locations that can't be geocoded
      }
    }

    return NextResponse.json({
      success: true,
      locations,
      total: locations.length,
    });
  } catch (error) {
    console.error('Locations API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load location data',
      },
      { status: 500 },
    );
  }
}