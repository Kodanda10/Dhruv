import { cookies } from 'next/headers';
import { validateSessionToken } from './session';
import { NextRequest } from 'next/server';

export function getAdminSession() {
  const token = cookies().get('admin_token')?.value;
  if (!token) {
    return null;
  }
  return validateSessionToken(token);
}

export function validateAdminSession(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) {
    return null;
  }
  return validateSessionToken(token);
}
