/**
 * FAISS Search Module
 * 
 * Wraps Python FAISS implementation for Node.js use.
 * Uses child_process to call Python script that performs vector search.
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getBackendConfig } from './config';

export interface SearchResult {
  id: string;
  name: string;
  score: number;
  similarity_score: number;
  source: string;
  match_type: string;
}

/**
 * Search FAISS index using Python wrapper
 * 
 * @param query - Search query text
 * @param limit - Maximum number of results (default: 5)
 * @returns Array of search results with scores
 */
export async function search(
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const config = getBackendConfig();

  if (config.backend !== 'faiss') {
    throw new Error(`FAISS backend not available. Current backend: ${config.backend}`);
  }

  if (!config.faiss) {
    throw new Error('FAISS configuration missing');
  }

  // Check if index exists
  if (!existsSync(config.faiss.indexPath)) {
    throw new Error(`FAISS index not found at ${config.faiss.indexPath}`);
  }

  // Use Python helper script to perform search
  // Path relative to project root
  const scriptPath = join(process.cwd(), 'src', 'labs', 'faiss', 'search_helper.py');

  return new Promise((resolve, reject) => {
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const pythonProcess = spawn(pythonPath, [scriptPath, query, String(limit)], {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${stderr || stdout}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          reject(new Error(result.error));
          return;
        }
        resolve(result.results || []);
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${error}`));
      }
    });
  });
}

/**
 * Get FAISS index statistics
 */
export async function getIndexStats(): Promise<{
  locationCount: number;
  dimension: number;
  indexPath: string;
}> {
  const config = getBackendConfig();

  if (config.backend !== 'faiss' || !config.faiss) {
    throw new Error('FAISS backend not available');
  }

  // Read locations file to get count
  let locationCount = 0;
  if (existsSync(config.faiss.locationsPath)) {
    try {
      const locations = JSON.parse(readFileSync(config.faiss.locationsPath, 'utf-8'));
      locationCount = Array.isArray(locations) ? locations.length : 0;
    } catch (error) {
      console.warn('Failed to read locations file:', error);
    }
  }

  return {
    locationCount,
    dimension: config.faiss.dimension,
    indexPath: config.faiss.indexPath,
  };
}

