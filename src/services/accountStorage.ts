/**
 * ZENOX Account-Scoped Storage Manager
 * Dev By Zenox Development
 * 
 * Guarantees strict, airtight data isolation between Google Accounts and
 * Web-Created Accounts. Each account UID has its own isolated namespace.
 */

export function getActiveUserUid(): string {
  if (typeof localStorage === 'undefined') return 'zenox_guest';
  try {
    const raw = localStorage.getItem('gcal_active_user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u?.uid) return String(u.uid);
      if (u?.email) return 'usr_' + String(u.email).toLowerCase().replace(/[^a-z0-9]/g, '_');
    }
  } catch {}
  return 'zenox_guest';
}

/** Global keys that apply to the whole browser instance, not single user data */
const GLOBAL_BROWSER_KEYS = new Set<string>([
  'zenox_vault_accounts',
  'zenox_auth_session',
  'gcal_active_user',
  'zenox_workspace_entered',
  'gcal_theme',
  'gcal_lang',
  'gcal_custom_client_id',
  'vortexcal_sound_enabled',
  'vortex_health_subtab',
]);

/**
 * Derives an account-isolated storage key.
 * Example:
 * Base: 'gcal_events'
 * Web Account: 'zenox-usr-admin' -> 'zenox_acc_zenox-usr-admin__gcal_events'
 * Google Account: 'google-usr123' -> 'zenox_acc_google-usr123__gcal_events'
 */
export function getAccountStorageKey(baseKey: string, explicitUid?: string): string {
  if (GLOBAL_BROWSER_KEYS.has(baseKey)) {
    return baseKey;
  }
  const uid = explicitUid || getActiveUserUid();
  const safeUid = String(uid).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `zenox_acc_${safeUid}__${baseKey}`;
}

export const accountStorage = {
  getItem(key: string, explicitUid?: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    const uid = explicitUid || getActiveUserUid();
    const scopedKey = getAccountStorageKey(key, uid);
    const val = localStorage.getItem(scopedKey);
    if (val !== null) return val;

    // Only allow unscoped root fallback for unauthenticated guest sessions so a
    // newly created/logged-in account never inherits another user's root data.
    if (uid === 'zenox_guest' && !GLOBAL_BROWSER_KEYS.has(key)) {
      const rootVal = localStorage.getItem(key);
      if (rootVal !== null) {
        return rootVal;
      }
    }
    return null;
  },
  setItem(key: string, value: string, explicitUid?: string): void {
    if (typeof localStorage === 'undefined') return;
    const scopedKey = getAccountStorageKey(key, explicitUid);
    try {
      localStorage.setItem(scopedKey, value);
    } catch (e) {
      console.warn('accountStorage.setItem failed (quota/privacy):', e);
    }
  },
  removeItem(key: string, explicitUid?: string): void {
    if (typeof localStorage === 'undefined') return;
    const scopedKey = getAccountStorageKey(key, explicitUid);
    localStorage.removeItem(scopedKey);
  },
  getScopedKey(key: string, explicitUid?: string): string {
    return getAccountStorageKey(key, explicitUid);
  },
};
