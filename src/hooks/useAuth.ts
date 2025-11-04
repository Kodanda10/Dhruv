/**
 * React hook for authentication state management
 * Security: Handles auth state securely, automatic token validation
 */

import { useState, useEffect, useCallback } from 'react';
import { AuthState, AuthUser, LoginCredentials, checkAuthStatus, login, logout } from '@/lib/auth/auth';

export interface UseAuthReturn extends AuthState {
  loginUser: (credentials: LoginCredentials) => Promise<boolean>;
  logoutUser: () => Promise<boolean>;
  refreshAuth: () => Promise<void>;
}

/**
 * Custom hook for authentication state management
 */
export function useAuth(): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true, // Start with loading true to check initial status
    error: null,
  });

  /**
   * Refresh authentication status
   */
  const refreshAuth = useCallback(async () => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const status = await checkAuthStatus();
      setAuthState(status);
    } catch (error) {
      console.error('Failed to refresh auth:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: 'Failed to check authentication status',
      });
    }
  }, []);

  /**
   * Login user with credentials
   */
  const loginUser = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await login(credentials);

      if (result.success) {
        // Refresh auth status to get updated user info
        await refreshAuth();
        return true;
      } else {
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: result.error || 'Login failed',
        });
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: 'Login request failed',
      });
      return false;
    }
  }, [refreshAuth]);

  /**
   * Logout current user
   */
  const logoutUser = useCallback(async (): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await logout();

      if (result.success) {
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: null,
        });
        return true;
      } else {
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: result.error || 'Logout failed',
        }));
        return false;
      }
    } catch (error) {
      console.error('Logout error:', error);
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: 'Logout request failed',
      }));
      return false;
    }
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  return {
    ...authState,
    loginUser,
    logoutUser,
    refreshAuth,
  };
}
