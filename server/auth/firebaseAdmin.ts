import { initializeApp, getApps, applicationDefault, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0638643565';

if (getApps().length === 0) {
  try {
    initializeApp({
      projectId,
      // Automatically uses Application Default Credentials (ADC) in Google Cloud Run and Google Cloud Shell
      credential: applicationDefault()
    });
  } catch (err: any) {
    // If ADC is not yet active in local non-GCP dev, fallback to projectId init so server boots cleanly
    console.warn('[Firebase Admin] ADC initialization notice:', err?.message || err);
    try {
      initializeApp({ projectId });
    } catch (_) {}
  }
}

export const adminApp = getApps().length > 0 ? getApp() : null;
export const adminAuth = getAuth();
