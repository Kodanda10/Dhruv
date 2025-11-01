export function isParseEnabled(): boolean {
  // Default ON everywhere unless explicitly turned off.
  const flag = process.env.NEXT_PUBLIC_FLAG_PARSE ?? process.env.FLAG_PARSE;
  return flag !== 'off';
}

/**
 * Check if GEO_STRICT_MODE is enabled for deterministic geo-hierarchy resolution.
 * 
 * In strict mode:
 * - Multiple candidates for a location → needs_review = true
 * - Single candidate → confidence ≥0.98
 * - No candidates → error thrown
 * 
 * Default: true locally, false in production until rollout
 */
export function isGeoStrictModeEnabled(): boolean {
  // Check environment variable
  const envFlag = process.env.NEXT_PUBLIC_GEO_STRICT_MODE ?? process.env.GEO_STRICT_MODE;
  
  if (envFlag === 'true' || envFlag === '1') return true;
  if (envFlag === 'false' || envFlag === '0') return false;
  
  // Default: true in development (Node.js), false in production
  // Detect production via NODE_ENV or VERCEL_ENV
  const isProduction = process.env.NODE_ENV === 'production' || 
                       process.env.VERCEL_ENV === 'production';
  
  return !isProduction;
}
