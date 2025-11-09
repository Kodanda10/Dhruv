import { spawn } from 'child_process';
import { PlaceKind } from '@/labs/locations/types';

interface MilvusSearchResult {
  name: string;
  score: number;
}

export async function searchMilvus(
  query: string,
  limit: number,
  kindHint?: PlaceKind,
): Promise<MilvusSearchResult[]> {
  if (process.env.MILVUS_ENABLE !== 'true') {
    return [];
  }

  const scriptPath = 'scripts/milvus_location_search.py';
  if (!query) return [];

  return new Promise((resolve) => {
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const args = [scriptPath, query, String(limit), kindHint || 'unknown'];
    const pythonProcess = spawn(pythonPath, args, {
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
        console.warn('[Milvus] search failed:', stderr.trim());
        resolve([]);
        return;
      }
      try {
        const payload = JSON.parse(stdout);
        resolve(payload.results || []);
      } catch (error) {
        console.warn('[Milvus] failed to parse results', error);
        resolve([]);
      }
    });
  });
}
