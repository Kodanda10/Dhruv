import { execFile } from 'child_process';
import path from 'path';
import { getBackendConfig } from './config'; // Import the config module

export type FaissSearchResult = {
  id: string;
  score: number;
  name: string;
  match_type?: string;
  [key: string]: any;
};

export type FaissIndexStats = {
  locationCount: number;
  dimension: number;
  indexPath: string;
};

const PYTHON_SCRIPT_PATH = path.resolve(process.cwd(), 'api/scripts/faiss_search_script.py');
const PYTHON_EXECUTABLE = process.env.PYTHON_PATH || 'python3';

/**
 * Performs a semantic search using the FAISS python script.
 * @param query The search query string.
 * @param limit The maximum number of results to return.
 * @returns A promise that resolves to an array of search results.
 */
export function search(query: string, limit: number = 5): Promise<FaissSearchResult[]> {
  return new Promise((resolve, reject) => {
    const backendConfig = getBackendConfig();
    if (backendConfig.backend !== 'faiss') {
      return reject(new Error('FAISS backend not configured or available.'));
    }

    const args = [query, String(limit)];

    execFile(PYTHON_EXECUTABLE, [PYTHON_SCRIPT_PATH, ...args], (error, stdout, stderr) => {
      if (error) {
        console.error(`FAISS script execution error: ${error.message}`);
        console.error(`FAISS script stderr: ${stderr}`);
        return reject(new Error('Failed to execute FAISS search script.'));
      }

      try {
        const results: FaissSearchResult[] = JSON.parse(stdout);
        resolve(results);
      } catch (parseError: any) {
        console.error(`Failed to parse FAISS script output: ${parseError.message}`);
        console.error(`FAISS script stdout: ${stdout}`);
        reject(new Error('Failed to parse FAISS search results.'));
      }
    });
  });
}

/**
 * Retrieves statistics about the FAISS index.
 * @returns A promise that resolves to an object containing index statistics.
 */
export function getIndexStats(): Promise<FaissIndexStats> {
  return new Promise((resolve, reject) => {
    const backendConfig = getBackendConfig();
    if (backendConfig.backend !== 'faiss') {
      return reject(new Error('FAISS backend not configured or available.'));
    }

    // Use a special query to trigger stats output from the Python script
    const args = ["__GET_INDEX_STATS__", "0"]; // Query and limit are ignored for stats

    execFile(PYTHON_EXECUTABLE, [PYTHON_SCRIPT_PATH, ...args], (error, stdout, stderr) => {
      if (error) {
        console.error(`FAISS stats script execution error: ${error.message}`);
        console.error(`FAISS stats script stderr: ${stderr}`);
        return reject(new Error('Failed to execute FAISS stats script.'));
      }

      try {
        const stats: FaissIndexStats = JSON.parse(stdout);
        resolve(stats);
      } catch (parseError: any) {
        console.error(`Failed to parse FAISS stats output: ${parseError.message}`);
        console.error(`FAISS stats script stdout: ${stdout}`);
        reject(new Error('Failed to parse FAISS index statistics.'));
      }
    });
  });
}
