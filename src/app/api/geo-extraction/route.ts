import { NextRequest, NextResponse } from 'next/server';
import { GeoHierarchyResolver, GeoHierarchy } from '@/lib/geo-extraction/hierarchy-resolver';

// Geo-extraction service instance
let geoResolver: GeoHierarchyResolver | null = null;

async function getGeoResolver(): Promise<GeoHierarchyResolver> {
  if (!geoResolver) {
    geoResolver = new GeoHierarchyResolver();
    await geoResolver.initialize();
  }
  return geoResolver;
}

interface GeoExtractionRequest {
  locations: string[];
  tweetText: string;
  context?: string;
}

interface GeoExtractionResponse {
  hierarchies: GeoHierarchy[];
  ambiguous: Array<{
    location: string;
    possibleMatches: GeoHierarchy[];
    suggestedMatch: GeoHierarchy;
  }>;
  summary: {
    totalLocations: number;
    resolvedLocations: number;
    ambiguousLocations: number;
    confidence: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: GeoExtractionRequest = await request.json();
    const { locations, tweetText, context } = body;

    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return NextResponse.json(
        { error: 'locations array is required and must not be empty' },
        { status: 400 }
      );
    }

    const resolver = await getGeoResolver();
    const hierarchies: GeoHierarchy[] = [];
    const ambiguous: Array<{
      location: string;
      possibleMatches: GeoHierarchy[];
      suggestedMatch: GeoHierarchy;
    }> = [];

    // Process each location
    for (const location of locations) {
      try {
        const results = await resolver.resolveVillage(location);
        
        if (results.length === 0) {
          // No matches found
          ambiguous.push({
            location,
            possibleMatches: [],
            suggestedMatch: {
              village: location,
              block: 'Unknown',
              assembly: 'Unknown',
              district: 'Unknown',
              is_urban: false,
              confidence: 0.0
            }
          });
        } else if (results.length === 1) {
          // Single match
          hierarchies.push(results[0]);
        } else {
          // Multiple matches - use context for disambiguation
          let suggestedMatch = results[0];
          
          if (context) {
            try {
              suggestedMatch = await resolver.resolveAmbiguousLocation(location, context);
            } catch (error) {
              console.warn(`Failed to disambiguate "${location}":`, error);
            }
          }
          
          ambiguous.push({
            location,
            possibleMatches: results,
            suggestedMatch
          });
          
          hierarchies.push(suggestedMatch);
        }
      } catch (error) {
        console.error(`Error processing location "${location}":`, error);
        ambiguous.push({
          location,
          possibleMatches: [],
          suggestedMatch: {
            village: location,
            block: 'Unknown',
            assembly: 'Unknown',
            district: 'Unknown',
            is_urban: false,
            confidence: 0.0
          }
        });
      }
    }

    // Calculate summary statistics
    const resolvedLocations = hierarchies.length;
    const ambiguousLocations = ambiguous.length;
    const totalLocations = locations.length;
    
    // Calculate overall confidence
    const avgConfidence = hierarchies.length > 0 
      ? hierarchies.reduce((sum, h) => sum + h.confidence, 0) / hierarchies.length
      : 0.0;
    
    const resolutionRate = totalLocations > 0 ? resolvedLocations / totalLocations : 0;
    const confidence = avgConfidence * resolutionRate;

    const response: GeoExtractionResponse = {
      hierarchies,
      ambiguous,
      summary: {
        totalLocations,
        resolvedLocations,
        ambiguousLocations,
        confidence
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Geo-extraction API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during geo-extraction' },
      { status: 500 }
    );
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get('location');
  
  if (!location) {
    return NextResponse.json(
      { error: 'location parameter is required' },
      { status: 400 }
    );
  }

  try {
    const resolver = await getGeoResolver();
    const results = await resolver.resolveVillage(location);
    
    return NextResponse.json({
      location,
      results,
      count: results.length
    });

  } catch (error) {
    console.error('Geo-extraction GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error during geo-extraction' },
      { status: 500 }
    );
  }
}
