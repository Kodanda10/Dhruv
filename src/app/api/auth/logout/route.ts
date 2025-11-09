import { NextRequest, NextResponse } from 'next/server';

interface LogoutResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<LogoutResponse>> {
  try {
    console.log('Logout request:', {
      timestamp: new Date().toISOString(),
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || 'unknown'
    });

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    // Clear the admin session cookie
    response.cookies.set('admin_token', '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Logout service unavailable'
      },
      { status: 500 }
    );
  }
}


