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
