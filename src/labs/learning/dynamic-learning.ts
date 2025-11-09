/**
 * Dynamic Learning System (Labs)
 * 
 * Adapted from src/lib/dynamic-learning.ts
 * ENABLED for labs - reads approved reviews and generates learning artifacts
 */

import { getDbPool } from '@/lib/db/pool';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export interface LearningContext {
  originalTweet: {
    tweet_id: string;
    text: string;
    original_event_type?: string;
    original_locations?: string[];
    original_people?: string[];
    original_organizations?: string[];
    original_schemes?: string[];
  };
  aiSuggestions: {
    event_type?: string;
    locations?: string[];
    people?: string[];
    organizations?: string[];
    schemes?: string[];
    confidence?: number;
  };
  humanCorrections: {
    event_type?: string;
    locations?: string[];
    people?: string[];
    organizations?: string[];
    schemes?: string[];
    review_notes?: string;
  };
  reviewer_id?: string;
  session_id?: string;
  timestamp: string;
}

export interface LearningResult {
  success: boolean;
  learnedEntities: string[];
  confidence: number;
  patternsUpdated: number;
  artifacts: string[];
}

export interface LearningArtifact {
  type: 'rule_weights' | 'gazetteer_expansions' | 'alias_maps' | 'prompt_exemplars';
  data: any;
  metadata: {
    createdAt: string;
    sourceCount: number;
    confidence: number;
  };
}

/**
 * Run learning job - processes approved reviews and generates artifacts
 */
export async function runLearningJob(): Promise<LearningResult> {
  const pool = getDbPool();
  const artifacts: string[] = [];
  const learnedEntities: string[] = [];
  let patternsUpdated = 0;

  try {
    // Read approved reviews from database
    const result = await pool.query(`
      SELECT 
        pe.tweet_id,
        pe.event_type,
        pe.locations,
        pe.people_mentioned,
        pe.organizations,
        pe.schemes_mentioned,
        pe.review_status,
        pe.reviewed_at,
        pe.reviewed_by,
        rt.text as tweet_text
      FROM parsed_events pe
      JOIN raw_tweets rt ON rt.tweet_id = pe.tweet_id
      WHERE pe.review_status IN ('approved', 'edited')
      ORDER BY pe.reviewed_at DESC
      LIMIT 1000
    `);

    const reviews = result.rows;
    console.log(`Processing ${reviews.length} approved reviews for learning`);

    // Extract patterns from reviews
    const ruleWeights: Record<string, number> = {};
    const gazetteerExpansions: Record<string, string[]> = {};
    const aliasMaps: Record<string, string[]> = {};
    const promptExemplars: any[] = [];

    for (const review of reviews) {
      // Extract location patterns
      if (review.locations && Array.isArray(review.locations)) {
        for (const loc of review.locations) {
          if (typeof loc === 'object' && loc.name) {
            const name = loc.name;
            const nameEn = loc.name_en || '';
            
            // Build alias map
            if (!aliasMaps[name]) {
              aliasMaps[name] = [];
            }
            if (nameEn && !aliasMaps[name].includes(nameEn)) {
              aliasMaps[name].push(nameEn);
            }
          }
        }
      }

      // Extract event type patterns
      if (review.event_type) {
        ruleWeights[review.event_type] = (ruleWeights[review.event_type] || 0) + 1;
      }

      // Collect exemplars
      if (review.review_status === 'edited') {
        promptExemplars.push({
          tweet_text: review.tweet_text,
          event_type: review.event_type,
          locations: review.locations,
          people: review.people_mentioned,
          organizations: review.organizations,
          schemes: review.schemes_mentioned,
        });
      }
    }

    // Normalize rule weights
    const maxWeight = Math.max(...Object.values(ruleWeights), 1);
    for (const key in ruleWeights) {
      ruleWeights[key] = ruleWeights[key] / maxWeight;
    }

    // Generate artifacts
    const artifactsDir = process.env.LEARNING_LOG_DIR || join(process.cwd(), 'data', 'learning');
    await mkdir(artifactsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // 1. Rule weights artifact
    const ruleWeightsArtifact: LearningArtifact = {
      type: 'rule_weights',
      data: ruleWeights,
      metadata: {
        createdAt: new Date().toISOString(),
        sourceCount: reviews.length,
        confidence: 0.8,
      },
    };
    const ruleWeightsPath = join(artifactsDir, `rule_weights_${timestamp}.json`);
    await writeFile(ruleWeightsPath, JSON.stringify(ruleWeightsArtifact, null, 2), 'utf-8');
    artifacts.push(ruleWeightsPath);

    // 2. Alias maps artifact
    const aliasMapsArtifact: LearningArtifact = {
      type: 'alias_maps',
      data: aliasMaps,
      metadata: {
        createdAt: new Date().toISOString(),
        sourceCount: reviews.length,
        confidence: 0.75,
      },
    };
    const aliasMapsPath = join(artifactsDir, `alias_maps_${timestamp}.json`);
    await writeFile(aliasMapsPath, JSON.stringify(aliasMapsArtifact, null, 2), 'utf-8');
    artifacts.push(aliasMapsPath);

    // 3. Prompt exemplars artifact
    const promptExemplarsArtifact: LearningArtifact = {
      type: 'prompt_exemplars',
      data: promptExemplars.slice(0, 50), // Top 50 exemplars
      metadata: {
        createdAt: new Date().toISOString(),
        sourceCount: promptExemplars.length,
        confidence: 0.9,
      },
    };
    const promptExemplarsPath = join(artifactsDir, `prompt_exemplars_${timestamp}.json`);
    await writeFile(promptExemplarsPath, JSON.stringify(promptExemplarsArtifact, null, 2), 'utf-8');
    artifacts.push(promptExemplarsPath);

    patternsUpdated = Object.keys(ruleWeights).length + Object.keys(aliasMaps).length;

    console.log(`Learning job completed: ${patternsUpdated} patterns updated, ${artifacts.length} artifacts generated`);

    return {
      success: true,
      learnedEntities: Object.keys(aliasMaps),
      confidence: 0.8,
      patternsUpdated,
      artifacts,
    };
  } catch (error) {
    console.error('Learning job failed:', error);
    throw error;
  }
}

/**
 * Get learning statistics
 */
export async function getLearningStats(): Promise<{
  totalFeedback: number;
  totalPatterns: number;
  avgConfidence: number;
  artifacts: string[];
}> {
  const pool = getDbPool();
  const artifactsDir = process.env.LEARNING_LOG_DIR || join(process.cwd(), 'data', 'learning');

  try {
    // Count approved reviews
    const feedbackResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM parsed_events
      WHERE review_status IN ('approved', 'edited')
    `);
    const totalFeedback = parseInt(feedbackResult.rows[0]?.count || '0', 10);

    // List artifacts
    const fs = await import('fs/promises');
    let artifacts: string[] = [];
    try {
      const files = await fs.readdir(artifactsDir);
      artifacts = files.filter(f => f.endsWith('.json')).map(f => join(artifactsDir, f));
    } catch {
      // Directory doesn't exist yet
    }

    return {
      totalFeedback,
      totalPatterns: artifacts.length * 10, // Estimate
      avgConfidence: 0.8,
      artifacts,
    };
  } catch (error) {
    console.error('Failed to get learning stats:', error);
    return {
      totalFeedback: 0,
      totalPatterns: 0,
      avgConfidence: 0,
      artifacts: [],
    };
  }
}

