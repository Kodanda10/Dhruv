/**
 * Authentication utilities for admin access control
 * Security: No secrets in code, secure token handling
 */

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin';
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * Check if user is authenticated by calling status endpoint
 */
export async function checkAuthStatus(): Promise<AuthState> {
  try {
    const response = await fetch('/api/auth/status', {
      method: 'GET',
      credentials: 'include', // Include cookies
      cache: 'no-store', // Ensure fresh check
    });

    if (!response.ok) {
      console.warn('Auth status check failed:', response.status, response.statusText);
      return {
        isAuthenticated: false,
        user: null,
        loading: false,
        error: 'Failed to check authentication status'
      };
    }

    const data = await response.json();
    console.log('Auth status response:', { authenticated: data.authenticated, user: data.user });

    return {
      isAuthenticated: data.authenticated || false,
      user: data.user || null,
      loading: false,
      error: null
    };
  } catch (error) {
    console.error('Auth status check failed:', error);
    return {
      isAuthenticated: false,
      user: null,
      loading: false,
      error: 'Network error'
    };
  }
}

/**
 * Login with credentials
 */
export async function login(credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> {
  try {
    // Trim credentials before sending
    const trimmedCredentials = {
      username: (credentials.username || '').trim(),
      password: (credentials.password || '').trim()
    };
    
    console.log('Sending login request:', {
      username: trimmedCredentials.username,
      passwordLength: trimmedCredentials.password.length
    });
    
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify(trimmedCredentials),
    });

    const data = await response.json();
    console.log('Login response:', { success: data.success, error: data.error });

    if (data.success) {
      console.log('Login successful');
      return { success: true };
    } else {
      console.warn('Login failed:', data.error);
      return { success: false, error: data.error || 'Login failed' };
    }
  } catch (error) {
    console.error('Login request failed:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Logout current user
 */
export async function logout(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
    });

    const data = await response.json();

    if (data.success) {
      console.log('Logout successful');
      return { success: true };
    } else {
      console.warn('Logout failed:', data.error);
      return { success: false, error: data.error || 'Logout failed' };
    }
  } catch (error) {
    console.error('Logout request failed:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Check if current user has admin role
 */
export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin';
}

/**
 * Get display name for user
 */
export function getUserDisplayName(user: AuthUser | null): string {
  if (!user) return '';
  return user.username || user.id;
}
