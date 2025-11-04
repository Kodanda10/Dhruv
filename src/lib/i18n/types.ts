/**
 * TypeScript interfaces for internationalization
 * TDD: Type safety for all translation operations
 */

/**
 * Translation map interface
 */
export interface TranslationMap {
  [key: string]: string;
}

/**
 * Translation options for flexible lookups
 */
export interface TranslationOptions {
  fallback?: string;
  caseSensitive?: boolean;
  trim?: boolean;
}

/**
 * Translation result with metadata
 */
export interface TranslationResult {
  original: string;
  translated: string;
  found: boolean;
  fallbackUsed: boolean;
}

/**
 * Event type translation interface
 */
export interface EventTypeTranslation {
  english: string;
  hindi: string;
  category?: string;
  description?: string;
}

/**
 * Bulk translation request
 */
export interface BulkTranslationRequest {
  items: string[];
  options?: TranslationOptions;
}

/**
 * Bulk translation response
 */
export interface BulkTranslationResponse {
  results: TranslationResult[];
  summary: {
    total: number;
    translated: number;
    fallback: number;
    notFound: number;
  };
}
