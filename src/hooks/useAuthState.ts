import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isOwnerAdmin: boolean;
  role: 'admin' | 'writer' | null;
}

/**
 * React hook for authenticated staff identity.
 * Roles and permissions derive SOLELY from verified Firebase Custom Claims on the ID token.
 * No hardcoded emails, domains, or client-side bypasses.
 */
export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    isAdmin: false,
    isOwnerAdmin: false,
    role: null
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setState({
          user: null,
          loading: false,
          isAdmin: false,
          isOwnerAdmin: false,
          role: null
        });
        return;
      }

      try {
        // Fetch fresh ID token result to read custom claims (role)
        const tokenResult = await currentUser.getIdTokenResult(true);
        const role = (tokenResult.claims.role as 'admin' | 'writer') || null;

        const isWriter = role === 'writer';
        const isOwnerAdmin = role === 'admin';
        // isAdmin is true if user has staff privileges (admin or writer) for editorial views
        const isAdmin = isOwnerAdmin || isWriter;

        setState({
          user: currentUser,
          loading: false,
          isAdmin,
          isOwnerAdmin,
          role
        });
      } catch (err) {
        console.warn('[Auth State] Error retrieving custom claims:', err);
        setState({
          user: currentUser,
          loading: false,
          isAdmin: false,
          isOwnerAdmin: false,
          role: null
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return state;
}
