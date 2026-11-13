import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { PushNotifications, type Token, type RegistrationError } from '@capacitor/push-notifications';
import { READER_SERVER_BASE_URL } from './webBase';

const REGISTERED_TOKEN_STORAGE_KEY = 'cn_fcm_registered_token';
const CURRENT_TOKEN_STORAGE_KEY = 'cn_fcm_current_token';
const EXPLICIT_OPT_OUT_STORAGE_KEY = 'cn_native_push_user_opted_out';
const SUBSCRIBE_URL = `${READER_SERVER_BASE_URL}/api/push/subscribe`;
const UNSUBSCRIBE_URL = `${READER_SERVER_BASE_URL}/api/push/unsubscribe`;

let listenersAttached = false;
let inFlightToken: string | null = null;

function isNativePushPluginAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('PushNotifications');
}

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
 * Sends the native FCM token to the reader server once per unique token (or when forced).
 * Handles both initial registration and background token refreshes identically.
 */
async function syncFcmTokenToServer(rawToken: string, force = false): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const token = (rawToken || '').trim();
  if (!token) return false;

  localStorage.setItem(CURRENT_TOKEN_STORAGE_KEY, token);

  // Respect explicit user opt-out in Settings unless forced by an explicit opt-in action
  if (!force && localStorage.getItem(EXPLICIT_OPT_OUT_STORAGE_KEY) === 'true') {
    return false;
  }

  // Only send once per token unless explicitly forced
  if (!force && localStorage.getItem(REGISTERED_TOKEN_STORAGE_KEY) === token) {
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
      localStorage.removeItem(EXPLICIT_OPT_OUT_STORAGE_KEY);
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
  if (!isNativePushPluginAvailable() || listenersAttached) return;
  listenersAttached = true;

  void PushNotifications.addListener('registration', (token: Token) => {
    void syncFcmTokenToServer(token.value);
  }).catch((err) => {
    listenersAttached = false;
    console.warn('[NativePush] Failed to attach registration listener:', err);
  });

  void PushNotifications.addListener('registrationError', (err: RegistrationError) => {
    console.warn('[NativePush] FCM registration error:', err.error);
  }).catch(() => {});
}

/**
 * Initializes native push notifications on app launch (Android APK only).
 * Requests permission if not explicitly opted out by the user in Settings, registers with FCM,
 * and posts the token to the reader server once per token (and on token refresh).
 * Also recovers registration automatically if user enabled notifications in Android Phone Settings.
 */
export async function initNativePush(): Promise<void> {
  if (!isNativePushPluginAvailable()) return;

  ensureNativePushListeners();

  // Respect explicit user opt-out from the in-app Settings toggle
  if (localStorage.getItem(EXPLICIT_OPT_OUT_STORAGE_KEY) === 'true') {
    return;
  }

  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive !== 'granted') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive === 'granted') {
      localStorage.setItem('browser_notifications_enabled', 'true');
      window.dispatchEvent(new Event('settings-updated'));
      await PushNotifications.register();

      const existingToken = localStorage.getItem(CURRENT_TOKEN_STORAGE_KEY);
      if (existingToken && localStorage.getItem(REGISTERED_TOKEN_STORAGE_KEY) !== existingToken) {
        await syncFcmTokenToServer(existingToken);
      }
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

  if (!isNativePushPluginAvailable()) {
    return {
      success: false,
      message: 'Native Push Notifications plugin is not ready in this build. Please rebuild and sync the Android project.',
    };
  }

  ensureNativePushListeners();

  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive !== 'granted') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      localStorage.setItem('browser_notifications_enabled', 'false');
      window.dispatchEvent(new Event('settings-updated'));
      return {
        success: false,
        message: 'Notification permission was denied. Enable notifications in Android App Settings.',
      };
    }

    localStorage.removeItem(EXPLICIT_OPT_OUT_STORAGE_KEY);
    localStorage.removeItem(REGISTERED_TOKEN_STORAGE_KEY);
    localStorage.setItem('browser_notifications_enabled', 'true');
    window.dispatchEvent(new Event('settings-updated'));

    await PushNotifications.register();

    // If a token was already cached before registration event completes, ensure it is registered on server
    const existingToken = localStorage.getItem(CURRENT_TOKEN_STORAGE_KEY);
    if (existingToken) {
      await syncFcmTokenToServer(existingToken, true);
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

    if (isNativePushPluginAvailable()) {
      await PushNotifications.unregister().catch(() => {});
    }

    localStorage.removeItem(REGISTERED_TOKEN_STORAGE_KEY);
    localStorage.removeItem(CURRENT_TOKEN_STORAGE_KEY);
    localStorage.setItem(EXPLICIT_OPT_OUT_STORAGE_KEY, 'true');
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
  if (!isNativePushPluginAvailable()) return false;
  if (localStorage.getItem(EXPLICIT_OPT_OUT_STORAGE_KEY) === 'true') {
    return false;
  }

  try {
    const permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive !== 'granted') {
      return false;
    }
    return localStorage.getItem('browser_notifications_enabled') !== 'false' || !localStorage.getItem(EXPLICIT_OPT_OUT_STORAGE_KEY);
  } catch {
    return false;
  }
}
