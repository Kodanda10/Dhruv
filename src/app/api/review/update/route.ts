import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getEventTypeInHindi } from '@/lib/i18n/event-types-hi';
import { DynamicLearningSystem, LearningContext } from '@/lib/dynamic-learning';

// Database configuration - lazy initialization
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

interface ReviewUpdateRequest {
  id: string;
  action?: 'approve' | 'reject' | 'skip';
  notes?: string;
  // Edit fields
  event_type?: string;
  locations?: string | string[];
  people_mentioned?: string | string[];
  organizations?: string | string[];
  schemes_mentioned?: string | string[];
  review_notes?: string;
}

interface ReviewUpdateResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Validate and sanitize input data
 */
function validateAndSanitizeInput(data: ReviewUpdateRequest): ReviewUpdateRequest {
  const sanitized: ReviewUpdateRequest = { id: data.id };

  // Validate tweet ID
  if (!data.id || typeof data.id !== 'string' || data.id.length > 50) {
    throw new Error('ट्वीट ID आवश्यक है');
  }

  // Validate action
  if (data.action && !['approve', 'reject', 'skip'].includes(data.action)) {
    throw new Error('अमान्य कार्रवाई');
  }

  // Validate event_type
  if (data.event_type) {
    const maliciousPattern = /[<>'"&\\]/;
    if (maliciousPattern.test(data.event_type)) {
      throw new Error('अमान्य घटना प्रकार');
    }
    sanitized.event_type = data.event_type;
  }

  // Validate and normalize array fields
  const arrayFields = ['locations', 'people_mentioned', 'organizations', 'schemes_mentioned'] as const;
  arrayFields.forEach(field => {
    if (data[field]) {
      let arrayValue: string[];
      if (typeof data[field] === 'string') {
        arrayValue = [data[field] as string];
      } else if (Array.isArray(data[field])) {
        arrayValue = data[field] as string[];
      } else {
        arrayValue = [];
      }

      // Validate each item
      const maliciousPattern = /[<>'"&\\]/;
      if (arrayValue.some(item => maliciousPattern.test(item))) {
        throw new Error(`अमान्य ${field} डेटा`);
      }

      sanitized[field] = arrayValue;
    }
  });

  // Validate notes
  if (data.notes && typeof data.notes === 'string' && data.notes.length > 1000) {
    throw new Error('टिप्पणी बहुत लंबी है');
  }
  if (data.notes) sanitized.notes = data.notes;

  if (data.review_notes) sanitized.review_notes = data.review_notes;

  return sanitized;
}

/**
 * Update tweet review data and trigger dynamic learning
 */
async function updateTweetReview(data: ReviewUpdateRequest): Promise<void> {
  const pool = getPool();

  // Get original data before update for learning context
  const originalQuery = `
    SELECT
      pe.event_type, pe.locations, pe.people_mentioned, pe.organizations, pe.schemes_mentioned,
      rt.text
    FROM parsed_events pe
    LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
    WHERE pe.tweet_id = $1
  `;
  const originalResult = await pool.query(originalQuery, [data.id]);

  if (originalResult.rows.length === 0) {
    throw new Error('ट्वीट नहीं मिला');
  }

  const originalData = originalResult.rows[0];

  // Build update query dynamically
  const updateFields: string[] = [];
  const updateParams: (string | string[] | null)[] = [];
  let paramIndex = 1;

  // Handle edit fields
  if (data.event_type) {
    updateFields.push(`event_type = $${paramIndex}`);
    updateParams.push(data.event_type);
    paramIndex++;

    // Also update Hindi translation
    const hindiTranslation = getEventTypeInHindi(data.event_type);
    updateFields.push(`event_type_hi = $${paramIndex}`);
    updateParams.push(hindiTranslation);
    paramIndex++;
  }

  if (data.locations) {
    updateFields.push(`locations = $${paramIndex}`);
    updateParams.push(JSON.stringify(data.locations));
    paramIndex++;
  }

  if (data.people_mentioned) {
    updateFields.push(`people_mentioned = $${paramIndex}`);
    updateParams.push(JSON.stringify(data.people_mentioned));
    paramIndex++;
  }

  if (data.organizations) {
    updateFields.push(`organizations = $${paramIndex}`);
    updateParams.push(JSON.stringify(data.organizations));
    paramIndex++;
  }

  if (data.schemes_mentioned) {
    updateFields.push(`schemes_mentioned = $${paramIndex}`);
    updateParams.push(JSON.stringify(data.schemes_mentioned));
    paramIndex++;
  }

  if (data.review_notes !== undefined) {
    updateFields.push(`review_notes = $${paramIndex}`);
    updateParams.push(data.review_notes || null);
    paramIndex++;
  }

  if (updateFields.length > 0) {
    updateParams.push(data.id); // Add tweet ID as last parameter

    const updateQuery = `
      UPDATE parsed_events
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE tweet_id = $${paramIndex}
    `;

    const updateResult = await pool.query(updateQuery, updateParams);
    if (updateResult.rowCount === 0) {
      throw new Error('ट्वीट नहीं मिला');
    }

    // Trigger dynamic learning if there were actual changes
    const changes = Object.keys(data).filter(key => key !== 'id' && data[key as keyof ReviewUpdateRequest]);
    if (changes.length > 0) {
      await triggerDynamicLearning(data, originalData);
    }

    console.log('Review edit:', {
      tweetId: data.id,
      changes: changes
    });
  }
}

/**
 * Trigger dynamic learning from human corrections
 */
async function triggerDynamicLearning(data: ReviewUpdateRequest, originalData: any): Promise<void> {
  try {
    const learningSystem = new DynamicLearningSystem();

    // Get AI suggestions that were originally made (if any)
    // For now, we'll use empty AI suggestions since we don't store them
    const aiSuggestions = {};

    const learningContext: LearningContext = {
      originalTweet: {
        tweet_id: data.id,
        text: originalData.text || '',
        original_event_type: originalData.event_type,
        original_locations: Array.isArray(originalData.locations) ? originalData.locations : [],
        original_people: Array.isArray(originalData.people_mentioned) ? originalData.people_mentioned : [],
        original_organizations: Array.isArray(originalData.organizations) ? originalData.organizations : [],
        original_schemes: Array.isArray(originalData.schemes_mentioned) ? originalData.schemes_mentioned : []
      },
      aiSuggestions,
      humanCorrections: {
        event_type: data.event_type,
        locations: data.locations,
        people: data.people_mentioned,
        organizations: data.organizations,
        schemes: data.schemes_mentioned,
        review_notes: data.review_notes
      },
      reviewer_id: 'admin', // In production, get from session
      session_id: `session_${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    const learningResult = await learningSystem.learnFromHumanFeedback(learningContext);

    if (learningResult.success) {
      console.log(`Dynamic learning triggered: ${learningResult.learnedEntities.length} entities learned, ${learningResult.patternsUpdated} patterns updated`);
    }

  } catch (error) {
    console.error('Error triggering dynamic learning:', error);
    // Don't fail the review update if learning fails
  }
}

/**
 * Handle approval/rejection actions
 */
async function handleReviewAction(data: ReviewUpdateRequest): Promise<void> {
  const pool = getPool();
  const now = new Date().toISOString();
  const reviewerId = 'admin'; // In a real app, this would come from session

  let status: string;
  let actionMessage: string;

  switch (data.action) {
    case 'approve':
      status = 'approved';
      actionMessage = 'मंजूरी';
      break;
    case 'reject':
      status = 'rejected';
      actionMessage = 'अस्वीकार';
      break;
    case 'skip':
      status = 'skipped';
      actionMessage = 'छोड़ दिया';
      break;
    default:
      throw new Error('अमान्य कार्रवाई');
  }

  const updateQuery = `
    UPDATE parsed_events
    SET
      review_status = $1,
      review_notes = COALESCE(review_notes, '') || CASE WHEN $2 != '' THEN E'\n' || $2 ELSE '' END,
      reviewed_at = $3,
      reviewed_by = $4,
      needs_review = false,
      updated_at = NOW()
    WHERE tweet_id = $5
  `;

  const updateResult = await pool.query(updateQuery, [
    status,
    data.notes || '',
    now,
    reviewerId,
    data.id
  ]);

  if (updateResult.rowCount === 0) {
    throw new Error('ट्वीट नहीं मिला');
  }

  console.log(`Review action: ${data.action}`, {
    tweetId: data.id,
    action: data.action,
    notes: data.notes,
    reviewerId
  });
}

export async function POST(request: NextRequest): Promise<NextResponse<ReviewUpdateResponse>> {
  try {
    // Parse and validate request body
    let body: ReviewUpdateRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'अमान्य अनुरोध डेटा' },
        { status: 400 }
      );
    }

    // Validate and sanitize input
    const sanitizedData = validateAndSanitizeInput(body);

    // Handle different action types
    if (sanitizedData.action) {
      // Approval/Rejection/Skip action
      await handleReviewAction(sanitizedData);

      let message: string;
      switch (sanitizedData.action) {
        case 'approve':
          message = 'ट्वीट मंजूरी दे दी गई';
          break;
        case 'reject':
          message = 'ट्वीट अस्वीकार कर दिया गया';
          break;
        case 'skip':
          message = 'ट्वीट छोड़ दिया गया';
          break;
      }

      return NextResponse.json({
        success: true,
        message
      });

    } else {
      // Edit action
      await updateTweetReview(sanitizedData);

      return NextResponse.json({
        success: true,
        message: 'समीक्षा अपडेट हो गई'
      });
    }

  } catch (error) {
    console.error('Review update error:', error);

    const errorMessage = error instanceof Error ? error.message : 'अज्ञात त्रुटि';

    // Map common errors to Hindi
    let hindiError = errorMessage;
    if (errorMessage.includes('violates check constraint')) {
      hindiError = 'अमान्य डेटा';
    } else if (errorMessage.includes('connection')) {
      hindiError = 'डेटाबेस कनेक्शन त्रुटि';
    }

    return NextResponse.json(
      { success: false, error: hindiError },
      { status: 500 }
    );
  }
}

// GET method not supported
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, error: 'विधि समर्थित नहीं' },
    { status: 405 }
  );
}
