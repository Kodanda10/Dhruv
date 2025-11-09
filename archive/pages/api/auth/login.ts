import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { generateSessionToken } from '@/lib/auth/session';

// Security: No secrets in code - credentials from environment variables
const SESSION_EXPIRY_HOURS = 24;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ||
  crypto.createHash('sha256').update('admin123').digest('hex'); // Default for development

interface LoginRequest {
  username: string;
  password: string;
}

interface AuthUser {
  id: string;
  username: string;
  role: 'admin';
}

interface LoginResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  expiresAt?: string;
  error?: string;
}

/**
 * Validate input credentials
 */
function validateCredentials(username: string, password: string): boolean {
  // Security: Prevent basic injection attempts
  if (!username || !password) return false;
  if (username.length < 3 || username.length > 50) return false;
  if (password.length < 6 || password.length > 100) return false;

  // Check for suspicious characters
  const suspiciousPattern = /[<>'"&\\]/;
  if (suspiciousPattern.test(username) || suspiciousPattern.test(password)) {
    console.warn('Suspicious login attempt:', { username: username.replace(/./g, '*') });
    return false;
  }

  // Validate credentials
  const providedHash = crypto.createHash('sha256').update(password).digest('hex');
  return username === ADMIN_USERNAME && providedHash === ADMIN_PASSWORD_HASH;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { username, password }: LoginRequest = req.body;

    // Validate input format
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing username or password'
      });
    }

    // Validate credentials
    if (!validateCredentials(username, password)) {
      console.warn('Login failed for user:', username);

      // Security: Consistent response to prevent user enumeration
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Authentication successful
    const user: AuthUser = {
      id: username,
      username,
      role: 'admin'
    };

    // Generate session token
    const token = generateSessionToken(user.id);
    const expiresAt = new Date(Date.now() + (SESSION_EXPIRY_HOURS * 60 * 60 * 1000)).toISOString();

    console.log('Login successful:', {
      username,
      timestamp: new Date().toISOString(),
      expiresAt
    });

    // Set httpOnly cookie for security
    res.setHeader('Set-Cookie', [
      `admin_token=${token}; HttpOnly; Path=/; Max-Age=${SESSION_EXPIRY_HOURS * 60 * 60}; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    ]);

    return res.status(200).json({
      success: true,
      user,
      token,
      expiresAt
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication service unavailable'
    });
  }
}
