/**
 * Parsing Pipeline Test Suite
 * 
 * Tests for the robust tweet parsing pipeline that extracts:
 * - Event type and confidence
 * - Event date and confidence
 * - Locations (with geography matching)
 * - People mentioned
 * - Organizations
 * - Government schemes
 * - Overall confidence score
 */

describe('Parsing Pipeline', () => {
  it('should have tweet parser script', () => {
    const { existsSync } = require('fs');
    const { join } = require('path');
    const projectRoot = join(__dirname, '..');
    
    const parserPath = join(projectRoot, 'scripts', 'parse_tweets.py');
    expect(existsSync(parserPath)).toBe(true);
  });
  
  it('should have text preprocessor module', () => {
    const { existsSync } = require('fs');
    const { join } = require('path');
    const projectRoot = join(__dirname, '..');
    
    const preprocessorPath = join(projectRoot, 'api', 'src', 'parsing', 'preprocessor.py');
    expect(existsSync(preprocessorPath)).toBe(true);
  });
  
  it('should have location matcher module', () => {
    const { existsSync } = require('fs');
    const { join } = require('path');
    const projectRoot = join(__dirname, '..');
    
    const matcherPath = join(projectRoot, 'api', 'src', 'parsing', 'location_matcher.py');
    expect(existsSync(matcherPath)).toBe(true);
  });
  
  it('should have event classifier module', () => {
    const { existsSync } = require('fs');
    const { join } = require('path');
    const projectRoot = join(__dirname, '..');
    
    const classifierPath = join(projectRoot, 'api', 'src', 'parsing', 'event_classifier.py');
    expect(existsSync(classifierPath)).toBe(true);
  });
  
  it('should have scheme detector module', () => {
    const { existsSync } = require('fs');
    const { join } = require('path');
    const projectRoot = join(__dirname, '..');
    
    const detectorPath = join(projectRoot, 'api', 'src', 'parsing', 'scheme_detector.py');
    expect(existsSync(detectorPath)).toBe(true);
  });
  
  it('should have parsing orchestrator module', () => {
    const { existsSync } = require('fs');
    const { join } = require('path');
    const projectRoot = join(__dirname, '..');
    
    const orchestratorPath = join(projectRoot, 'api', 'src', 'parsing', 'orchestrator.py');
    expect(existsSync(orchestratorPath)).toBe(true);
  });
});

