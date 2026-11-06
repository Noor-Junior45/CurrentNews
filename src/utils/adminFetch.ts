import { auth } from '../firebase';

export interface AdminFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  code?: string;
  raw: Response;
}

/**
 * Maps error codes from requireRole / edge auth to clear, human-readable user messages.
 */
export function formatAuthErrorMessage(code?: string, fallbackMessage?: string): string {
  switch (code) {
    case 'token_expired':
      return 'Session expired. Please sign out and sign in again';
    case 'token_revoked':
      return 'Session expired, please sign out and sign in again';
    case 'no_role':
      return 'Your account has no admin role yet';
    case 'no_token':
      return 'No authorization token found. Please sign in.';
    case 'invalid_token':
      return 'Invalid authentication credentials. Please sign out and sign in again.';
    case 'email_not_verified':
      return 'Your email address must be verified before accessing admin features.';
    case 'forbidden':
      return 'Access forbidden: your account does not have sufficient admin permissions.';
    case 'auth_backend_error':
      return 'Authentication backend service error. Please try again shortly.';
    default:
      return fallbackMessage || 'Authentication error: please verify your admin permissions.';
  }
}

/**
 * Universal admin fetch helper:
 * - Automatically attaches Firebase ID token to the Authorization header
 * - Sets default JSON Content-Type for POST/PUT/PATCH
 * - Catches token_expired and token_revoked responses, forces token refresh via auth.currentUser.getIdToken(true),
 *   and retries the request once
 * - Formats error codes into readable banner messages
 */
export async function adminFetch<T = any>(
  input: string | URL,
  init: RequestInit = {}
): Promise<AdminFetchResult<T>> {
  const getToken = async (forceRefresh = false): Promise<string | null> => {
    try {
      const user = auth.currentUser;
      if (!user) return null;
      return await user.getIdToken(forceRefresh);
    } catch (e) {
      console.debug('[adminFetch] Error retrieving ID token:', e);
      return null;
    }
  };

  const execute = async (token: string | null) => {
    const headers = new Headers(init.headers || {});
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Content-Type') && init.method && init.method !== 'GET') {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(input, {
      ...init,
      headers
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json().catch(() => null) : null;
    const code = (data?.code as string | undefined) || undefined;

    return { res, data, code };
  };

  // 1. Initial attempt with standard token
  let token = await getToken(false);
  let { res, data, code } = await execute(token);

  // 2. If rejection code is token_expired or token_revoked, force refresh and retry ONCE
  if (!res.ok && (code === 'token_expired' || code === 'token_revoked')) {
    console.warn(`[adminFetch] Received ${code}. Forcing token refresh and retrying once...`);
    const freshToken = await getToken(true);
    if (freshToken) {
      const retryResult = await execute(freshToken);
      res = retryResult.res;
      data = retryResult.data;
      code = retryResult.code;
    }
  }

  // 3. If still not OK, construct readable error message
  if (!res.ok) {
    const rawError = data?.error || data?.message || `HTTP ${res.status}: ${res.statusText}`;
    const readableError = formatAuthErrorMessage(code, rawError);

    return {
      ok: false,
      status: res.status,
      data,
      error: readableError,
      code,
      raw: res
    };
  }

  return {
    ok: true,
    status: res.status,
    data,
    error: null,
    code,
    raw: res
  };
}
