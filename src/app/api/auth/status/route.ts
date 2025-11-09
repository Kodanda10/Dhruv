import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/auth/session';

interface StatusResponse {
  authenticated: boolean;
  user?: {
    id: string;
    username: string;
    role: 'admin';
  };
  expiresAt?: string;
  error?: string;
}

export async function GET(req: NextRequest): Promise<NextResponse<StatusResponse>> {
  try {
    // Get session token from cookie
    const token = req.cookies.get('admin_token')?.value;

    console.log('Auth status check:', { 
      hasToken: !!token, 
      tokenLength: token?.length,
      cookies: req.cookies.getAll().map(c => c.name)
    });

    if (!token) {
      return NextResponse.json({
        authenticated: false
      }, { status: 200 });
    }

    // Validate token
    const user = validateSessionToken(token);

    if (!user) {
      console.warn('Token validation failed');
      return NextResponse.json({
        authenticated: false
      }, { status: 200 });
    }

    // Calculate expiry time from token
    const tokenParts = token.split(':');
    if (tokenParts.length >= 2) {
      const expiryTimestamp = parseInt(tokenParts[1]);
      const expiresAt = new Date(expiryTimestamp).toISOString();

      console.log('Auth status: authenticated', { username: user.username, expiresAt });

      return NextResponse.json({
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        },
        expiresAt
      }, { status: 200 });
    }

    // Fallback for malformed tokens
    console.warn('Malformed token');
    return NextResponse.json({
      authenticated: false
    }, { status: 200 });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      {
        authenticated: false,
        error: 'Status check service unavailable'
      },
      { status: 500 }
    );
  }
}

