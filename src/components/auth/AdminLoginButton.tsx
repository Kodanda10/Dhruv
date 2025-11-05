/**
 * Admin Login Button Component
 * Security: Secure authentication UI with accessibility compliance
 * WCAG 2.1 AA: Keyboard navigation, screen reader support, color contrast
 */

'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LoginCredentials } from '@/lib/auth/auth';

interface AdminLoginButtonProps {
  className?: string;
}

export default function AdminLoginButton({ className = '' }: AdminLoginButtonProps) {
  const { isAuthenticated, user, loginUser, logoutUser, loading, error } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: '',
    password: '',
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const success = await loginUser(credentials);
      if (success) {
        setShowModal(false);
        setCredentials({ username: '', password: '' });
      }
    } catch (err) {
      setLoginError('Login failed. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
  };

  const handleInputChange = (field: keyof LoginCredentials) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCredentials(prev => ({
        ...prev,
        [field]: e.target.value
      }));
    };

  if (isAuthenticated && user) {
    return (
      <button
        onClick={handleLogout}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${className}`}
        aria-label="Admin logout"
        disabled={loading}
      >
        <span>Admin: {user.username}</span>
        <span className="text-xs">⎋</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${className}`}
        aria-label="Admin login"
        disabled={loading}
      >
        <span>🔑</span>
        <span>Admin Login</span>
      </button>

      {/* Login Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="glassmorphic-card w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white">Admin Login</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-300 hover:text-white"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-white mb-1">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={credentials.username}
                  onChange={handleInputChange('username')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  autoComplete="username"
                  disabled={loginLoading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={credentials.password}
                  onChange={handleInputChange('password')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  autoComplete="current-password"
                  disabled={loginLoading}
                />
              </div>

              {(loginError || error) && (
                <div className="text-red-600 text-sm" role="alert">
                  {loginError || error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                  disabled={loginLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loginLoading}
                >
                  {loginLoading ? 'Logging in...' : 'Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
