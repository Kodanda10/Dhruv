import * as crypto from 'crypto';

const SESSION_EXPIRY_HOURS = 24;
const TOKEN_SECRET = process.env.SESSION_SECRET || 'default-session-secret-change-in-production';

/**
 * Generate secure session token
 */
export function generateSessionToken(userId: string): string {
  const timestamp = Date.now();
  const expiry = timestamp + (SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  const payload = `${userId}:${expiry}`;
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}:${signature}`;
}

/**
 * Validate session token
 */
export function validateSessionToken(token: string): { id: string; username: string; role: 'admin' } | null {
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return null;

    const [userId, expiryStr, signature] = parts;
    const expiry = parseInt(expiryStr);

    // Check expiry
    if (Date.now() > expiry) return null;

    // Verify signature
    const payload = `${userId}:${expiryStr}`;
    const expectedSignature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');

    if (signature !== expectedSignature) return null;

    return {
      id: userId,
      username: userId, // For simplicity, username is same as ID
      role: 'admin'
    };
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}
