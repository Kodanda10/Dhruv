import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '../login/route';

interface StatusResponse {
  authenticated: boolean;
  user?: {
    id: string;
    username: string;
    role: 'admin';
  };
  expiresAt?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<StatusResponse>> {
  try {
    // Get session token from cookie
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({
        authenticated: false
      });
    }

    // Validate token
    const user = validateSessionToken(token);

    if (!user) {
      return NextResponse.json({
        authenticated: false
      });
    }

    // Calculate expiry time from token
    const tokenParts = token.split(':');
    if (tokenParts.length >= 2) {
      const expiryTimestamp = parseInt(tokenParts[1]);
      const expiresAt = new Date(expiryTimestamp).toISOString();

      return NextResponse.json({
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        },
        expiresAt
      });
    }

    // Fallback for malformed tokens
    return NextResponse.json({
      authenticated: false
    });

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

// POST method not supported for status
export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
