export function isParseEnabled(): boolean {
  // Default ON everywhere unless explicitly turned off.
  const flag = process.env.NEXT_PUBLIC_FLAG_PARSE ?? process.env.FLAG_PARSE;
  return flag !== 'off';
}

export function isRecommendationsEnabled(): boolean {
  // Default OFF unless explicitly enabled.
  const flag = process.env.NEXT_PUBLIC_FLAG_RECOMMENDATIONS ?? process.env.FLAG_RECOMMENDATIONS;
  return flag === 'on' || flag === 'true';
}
