export function isParseEnabled(): boolean {
  // Default ON everywhere unless explicitly turned off.
  const flag = process.env.NEXT_PUBLIC_FLAG_PARSE ?? process.env.FLAG_PARSE;
  return flag !== 'off';
}

export function isLabsIntegrationEnabled(): boolean {
  // Controls integration with labs components (FaissSearchCard, AIAssistantCard, etc.)
  const flag = process.env.NEXT_PUBLIC_LABS_INTEGRATION ?? process.env.LABS_INTEGRATION;
  return flag === 'on';
}

export function isDynamicLearningEnabled(): boolean {
  // Controls dynamic learning functionality (DynamicLearningCard)
  const flag = process.env.NEXT_PUBLIC_ENABLE_DYNAMIC_LEARNING ?? process.env.ENABLE_DYNAMIC_LEARNING;
  return flag === 'on';
}
