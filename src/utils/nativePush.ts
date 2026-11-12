import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { PushNotifications, type Token, type RegistrationError } from '@capacitor/push-notifications';
import { READER_SERVER_BASE_URL } from './webBase';

const REGISTERED_TOKEN_STORAGE_KEY = 'cn_fcm_registered_token';
const CURRENT_TOKEN_STORAGE_KEY = 'cn_fcm_current_token';
const SUBSCRIBE_URL = `${READER_SERVER_BASE_URL}/api/push/subscribe`;
const UNSUBSCRIBE_URL = `${READER_SERVER_BASE_URL}/api/push/unsubscribe`;

let listenersAttached = false;
let inFlightToken: string | null = null;

async function postJsonNativeSafe(
  url: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: payload,
      connectTimeout: 10000,
      readTimeout: 10000,
    });
    const ok = res.status >= 200 && res.status < 300;
    const errMsg =
      !ok && res.data && typeof res.data === 'object' && 'error' in res.data
        ? String((res.data as Record<string, unknown>).error)
        : undefined;
    return { ok, status: res.status, error: errMsg };
  } catch {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let errMsg: string | undefined;
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (errData && typeof errData.error === 'string') {
        errMsg = errData.error;
      }
    }
    return { ok: response.ok, status: response.status, error: errMsg };
  }
}

/**
 * Sends the native FCM token to the reader server once per unique token.
 * Handles both initial registration and background token refreshes identically.
 */
async function syncFcmTokenToServer(rawToken: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const token = (rawToken || '').trim();
  if (!token) return false;

  localStorage.setItem(CURRENT_TOKEN_STORAGE_KEY, token);

  // Respect explicit user opt-out in Settings
  if (localStorage.getItem('browser_notifications_enabled') === 'false') {
    return false;
  }

  // Only send once per token
  if (localStorage.getItem(REGISTERED_TOKEN_STORAGE_KEY) === token) {
    return true;
  }

  if (inFlightToken === token) {
    return true;
  }

  inFlightToken = token;
  try {
    const result = await postJsonNativeSafe(SUBSCRIBE_URL, {
      endpoint: 'fcm:' + token,
      keys: {
        p256dh: 'fcm',
        auth: 'fcm',
      },
      userAgent: 'android-app',
    });

    if (result.ok) {
      localStorage.setItem(REGISTERED_TOKEN_STORAGE_KEY, token);
      localStorage.setItem('browser_notifications_enabled', 'true');
      window.dispatchEvent(new Event('settings-updated'));
      return true;
    }

    console.warn('[NativePush] Server rejected FCM subscribe:', result.status, result.error);
    return false;
  } catch (err) {
    console.warn('[NativePush] Failed to register FCM token with server:', err);
    return false;
  } finally {
    if (inFlightToken === token) {
      inFlightToken = null;
    }
  }
}

function ensureNativePushListeners(): void {
  if (!Capacitor.isNativePlatform() || listenersAttached) return;
  listenersAttached = true;

  void PushNotifications.addListener('registration', (token: Token) => {
    void syncFcmTokenToServer(token.value);
  });

  void PushNotifications.addListener('registrationError', (err: RegistrationError) => {
    console.warn('[NativePush] FCM registration error:', err.error);
  });
}

/**
 * Initializes native push notifications on app launch (Android APK only).
 * Requests permission if not explicitly disabled by user, registers with FCM,
 * and posts the token to the reader server once per token (and on token refresh).
 * Does nothing on web browsers.
 */
export async function initNativePush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  ensureNativePushListeners();

  // If user explicitly turned off push notifications in Settings, keep it off
  if (localStorage.getItem('browser_notifications_enabled') === 'false') {
    return;
  }

  try {
    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive === 'granted') {
      localStorage.setItem('browser_notifications_enabled', 'true');
      window.dispatchEvent(new Event('settings-updated'));
      await PushNotifications.register();
    } else {
      localStorage.setItem('browser_notifications_enabled', 'false');
      window.dispatchEvent(new Event('settings-updated'));
    }
  } catch (err) {
    console.warn('[NativePush] Permission or register call failed:', err);
  }
}

/**
 * Triggered when user switches Push Notifications ON in the UI toggle.
 */
export async function subscribeNativePush(): Promise<{ success: boolean; message?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false };
  }

  ensureNativePushListeners();

  try {
    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive !== 'granted') {
      localStorage.setItem('browser_notifications_enabled', 'false');
      window.dispatchEvent(new Event('settings-updated'));
      return {
        success: false,
        message: 'Notification permission was denied. Enable notifications in Android App Settings.',
      };
    }

    localStorage.setItem('browser_notifications_enabled', 'true');
    window.dispatchEvent(new Event('settings-updated'));

    await PushNotifications.register();

    // If a token was already cached before registration event completes, ensure it is registered once
    const existingToken = localStorage.getItem(CURRENT_TOKEN_STORAGE_KEY);
    if (existingToken && localStorage.getItem(REGISTERED_TOKEN_STORAGE_KEY) !== existingToken) {
      await syncFcmTokenToServer(existingToken);
    }

    return {
      success: true,
      message: 'Successfully subscribed to automated background alerts!',
    };
  } catch (err: any) {
    console.error('[NativePush] Subscribe failed:', err);
    return {
      success: false,
      message: err?.message || 'Failed to enable native push notifications.',
    };
  }
}

/**
 * Triggered when user switches Push Notifications OFF in the UI toggle.
 */
export async function unsubscribeNativePush(): Promise<{ success: boolean; message?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false };
  }

  try {
    const storedToken =
      localStorage.getItem(REGISTERED_TOKEN_STORAGE_KEY) ||
      localStorage.getItem(CURRENT_TOKEN_STORAGE_KEY);

    if (storedToken) {
      await postJsonNativeSafe(UNSUBSCRIBE_URL, {
        endpoint: 'fcm:' + storedToken,
      }).catch((err) => console.warn('[NativePush] Server unsubscribe warning:', err));
    }

    await PushNotifications.unregister().catch(() => {});

    localStorage.removeItem(REGISTERED_TOKEN_STORAGE_KEY);
    localStorage.removeItem(CURRENT_TOKEN_STORAGE_KEY);
    localStorage.setItem('browser_notifications_enabled', 'false');
    window.dispatchEvent(new Event('settings-updated'));

    return { success: true, message: 'Push notifications disabled.' };
  } catch (err: any) {
    console.error('[NativePush] Unsubscribe failed:', err);
    return {
      success: false,
      message: err?.message || 'Failed to disable native push notifications.',
    };
  }
}

/**
 * Checks whether native Android push notifications are currently enabled and permitted.
 */
export async function isNativePushSubscribed(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (localStorage.getItem('browser_notifications_enabled') === 'false') {
    return false;
  }

  try {
    const permStatus = await PushNotifications.checkPermissions();
    return permStatus.receive === 'granted';
  } catch {
    return false;
  }
}
