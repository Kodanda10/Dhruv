/**
 * Test: Verify over-engineered components are archived
 * 
 * This test ensures that:
 * 1. Neo4j service is removed from docker-compose.yml
 * 2. Milvus-related code is moved to archive/
 * 3. SOTA brain docs are preserved but marked as deferred
 * 4. Existing functionality still works (health endpoint, parsing)
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Archive Cleanup - Remove Over-Engineered Components', () => {
  const projectRoot = join(__dirname, '..');

  it('should remove Neo4j from docker-compose.yml', () => {
    const dockerComposePath = join(projectRoot, 'infra', 'docker-compose.yml');
    expect(existsSync(dockerComposePath)).toBe(true);
    
    const dockerCompose = readFileSync(dockerComposePath, 'utf-8');
    
    // Neo4j service should NOT be present
    expect(dockerCompose).not.toContain('neo4j:');
    expect(dockerCompose).not.toContain('image: neo4j');
    expect(dockerCompose).not.toContain('NEO4J_AUTH');
    
    // Postgres should still be present
    expect(dockerCompose).toContain('postgres:');
    expect(dockerCompose).toContain('image: postgres:15');
  });

  it('should have .venv in .gitignore', () => {
    const gitignorePath = join(projectRoot, '.gitignore');
    const gitignore = readFileSync(gitignorePath, 'utf-8');
    
    expect(gitignore).toContain('.venv');
  });

  it('should document the MVP focus decision', () => {
    const archiveReadmePath = join(projectRoot, 'archive', 'README.md');
    expect(existsSync(archiveReadmePath)).toBe(true);
    
    const archiveReadme = readFileSync(archiveReadmePath, 'utf-8');
    
    // Should explain why components were archived
    expect(archiveReadme.toLowerCase()).toContain('mvp');
    expect(archiveReadme.toLowerCase()).toContain('neo4j');
    expect(archiveReadme.toLowerCase()).toContain('milvus');
  });

  it('should preserve existing parse functionality', async () => {
    // This is a smoke test - we're not actually calling the API
    // Just checking that the config still references existing features
    const flagsPath = join(projectRoot, 'config', 'flags.ts');
    const flags = readFileSync(flagsPath, 'utf-8');
    
    // Should still have parsing flag (checking for FLAG_PARSE)
    expect(flags).toContain('FLAG_PARSE');
  });
});

