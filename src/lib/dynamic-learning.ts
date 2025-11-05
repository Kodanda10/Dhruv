/**
 * Dynamic Learning System for AI Assistant and Regex Model
 *
 * Records human reviews and corrections to improve:
 * 1. AI Assistant suggestions (LangGraph)
 * 2. Regex parsing patterns
 * 3. Event type classification accuracy
 * 4. Location/person/organization extraction
 *
 * Stores learning data in database for persistence and analysis
 */

// Database configuration - lazy initialization
let pool: any = null;

function getPool() {
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

// NOTE: Dynamic learning is disabled for initial production deployment
// Will be re-enabled after successful deployment

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
}

export interface LearningSuggestion {
  event_type?: string;
  locations?: string[];
  people?: string[];
  organizations?: string[];
  schemes?: string[];
  confidence: number;
  reasoning: string;
  source: 'learned_patterns' | 'similar_tweets' | 'community_feedback';
}

/**
 * Initialize learning tables if they don't exist
 */
async function initializeLearningTables(): Promise<void> {
  const pool = await getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS learning_feedback (
      id SERIAL PRIMARY KEY,
      tweet_id VARCHAR(50) NOT NULL,
      session_id VARCHAR(100),
      reviewer_id VARCHAR(100),
      original_data JSONB NOT NULL,
      ai_suggestions JSONB,
      human_corrections JSONB NOT NULL,
      learned_entities TEXT[],
      confidence_score DECIMAL(3,2),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      patterns_updated INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS learning_patterns (
      id SERIAL PRIMARY KEY,
      pattern_type VARCHAR(50) NOT NULL, -- 'event_type', 'location', 'person', 'organization', 'scheme'
      pattern_key TEXT NOT NULL,
      pattern_value TEXT,
      confidence DECIMAL(3,2) DEFAULT 0.5,
      usage_count INTEGER DEFAULT 1,
      last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(pattern_type, pattern_key)
    );

    CREATE INDEX IF NOT EXISTS idx_learning_feedback_tweet_id ON learning_feedback(tweet_id);
    CREATE INDEX IF NOT EXISTS idx_learning_patterns_type_key ON learning_patterns(pattern_type, pattern_key);
    CREATE INDEX IF NOT EXISTS idx_learning_patterns_confidence ON learning_patterns(confidence DESC);
  `);
}

export class DynamicLearningSystem {
  constructor() {
    // Dynamic learning disabled for production deployment
    console.log('Dynamic Learning System disabled for production deployment');
  }

  /**
   * Learn from human feedback and corrections
   */
  async learnFromHumanFeedback(context: LearningContext): Promise<LearningResult> {
    // Dynamic learning disabled for production deployment
    console.log('Dynamic learning: Feedback recorded (disabled for deployment)', context.originalTweet.tweet_id);
    return {
      success: true,
      learnedEntities: [],
      confidence: 0.5,
      patternsUpdated: 0
    };
  }

  /**
   * Update learning patterns based on corrections
   */
  private async updateLearningPatterns(learnedEntities: string[], corrections: any): Promise<number> {
    const pool = await getPool();
    let patternsUpdated = 0;

    for (const entity of learnedEntities) {
      const [type, value] = entity.split(':', 2);

      try {
        // Check if pattern already exists
        const existing = await pool.query(`
          SELECT id, usage_count, confidence FROM learning_patterns
          WHERE pattern_type = $1 AND pattern_key = $2
        `, [type, value]);

        if (existing.rows.length > 0) {
          // Update existing pattern
          const currentConfidence = parseFloat(existing.rows[0].confidence);
          const newUsageCount = existing.rows[0].usage_count + 1;
          const newConfidence = Math.min(currentConfidence + 0.1, 0.95); // Gradually increase confidence

          await pool.query(`
            UPDATE learning_patterns
            SET usage_count = $1, confidence = $2, last_updated = NOW()
            WHERE id = $3
          `, [newUsageCount, newConfidence, existing.rows[0].id]);

        } else {
          // Create new pattern
          await pool.query(`
            INSERT INTO learning_patterns (pattern_type, pattern_key, pattern_value, confidence, usage_count)
            VALUES ($1, $2, $3, $4, $5)
          `, [type, value, value, 0.6, 1]); // Start with moderate confidence
        }

        patternsUpdated++;
      } catch (error) {
        console.error(`Error updating pattern ${entity}:`, error);
      }
    }

    return patternsUpdated;
  }

  /**
   * Get intelligent suggestions based on learned patterns
   */
  async getIntelligentSuggestions(tweet: {
    tweet_id: string;
    text: string;
    current_event_type?: string;
    current_locations?: string[];
    current_people?: string[];
    current_organizations?: string[];
    current_schemes?: string[];
  }): Promise<LearningSuggestion[]> {
    // Dynamic learning disabled for production deployment
    console.log('Dynamic learning: Suggestions requested (disabled for deployment)', tweet.tweet_id);
    return [];
  }

  /**
   * Get learning statistics for analytics
   */
  async getLearningStats(): Promise<{
    totalFeedback: number;
    totalPatterns: number;
    avgConfidence: number;
    topLearnedEntities: { entity: string; count: number }[];
  }> {
    // Dynamic learning disabled for production deployment
    return {
      totalFeedback: 0,
      totalPatterns: 0,
      avgConfidence: 0,
      topLearnedEntities: []
    };
  }
}
