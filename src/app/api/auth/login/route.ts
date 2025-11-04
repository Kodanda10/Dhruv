import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Security: No secrets in code - credentials from environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ||
  crypto.createHash('sha256').update('admin123').digest('hex'); // Default for development

// Session token configuration
const SESSION_EXPIRY_HOURS = 24;
const TOKEN_SECRET = process.env.SESSION_SECRET || 'default-session-secret-change-in-production';

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
 * Generate secure session token
 */
function generateSessionToken(userId: string): string {
  const timestamp = Date.now();
  const expiry = timestamp + (SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  const payload = `${userId}:${expiry}`;
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}:${signature}`;
}

/**
 * Validate session token
 */
export function validateSessionToken(token: string): AuthUser | null {
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

export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  try {
    // Parse and validate request body
    let body: LoginRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { username, password } = body;

    // Validate input format
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing username or password' },
        { status: 400 }
      );
    }

    // Validate credentials
    if (!validateCredentials(username, password)) {
      console.warn('Login failed for user:', username);

      // Security: Consistent response to prevent user enumeration
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
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

    // Create response with secure cookie
    const response = NextResponse.json({
      success: true,
      user,
      token,
      expiresAt
    });

    // Set httpOnly cookie for security
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_EXPIRY_HOURS * 60 * 60, // seconds
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication service unavailable' },
      { status: 500 }
    );
  }
}

// GET method not supported for login
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}
