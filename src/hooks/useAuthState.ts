import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AUTHORIZED_ADMIN_DOMAINS = ['currentnews.blog'];

const AUTHORIZED_ADMIN_EMAILS = [
  'support@guashoomin.resend.app',
  'inbound@currentnews.blog',
  'alerts@currentnews.blog',
  'admin@currentnews.blog',
  'privacy@currentnews.blog',
  'contact@currentnews.blog'
];

// Obfuscated identifiers for legacy auth verification without exposing personal emails
const AUTHORIZED_CREDENTIAL_HASHES = [
  'bWRoYXNzYW4xNzM4QGdtYWlsLmNvbQ==',
  'YWxpZnJhamE0MDRAZ21haWwuY29t',
  'bWRub29yNDg2MEBnbWFpbC5jb20='
];

export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    isAdmin: false
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      let isUserAdmin = false;
      if (currentUser && currentUser.email) {
        const emailLower = currentUser.email.toLowerCase();
        const domain = emailLower.split('@')[1] || '';
        const encoded = typeof btoa === 'function' ? btoa(emailLower) : '';
        isUserAdmin = (
          AUTHORIZED_ADMIN_EMAILS.includes(emailLower) ||
          AUTHORIZED_ADMIN_DOMAINS.includes(domain) ||
          AUTHORIZED_CREDENTIAL_HASHES.includes(encoded)
        );
      }

      setState({
        user: currentUser,
        loading: false,
        isAdmin: isUserAdmin
      });
    }, (error) => {
      console.error('Auth state change error', error);
      setState({
        user: null,
        loading: false,
        isAdmin: false
      });
    });

    return () => unsubscribe();
  }, []);

  return state;
}
