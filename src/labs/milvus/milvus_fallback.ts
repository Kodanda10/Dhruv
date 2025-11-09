/**
 * Milvus Fallback Client
 * 
 * Only used if MILVUS_ENABLE=true and FAISS unavailable.
 * Wraps existing Python Milvus client.
 */

import { spawn } from 'child_process';

export interface MilvusHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency_ms: number;
  error?: string;
  connected?: boolean;
}

/**
 * Check Milvus health
 */
export async function checkMilvusHealth(): Promise<MilvusHealth> {
  const startTime = Date.now();

  const pythonScript = `
import sys
import json
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'src'))

try:
    from parsing.milvus_engine import MilvusEngine
    
    milvus_uri = "${process.env.MILVUS_URI || 'http://localhost:19530'}"
    collection_name = "${process.env.MILVUS_COLLECTION_NAME || 'chhattisgarh_geography_multilingual'}"
    
    engine = MilvusEngine(uri=milvus_uri, collection_name=collection_name)
    
    # Try to query collection to verify connection
    try:
        engine.load_collection()
        connected = True
        status = "healthy"
    except Exception as e:
        connected = False
        status = "unhealthy"
        error_msg = str(e)
    
    result = {
        "status": status,
        "connected": connected
    }
    
    if not connected:
        result["error"] = error_msg
    
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({
        "status": "unhealthy",
        "connected": False,
        "error": str(e)
    }))
    sys.exit(1)
`;

  return new Promise((resolve) => {
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const pythonProcess = spawn(pythonPath, ['-c', pythonScript], {
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
      const latency = Date.now() - startTime;

      if (code !== 0) {
        resolve({
          status: 'unhealthy',
          latency_ms: latency,
          error: stderr || 'Milvus check failed',
          connected: false,
        });
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve({
          status: result.status === 'healthy' ? 'healthy' : 'unhealthy',
          latency_ms: latency,
          error: result.error,
          connected: result.connected || false,
        });
      } catch (error) {
        resolve({
          status: 'unhealthy',
          latency_ms: latency,
          error: 'Failed to parse health check response',
          connected: false,
        });
      }
    });
  });
}

