import { NextApiRequest, NextApiResponse } from 'next';
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatusResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      authenticated: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Get session token from cookie
    const token = req.cookies.admin_token;

    if (!token) {
      return res.status(200).json({
        authenticated: false
      });
    }

    // Validate token
    const user = validateSessionToken(token);

    if (!user) {
      return res.status(200).json({
        authenticated: false
      });
    }

    // Calculate expiry time from token
    const tokenParts = token.split(':');
    if (tokenParts.length >= 2) {
      const expiryTimestamp = parseInt(tokenParts[1]);
      const expiresAt = new Date(expiryTimestamp).toISOString();

      return res.status(200).json({
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
    return res.status(200).json({
      authenticated: false
    });

  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({
      authenticated: false,
      error: 'Status check service unavailable'
    });
  }
}
