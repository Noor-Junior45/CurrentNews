import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from './firebaseAdmin.ts';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role: 'admin' | 'writer' | string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Express middleware to enforce role-based access control via Firebase Custom Claims.
 * Validates ID token, verifies email verification status, checks revocation, and enforces required roles.
 * 
 * @param allowed Roles permitted to access the route (e.g. 'admin', 'writer')
 */
export function requireRole(...allowed: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing or invalid Authorization header'
      });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Empty Bearer token'
      });
    }

    try {
      // checkRevoked = true strictly enforces token validity after role updates or revocation
      const decoded = await adminAuth.verifyIdToken(token, true);

      // Security requirement: email_verified MUST be strictly true
      if (decoded.email_verified !== true) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Email address must be verified'
        });
      }

      const role = (decoded.role as string) || '';

      if (!allowed.includes(role)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Insufficient role permissions'
        });
      }

      // Attach authenticated user identity to request
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        role: role
      };

      return next();
    } catch (err: any) {
      const isRevoked = err?.code === 'auth/id-token-revoked';
      const isExpired = err?.code === 'auth/id-token-expired';

      return res.status(401).json({
        success: false,
        error: isRevoked
          ? 'Unauthorized: Session revoked. Please sign in again.'
          : isExpired
            ? 'Unauthorized: Token expired. Please refresh token.'
            : 'Unauthorized: Invalid authentication credentials'
      });
    }
  };
}
