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

import { Pool } from 'pg';

// Database configuration
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

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
  const pool = getPool();

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
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await initializeLearningTables();
      this.initialized = true;
      console.log('Dynamic Learning System initialized');
    } catch (error) {
      console.error('Failed to initialize learning system:', error);
    }
  }

  /**
   * Learn from human feedback and corrections
   */
  async learnFromHumanFeedback(context: LearningContext): Promise<LearningResult> {
    await this.initialize();

    const pool = getPool();
    const learnedEntities: string[] = [];

    try {
      // Identify what was learned
      const corrections = context.humanCorrections;

      if (corrections.event_type && corrections.event_type !== context.originalTweet.original_event_type) {
        learnedEntities.push(`event_type:${corrections.event_type}`);
      }

      if (corrections.locations) {
        corrections.locations.forEach(location => {
          if (!context.originalTweet.original_locations?.includes(location)) {
            learnedEntities.push(`location:${location}`);
          }
        });
      }

      if (corrections.people) {
        corrections.people.forEach(person => {
          if (!context.originalTweet.original_people?.includes(person)) {
            learnedEntities.push(`person:${person}`);
          }
        });
      }

      if (corrections.organizations) {
        corrections.organizations.forEach(org => {
          if (!context.originalTweet.original_organizations?.includes(org)) {
            learnedEntities.push(`organization:${org}`);
          }
        });
      }

      if (corrections.schemes) {
        corrections.schemes.forEach(scheme => {
          if (!context.originalTweet.original_schemes?.includes(scheme)) {
            learnedEntities.push(`scheme:${scheme}`);
          }
        });
      }

      // Calculate learning confidence based on AI suggestion accuracy
      let confidence = 0.5; // Base confidence
      if (context.aiSuggestions.event_type === corrections.event_type) {
        confidence += 0.2; // AI was right about event type
      }
      if (JSON.stringify(context.aiSuggestions.locations?.sort()) === JSON.stringify(corrections.locations?.sort())) {
        confidence += 0.2; // AI was right about locations
      }

      // Store feedback in database
      const result = await pool.query(`
        INSERT INTO learning_feedback
        (tweet_id, session_id, reviewer_id, original_data, ai_suggestions, human_corrections, learned_entities, confidence_score)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        context.originalTweet.tweet_id,
        context.session_id,
        context.reviewer_id,
        JSON.stringify(context.originalTweet),
        JSON.stringify(context.aiSuggestions),
        JSON.stringify(corrections),
        learnedEntities,
        confidence
      ]);

      // Update learning patterns
      const patternsUpdated = await this.updateLearningPatterns(learnedEntities, corrections);

      console.log(`Dynamic learning: Recorded ${learnedEntities.length} corrections, updated ${patternsUpdated} patterns`);

      return {
        success: true,
        learnedEntities,
        confidence: Math.min(confidence, 1.0),
        patternsUpdated
      };

    } catch (error) {
      console.error('Error in dynamic learning:', error);
      return {
        success: false,
        learnedEntities: [],
        confidence: 0,
        patternsUpdated: 0
      };
    }
  }

  /**
   * Update learning patterns based on corrections
   */
  private async updateLearningPatterns(learnedEntities: string[], corrections: any): Promise<number> {
    const pool = getPool();
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
    await this.initialize();

    const suggestions: LearningSuggestion[] = [];
    const pool = getPool();

    try {
      // Find similar tweets from learning feedback
      const similarTweets = await pool.query(`
        SELECT original_data, human_corrections, confidence_score
        FROM learning_feedback
        WHERE original_data->>'text' ILIKE $1
        ORDER BY confidence_score DESC
        LIMIT 5
      `, [`%${tweet.text.substring(0, 50)}%`]);

      if (similarTweets.rows.length > 0) {
        // Generate suggestions based on similar tweet corrections
        const corrections = similarTweets.rows[0].human_corrections;

        if (corrections.event_type && corrections.event_type !== tweet.current_event_type) {
          suggestions.push({
            event_type: corrections.event_type,
            confidence: parseFloat(similarTweets.rows[0].confidence_score) * 0.8,
            reasoning: 'Similar tweet was corrected to this event type',
            source: 'similar_tweets'
          });
        }

        // Add location suggestions
        if (corrections.locations && corrections.locations.length > 0) {
          const newLocations = corrections.locations.filter(loc =>
            !tweet.current_locations?.includes(loc)
          );
          if (newLocations.length > 0) {
            suggestions.push({
              locations: newLocations,
              confidence: parseFloat(similarTweets.rows[0].confidence_score) * 0.7,
              reasoning: 'Similar tweet had these locations added',
              source: 'similar_tweets'
            });
          }
        }
      }

      // Get high-confidence patterns for common entities
      const patterns = await pool.query(`
        SELECT pattern_type, pattern_key, pattern_value, confidence
        FROM learning_patterns
        WHERE confidence > 0.7
        ORDER BY confidence DESC, usage_count DESC
        LIMIT 10
      `);

      if (patterns.rows.length > 0) {
        // Generate suggestions based on learned patterns found in tweet text
        const tweetText = tweet.text.toLowerCase();

        patterns.rows.forEach(pattern => {
          if (tweetText.includes(pattern.pattern_key.toLowerCase())) {
            switch (pattern.pattern_type) {
              case 'location':
                if (!tweet.current_locations?.includes(pattern.pattern_value)) {
                  suggestions.push({
                    locations: [pattern.pattern_value],
                    confidence: parseFloat(pattern.confidence),
                    reasoning: `Learned pattern: ${pattern.pattern_key} indicates location`,
                    source: 'learned_patterns'
                  });
                }
                break;
              case 'person':
                if (!tweet.current_people?.includes(pattern.pattern_value)) {
                  suggestions.push({
                    people: [pattern.pattern_value],
                    confidence: parseFloat(pattern.confidence),
                    reasoning: `Learned pattern: ${pattern.pattern_key} indicates person`,
                    source: 'learned_patterns'
                  });
                }
                break;
              case 'organization':
                if (!tweet.current_organizations?.includes(pattern.pattern_value)) {
                  suggestions.push({
                    organizations: [pattern.pattern_value],
                    confidence: parseFloat(pattern.confidence),
                    reasoning: `Learned pattern: ${pattern.pattern_key} indicates organization`,
                    source: 'learned_patterns'
                  });
                }
                break;
              case 'scheme':
                if (!tweet.current_schemes?.includes(pattern.pattern_value)) {
                  suggestions.push({
                    schemes: [pattern.pattern_value],
                    confidence: parseFloat(pattern.confidence),
                    reasoning: `Learned pattern: ${pattern.pattern_key} indicates scheme`,
                    source: 'learned_patterns'
                  });
                }
                break;
            }
          }
        });
      }

      // Remove duplicate suggestions and sort by confidence
      const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
        index === self.findIndex(s => JSON.stringify(s) === JSON.stringify(suggestion))
      ).sort((a, b) => b.confidence - a.confidence);

      return uniqueSuggestions;

    } catch (error) {
      console.error('Error getting intelligent suggestions:', error);
      return [];
    }
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
    await this.initialize();

    const pool = getPool();

    try {
      const feedbackStats = await pool.query(`
        SELECT
          COUNT(*) as total_feedback,
          AVG(confidence_score) as avg_confidence
        FROM learning_feedback
      `);

      const patternStats = await pool.query(`
        SELECT COUNT(*) as total_patterns FROM learning_patterns
      `);

      const topEntities = await pool.query(`
        SELECT
          unnest(learned_entities) as entity,
          COUNT(*) as count
        FROM learning_feedback
        GROUP BY unnest(learned_entities)
        ORDER BY count DESC
        LIMIT 10
      `);

      return {
        totalFeedback: parseInt(feedbackStats.rows[0].total_feedback),
        totalPatterns: parseInt(patternStats.rows[0].total_patterns),
        avgConfidence: parseFloat(feedbackStats.rows[0].avg_confidence) || 0,
        topLearnedEntities: topEntities.rows.map(row => ({
          entity: row.entity,
          count: parseInt(row.count)
        }))
      };

    } catch (error) {
      console.error('Error getting learning stats:', error);
      return {
        totalFeedback: 0,
        totalPatterns: 0,
        avgConfidence: 0,
        topLearnedEntities: []
      };
    }
  }
}
