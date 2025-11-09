/**
 * FAISS Configuration Module
 * 
 * Determines which vector search backend to use:
 * 1. FAISS (primary) - if index exists
 * 2. Milvus (fallback) - if MILVUS_ENABLE=true and FAISS unavailable
 * 3. Error - if neither available
 */

import { existsSync } from 'fs';
import { join } from 'path';

export interface FAISSConfig {
  indexPath: string;
  locationsPath: string;
  dimension: number;
  metric: 'cosine' | 'l2' | 'ip';
  embeddingModel: string;
}

export interface BackendConfig {
  backend: 'faiss' | 'milvus' | 'none';
  faiss?: FAISSConfig;
  milvus?: {
    enabled: boolean;
    uri: string;
    collectionName: string;
  };
}

export function getBackendConfig(): BackendConfig {
  const faissIndexPath = process.env.FAISS_INDEX_PATH || 
    join(process.cwd(), 'data', 'embeddings', 'multilingual_geography', 'faiss_index.bin');
  const faissLocationsPath = process.env.FAISS_LOCATIONS_PATH || 
    join(process.cwd(), 'data', 'embeddings', 'multilingual_geography', 'locations.json');
  
  const faissIndexExists = existsSync(faissIndexPath);
  const milvusEnabled = process.env.MILVUS_ENABLE === 'true';

  // Primary: FAISS if index exists
  if (faissIndexExists) {
    return {
      backend: 'faiss',
      faiss: {
        indexPath: faissIndexPath,
        locationsPath: faissLocationsPath,
        dimension: parseInt(process.env.FAISS_DIM || '384', 10),
        metric: (process.env.FAISS_METRIC || 'cosine') as 'cosine' | 'l2' | 'ip',
        embeddingModel: process.env.FAISS_EMBEDDING_MODEL || 'intfloat/multilingual-e5-base',
      },
    };
  }

  // Fallback: Milvus if enabled
  if (milvusEnabled) {
    return {
      backend: 'milvus',
      milvus: {
        enabled: true,
        uri: process.env.MILVUS_URI || 'http://localhost:19530',
        collectionName: process.env.MILVUS_COLLECTION_NAME || 'chhattisgarh_geography_multilingual',
      },
    };
  }

  // Error: No backend available
  throw new Error(
    `No vector search backend available. ` +
    `FAISS index not found at ${faissIndexPath} and MILVUS_ENABLE=false`
  );
}

