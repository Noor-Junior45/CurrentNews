import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App strictly for Firebase Authentication (Google Sign-In)
// All reader-side data, stats, reactions, subscribers & pen names are handled via Cloudflare D1
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
