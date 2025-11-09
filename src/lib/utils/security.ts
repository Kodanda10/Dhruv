import { randomBytes } from 'crypto';

/**
 * Secure random string generation utility
 * Replaces insecure Math.random() usage throughout the application
 */
export function generateSecureRandomString(length: number = 9): string {
  return randomBytes(length).toString('base64').replace(/[+/=]/g, '').substring(0, length);
}

/**
 * Generate a secure random ID (8 characters)
 */
export function generateSecureId(): string {
  return generateSecureRandomString(8);
}

/**
 * Generate a secure trace ID for logging
 */
export function generateSecureTraceId(): string {
  return generateSecureRandomString(8);
}

/**
 * Sanitize input to prevent XSS attacks
 */
export function sanitizeInput(
  input: string,
  options: { maxLength?: number; allowHtml?: boolean } = {}
): string {
  const { maxLength = 10000, allowHtml = false } = options;
  
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Trim and limit length
  let sanitized = input.trim().substring(0, maxLength);

  // Remove HTML tags if not allowed
  if (!allowHtml) {
    sanitized = sanitized
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  return sanitized;
}
