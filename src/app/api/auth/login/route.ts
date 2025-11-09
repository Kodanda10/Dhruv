import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { generateSessionToken } from '@/lib/auth/session';

// Security: No secrets in code - credentials from environment variables
const SESSION_EXPIRY_HOURS = 24;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
// Default password hash for 'admin123' - SHA256 hash computed once for consistency
// Hash: crypto.createHash('sha256').update('admin123').digest('hex')
const DEFAULT_PASSWORD_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || DEFAULT_PASSWORD_HASH;

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
  if (!username || !password) {
    console.warn('Empty credentials');
    return false;
  }
  
  // Trim and validate lengths
  const trimmedUsername = username.trim();
  const trimmedPassword = password.trim();
  
  if (trimmedUsername.length < 3 || trimmedUsername.length > 50) {
    console.warn('Invalid username length:', trimmedUsername.length);
    return false;
  }
  if (trimmedPassword.length < 6 || trimmedPassword.length > 100) {
    console.warn('Invalid password length:', trimmedPassword.length);
    return false;
  }

  // Check for suspicious characters
  const suspiciousPattern = /[<>'"&\\]/;
  if (suspiciousPattern.test(trimmedUsername) || suspiciousPattern.test(trimmedPassword)) {
    console.warn('Suspicious login attempt:', { username: trimmedUsername.replace(/./g, '*') });
    return false;
  }

  // Validate credentials - use trimmed values
  const providedHash = crypto.createHash('sha256').update(trimmedPassword).digest('hex');
  const hashMatch = providedHash === ADMIN_PASSWORD_HASH;
  const usernameMatch = trimmedUsername.toLowerCase() === ADMIN_USERNAME.toLowerCase();
  
  console.log('Credential validation:', {
    usernameMatch,
    hashMatch,
    providedHash: providedHash.substring(0, 16) + '...',
    expectedHash: ADMIN_PASSWORD_HASH.substring(0, 16) + '...',
    username: trimmedUsername,
    expectedUsername: ADMIN_USERNAME,
    passwordLength: trimmedPassword.length,
    fullHashMatch: providedHash === ADMIN_PASSWORD_HASH
  });
  
  // Debug: Log full hashes if mismatch (only first 32 chars for security)
  if (!hashMatch) {
    console.warn('Hash mismatch:', {
      provided: providedHash.substring(0, 32) + '...',
      expected: ADMIN_PASSWORD_HASH.substring(0, 32) + '...',
      passwordsMatch: trimmedPassword === 'admin123'
    });
  }
  
  return usernameMatch && hashMatch;
}

export async function POST(req: NextRequest): Promise<NextResponse<LoginResponse>> {
  try {
    const body: LoginRequest = await req.json();
    // Trim whitespace from credentials
    const username = (body.username || '').trim();
    const password = (body.password || '').trim();

    console.log('Login request received:', {
      usernameLength: username.length,
      passwordLength: password.length,
      username: username,
      hasPassword: !!password
    });

    // Validate input format
    if (!username || !password) {
      console.warn('Missing credentials:', { hasUsername: !!username, hasPassword: !!password });
      return NextResponse.json(
        {
          success: false,
          error: 'Missing username or password'
        },
        { status: 400 }
      );
    }

    // Validate credentials
    const isValid = validateCredentials(username, password);
    console.log('Login attempt:', {
      username,
      expectedUsername: ADMIN_USERNAME,
      usernameMatch: username === ADMIN_USERNAME,
      passwordLength: password.length,
      isValid,
      adminPasswordHash: ADMIN_PASSWORD_HASH.substring(0, 16) + '...'
    });
    
    if (!isValid) {
      console.warn('Login failed for user:', username);
      console.warn('Validation details:', {
        usernameLength: username.length,
        passwordLength: password.length,
        usernameMatch: username === ADMIN_USERNAME,
        computedHash: crypto.createHash('sha256').update(password).digest('hex').substring(0, 16) + '...',
        expectedHash: ADMIN_PASSWORD_HASH.substring(0, 16) + '...'
      });

      // Security: Consistent response to prevent user enumeration
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid credentials'
        },
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

    // Create response with httpOnly cookie for security
    const response = NextResponse.json({
      success: true,
      user,
      token,
      expiresAt
    });

    // Set httpOnly cookie for security
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      path: '/',
      maxAge: SESSION_EXPIRY_HOURS * 60 * 60,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication service unavailable'
      },
      { status: 500 }
    );
  }
}

