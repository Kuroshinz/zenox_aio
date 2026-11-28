/**
 * ZENOX Secure Authentication & Account Vault
 * Dev By Zenox Development
 * Cryptographic SHA-256 Salted Password Verification & Anti-Bypass Session Management
 */

import { accountStorage } from './accountStorage';
import { mergeSyncedGoogleEvents } from '../utils/calendarUtils';
import { fetchGoogleCalendarEvents } from './googleCalendarSync';

export interface ZenoxAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  lastLoginAt: string;
  syncConsent?: 'agreed' | 'declined';
}

export interface ZenoxUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  authMethod: 'zenox_vault' | 'google';
  /** Raw Firebase Auth UID when signed in via Firebase, used for Firestore security rules. */
  firebaseUid?: string;
}

export interface ZenoxSession {
  token: string;
  uid: string;
  email: string;
  displayName: string;
  authTime: number;
  expiresAt: number;
}

const VAULT_ACCOUNTS_KEY = 'zenox_vault_accounts';
const ACTIVE_SESSION_KEY = 'zenox_auth_session';
const ACTIVE_USER_KEY = 'gcal_active_user';
const WORKSPACE_ENTERED_KEY = 'zenox_workspace_entered';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Pure-JS RFC 6234 SHA-256 fallback for HTTP LAN origins on iPhone Safari where crypto.subtle is undefined. */
export function sha256HexFallback(bytes: Uint8Array): string {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  for (let i = 0; i < paddedLen; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 = ((w[t - 15] >>> 7) | (w[t - 15] << 25)) ^ ((w[t - 15] >>> 18) | (w[t - 15] << 14)) ^ (w[t - 15] >>> 3);
      const s1 = ((w[t - 2] >>> 17) | (w[t - 2] << 15)) ^ ((w[t - 2] >>> 19) | (w[t - 2] << 13)) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + SHA256_K[t] + w[t]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return Array.from(h)
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('');
}

function getRandomHex(byteLength: number): string {
  const arr = new Uint8Array(byteLength);
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c?.getRandomValues) {
    c.getRandomValues(arr);
  } else {
    for (let i = 0; i < byteLength; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** SHA-256 Cryptographic Hash Helper (uses WebCrypto when available, pure-JS fallback on HTTP LAN) */
async function hashWithSalt(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder().encode(`${salt}:#zenox_secure:${password}`);
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c?.subtle) {
    const hashBuf = await c.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return sha256HexFallback(enc);
}

function generateRandomSalt(): string {
  return getRandomHex(16);
}

function generateSessionToken(): string {
  return 'zenox_st_' + getRandomHex(32);
}

/** Persist a verified ZENOX session + active user consistently across all auth entry points. */
export function establishZenoxSession(
  userInput: {
    uid: string;
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
    firebaseUid?: string;
  },
  authMethod: 'zenox_vault' | 'google' = 'google',
  rememberMe: boolean = true
): ZenoxUser {
  const cleanEmail = (userInput.email || '').trim().toLowerCase();
  const cleanName = userInput.displayName?.trim() || (cleanEmail ? cleanEmail.split('@')[0] : 'Thành viên ZENOX');
  const user: ZenoxUser = {
    uid: String(userInput.uid),
    displayName: cleanName,
    email: cleanEmail,
    photoURL: userInput.photoURL ?? null,
    authMethod,
    ...(userInput.firebaseUid ? { firebaseUid: userInput.firebaseUid } : {}),
  };

  const session: ZenoxSession = {
    token: generateSessionToken(),
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    authTime: Date.now(),
    expiresAt: Date.now() + (rememberMe ? THIRTY_DAYS_MS : ONE_DAY_MS),
  };

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(user));
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(WORKSPACE_ENTERED_KEY, 'true');
  }

  return user;
}

/** Get all registered accounts from local vault */
export function getVaultAccounts(): ZenoxAccount[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(VAULT_ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse vault accounts:', e);
  }
  return [];
}

function saveVaultAccounts(accounts: ZenoxAccount[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(VAULT_ACCOUNTS_KEY, JSON.stringify(accounts));
}

// Clean up any legacy test accounts if present from early development
if (typeof localStorage !== 'undefined') {
  try {
    const accounts = getVaultAccounts();
    const cleaned = accounts.filter(
      (a) => a.id !== 'zenox-usr-admin' && a.email.toLowerCase() !== 'admin@zenox.io'
    );
    if (cleaned.length !== accounts.length) {
      saveVaultAccounts(cleaned);
    }
  } catch {}
}

/** Register a brand new ZENOX personal account */
export async function registerZenoxAccount(
  name: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: ZenoxUser }> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'Họ và tên phải có ít nhất 2 ký tự.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { success: false, error: 'Địa chỉ Email không hợp lệ.' };
  }

  if (!password || password.length < 6) {
    return { success: false, error: 'Mật khẩu bảo mật phải có tối thiểu 6 ký tự.' };
  }

  const accounts = getVaultAccounts();
  const existing = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
  if (existing) {
    return {
      success: false,
      error: 'Email này đã tồn tại trên hệ thống. Vui lòng chuyển sang Đăng Nhập.',
    };
  }

  let firebaseUid: string | undefined;
  if (typeof window !== 'undefined') {
    try {
      const { registerWithFirebaseEmail } = await import('./auth');
      const fbUser = await registerWithFirebaseEmail(cleanName, cleanEmail, password);
      firebaseUid = fbUser.uid;
    } catch (fbErr: any) {
      const code = fbErr?.code || '';
      if (code === 'auth/email-already-in-use') {
        return {
          success: false,
          error: 'Email này đã tồn tại trên hệ thống đám mây. Vui lòng chuyển sang Đăng Nhập.',
        };
      }
      if (code === 'auth/weak-password') {
        return {
          success: false,
          error: 'Mật khẩu bảo mật phải có tối thiểu 6 ký tự.',
        };
      }
      if (code === 'auth/invalid-email') {
        return { success: false, error: 'Địa chỉ Email không hợp lệ.' };
      }
      // Graceful offline / disabled-provider fallback to local vault
    }
  }

  const salt = generateRandomSalt();
  const passwordHash = await hashWithSalt(password, salt);
  const newAccount: ZenoxAccount = {
    id: firebaseUid || 'zenox-usr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    name: cleanName,
    email: cleanEmail,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  accounts.push(newAccount);
  saveVaultAccounts(accounts);

  const user = establishZenoxSession(
    {
      uid: newAccount.id,
      displayName: cleanName,
      email: cleanEmail,
      photoURL: null,
      firebaseUid,
    },
    'zenox_vault',
    true
  );

  return { success: true, user };
}

/** Authenticate existing user with email and password */
export async function loginZenoxAccount(
  email: string,
  password: string,
  rememberMe: boolean = true
): Promise<{ success: boolean; error?: string; user?: ZenoxUser }> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    return { success: false, error: 'Vui lòng nhập Email tài khoản.' };
  }
  if (!password) {
    return { success: false, error: 'Vui lòng nhập Mật khẩu bảo mật.' };
  }

  const accounts = getVaultAccounts();
  let account = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
  let firebaseUid: string | undefined;

  if (typeof window !== 'undefined') {
    try {
      const { loginWithFirebaseEmail } = await import('./auth');
      const fbUser = await loginWithFirebaseEmail(cleanEmail, password);
      firebaseUid = fbUser.uid;
      // Sync cloud account into local vault if this device hasn't seen it yet
      if (!account) {
        const salt = generateRandomSalt();
        const passwordHash = await hashWithSalt(password, salt);
        account = {
          id: fbUser.uid,
          name: fbUser.displayName || cleanEmail.split('@')[0],
          email: cleanEmail,
          passwordHash,
          salt,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
        accounts.push(account);
        saveVaultAccounts(accounts);
      }
    } catch (fbErr: any) {
      const code = fbErr?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        if (!account) {
          return {
            success: false,
            error: 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.',
          };
        }
      }
      // Fall back cleanly to local vault verification when offline or local-only account
    }
  }

  if (!account) {
    return {
      success: false,
      error: 'Tài khoản không tồn tại trên hệ thống ZENOX. Vui lòng Đăng Ký.',
    };
  }

  if (account.passwordHash === 'google_oauth_managed') {
    return {
      success: false,
      error: 'Email này được liên kết với đăng nhập Google. Vui lòng chọn "Đăng nhập bằng tài khoản Google" ở phía trên.',
    };
  }

  if (!firebaseUid) {
    const inputHash = await hashWithSalt(password, account.salt);
    if (inputHash !== account.passwordHash) {
      return {
        success: false,
        error: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại.',
      };
    }
  }

  // Update last login
  account.lastLoginAt = new Date().toISOString();
  saveVaultAccounts(accounts);

  const user = establishZenoxSession(
    {
      uid: account.id,
      displayName: account.name,
      email: account.email,
      photoURL: null,
      firebaseUid,
    },
    'zenox_vault',
    rememberMe
  );

  return { success: true, user };
}

/**
 * Ensure a local test/clone account exists in the vault with salted SHA-256 credentials
 * so users can sign in either via email/password or 1-click demo login.
 */
export async function ensureSeededVaultAccount(input: {
  id: string;
  name: string;
  email: string;
  password: string;
}): Promise<ZenoxAccount> {
  const cleanEmail = input.email.trim().toLowerCase();
  const accounts = getVaultAccounts();
  const existing = accounts.find(
    (a) => a.id === input.id || a.email.toLowerCase() === cleanEmail
  );
  if (existing) {
    return existing;
  }

  const salt = generateRandomSalt();
  const passwordHash = await hashWithSalt(input.password, salt);
  const acc: ZenoxAccount = {
    id: input.id,
    name: input.name,
    email: cleanEmail,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    syncConsent: 'declined',
  };
  accounts.push(acc);
  saveVaultAccounts(accounts);
  return acc;
}

/** Terminate current session */
export function logoutZenoxSession() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    localStorage.removeItem(ACTIVE_USER_KEY);
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(WORKSPACE_ENTERED_KEY);
  }
}

/** Verify if there is an active, valid session (anti-bypass verification) */
export function verifyZenoxSession(): ZenoxUser | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const rawSession = localStorage.getItem(ACTIVE_SESSION_KEY);
    const rawUser = localStorage.getItem(ACTIVE_USER_KEY);

    if (!rawSession || !rawUser) return null;

    const session: ZenoxSession = JSON.parse(rawSession);
    const user: ZenoxUser = JSON.parse(rawUser);

    if (!session.token || !session.expiresAt || !user.uid) {
      logoutZenoxSession();
      return null;
    }

    if (Date.now() > session.expiresAt) {
      logoutZenoxSession();
      return null;
    }

    if (session.uid !== user.uid) {
      logoutZenoxSession();
      return null;
    }

    return user;
  } catch {
    logoutZenoxSession();
    return null;
  }
}

export async function completeGoogleRedirectLogin(): Promise<{
  success: boolean;
  user?: ZenoxUser;
  error?: string;
}> {
  try {
    const { resolveGoogleRedirectResult } = await import('./auth');
    const res = await resolveGoogleRedirectResult();
    if (!res?.user?.email) return { success: false };
    return finalizeGoogleVaultUser(res.user, res.accessToken, res.user.uid);
  } catch (err: any) {
    return { success: false, error: err?.message || 'Không thể hoàn tất đăng nhập Google.' };
  }
}

function finalizeGoogleVaultUser(
  appUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null },
  accessToken: string | null,
  firebaseUid?: string
): { success: boolean; user?: ZenoxUser; error?: string } {
  if (!appUser?.email) {
    return { success: false, error: 'Không nhận được thông tin tài khoản từ Google.' };
  }
  const cleanEmail = appUser.email.trim().toLowerCase();
  const cleanName = appUser.displayName?.trim() || cleanEmail.split('@')[0];
  const safeSub = appUser.uid || 'g_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
  const googleUid = 'google-' + safeSub;

  const accounts = getVaultAccounts();
  let existing = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
  if (!existing) {
    existing = {
      id: googleUid,
      name: cleanName,
      email: cleanEmail,
      passwordHash: 'google_oauth_managed',
      salt: 'google_salt',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    accounts.push(existing);
    saveVaultAccounts(accounts);
  } else {
    existing.lastLoginAt = new Date().toISOString();
    saveVaultAccounts(accounts);
  }

  const user = establishZenoxSession(
    {
      uid: existing.id || googleUid,
      displayName: cleanName,
      email: cleanEmail,
      photoURL:
        appUser.photoURL ||
        'https://ui-avatars.com/api/?name=' + encodeURIComponent(cleanName) + '&background=27272a&color=fff',
      firebaseUid,
    },
    'google',
    true
  );

  if (accessToken && typeof localStorage !== 'undefined') {
    localStorage.setItem('gcal_real_access_token', accessToken);
    localStorage.setItem('gcal_real_token_expires_at', String(Date.now() + 3500 * 1000));
  }

  return { success: true, user };
}

/**
 * Sign in or authenticate with a Google Account
 * Dev By Zenox Development
 */
export async function loginWithGoogleAccount(customClientId?: string): Promise<{
  success: boolean;
  redirecting?: boolean;
  error?: string;
  user?: ZenoxUser;
}> {
  try {
    if (typeof window !== 'undefined') {
      const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
      const isNative = Boolean(cap?.isNativePlatform?.() || window.location.protocol === 'capacitor:');
      const host = window.location.hostname || '';
      const isPrivateLanIp =
        /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);

      if (isNative) {
        return {
          success: false,
          error:
            'Trong bản app iOS cài qua file .ipa, Google Web OAuth bị giới hạn trên WebView cục bộ. Vui lòng đăng ký / đăng nhập bằng Email & Mật khẩu bên dưới (hoạt động đầy đủ offline & đồng bộ Cloud với bản Web).',
        };
      }

      if (isPrivateLanIp) {
        return {
          success: false,
          error: `Google OAuth không hỗ trợ địa chỉ IP mạng LAN (${host}). Hãy đăng nhập/đăng ký bằng Email bên dưới hoặc truy cập qua HTTPS.`,
        };
      }
    }

    let appUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null } | null = null;
    let accessToken: string | null = null;
    let firebaseUid: string | undefined;

    const trimmedCustomId = customClientId?.trim() || (typeof localStorage !== 'undefined' ? localStorage.getItem('gcal_custom_client_id')?.trim() : '') || '';
    if (trimmedCustomId && typeof localStorage !== 'undefined') {
      localStorage.setItem('gcal_custom_client_id', trimmedCustomId);
    }

    // If caller explicitly supplied their own OAuth Web Client ID, use clean GIS identity login directly
    if (trimmedCustomId) {
      const { authenticateRealGoogleUser } = await import('./realGoogleAuth');
      const gisRes = await authenticateRealGoogleUser(trimmedCustomId, undefined, false);
      if (gisRes?.user?.email) {
        return finalizeGoogleVaultUser(gisRes.user, null);
      }
    }

    // 1. Launch real official Google OAuth popup via Firebase Auth
    try {
      const { googleSignIn } = await import('./auth');
      const res = await googleSignIn();
      if (res?.user?.email) {
        appUser = res.user;
        accessToken = res.accessToken;
        firebaseUid = res.user.uid;
      }
    } catch (fbErr: any) {
      console.warn('Firebase popup encounter:', fbErr?.code || fbErr?.message);
      if (fbErr?.code === 'auth/popup-closed-by-user' || fbErr?.message?.includes('closed-by-user')) {
        return {
          success: false,
          error: 'Cửa sổ đăng nhập Google đã bị đóng. Vui lòng bấm đăng nhập lại để tiếp tục.',
        };
      }

      if (fbErr?.code === 'auth/unauthorized-domain' || fbErr?.message?.includes('unauthorized-domain')) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'domain';
        return {
          success: false,
          error: `Domain web (${domain}) chưa được cấp phép trong Firebase Console (Authorized Domains). Hãy dùng Email/Mật khẩu bên dưới hoặc nhập Google Client ID riêng để đăng nhập.`,
        };
      }

      if (
        fbErr?.code === 'auth/popup-blocked' ||
        fbErr?.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          const { googleSignInRedirect } = await import('./auth');
          await googleSignInRedirect();
          return { success: false, redirecting: true };
        } catch (redirErr: any) {
          return {
            success: false,
            error: redirErr?.message || 'Trình duyệt đang chặn pop-up Google. Vui lòng thử lại hoặc dùng Email.',
          };
        }
      }

      // 2. Secondary fallback via Google Identity Services (identity only)
      try {
        const { authenticateRealGoogleUser } = await import('./realGoogleAuth');
        const gisRes = await authenticateRealGoogleUser(undefined, undefined, false);
        if (gisRes?.user?.email) {
          appUser = gisRes.user;
          accessToken = gisRes.accessToken;
        }
      } catch (gisErr: any) {
        console.warn('GIS fallback encounter:', gisErr?.message);
        throw new Error(
          gisErr?.message || fbErr?.message || 'Không thể mở cửa sổ đăng nhập Google.'
        );
      }
    }

    if (!appUser || !appUser.email) {
      return { success: false, error: 'Không nhận được thông tin tài khoản từ Google.' };
    }

    return finalizeGoogleVaultUser(appUser, accessToken, firebaseUid);
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Lỗi xác thực máy chủ Google.',
    };
  }
}

/**
 * Accurately fetch and synchronize Google Calendar events into user workspace
 */
export async function syncGoogleCalendarData(
  accessToken: string,
  uid: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const googleEvents = await fetchGoogleCalendarEvents(accessToken);
    if (googleEvents && googleEvents.length > 0) {
      const rawExisting = accountStorage.getItem('gcal_events', uid);
      const existingEvents: any[] = rawExisting ? JSON.parse(rawExisting) : [];
      const merged = mergeSyncedGoogleEvents(googleEvents, existingEvents);
      accountStorage.setItem('gcal_events', JSON.stringify(merged), uid);
      return { success: true, count: googleEvents.length };
    }
    return { success: true, count: 0 };
  } catch (err: any) {
    console.warn('syncGoogleCalendarData error:', err);
    return { success: false, count: 0, error: err?.message || 'Lỗi đồng bộ Google Calendar' };
  }
}

export type SyncConsentStatus = 'agreed' | 'declined';

/**
 * Checks if the account has already made a decision regarding calendar synchronization.
 * Includes detection for accounts that already have scoped calendar events.
 */
export function getAccountSyncConsent(uid: string, email?: string | null): SyncConsentStatus | null {
  if (typeof localStorage === 'undefined') return null;

  // 1. Direct explicit consent key by uid
  const uidConsent = localStorage.getItem(`zenox_sync_consent_${uid}`);
  if (uidConsent === 'agreed' || uidConsent === 'declined' || uidConsent === 'synced') {
    return uidConsent === 'declined' ? 'declined' : 'agreed';
  }

  // 2. Direct explicit consent key by email
  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    const emailConsent = localStorage.getItem(`zenox_sync_consent_${cleanEmail}`);
    if (emailConsent === 'agreed' || emailConsent === 'declined' || emailConsent === 'synced') {
      return emailConsent === 'declined' ? 'declined' : 'agreed';
    }
  }

  // 3. Check account record in local vault
  const accounts = getVaultAccounts();
  const acc = accounts.find(
    (a) => a.id === uid || (email && a.email.toLowerCase() === email.trim().toLowerCase())
  );
  if (acc && acc.syncConsent) {
    return acc.syncConsent === 'declined' ? 'declined' : 'agreed';
  }

  // 4. Detection for existing returning users who already have account-scoped events
  try {
    const safeUid = String(uid).replace(/[^a-zA-Z0-9_-]/g, '_');
    const rawEvents = localStorage.getItem(`zenox_acc_${safeUid}__gcal_events`);
    if (rawEvents) {
      const parsed = JSON.parse(rawEvents);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setAccountSyncConsent(uid, email, 'agreed');
        return 'agreed';
      }
    }
  } catch {}

  return null;
}

/**
 * Persists the user's synchronization consent choice so they are NEVER prompted again upon returning to the web.
 */
export function setAccountSyncConsent(
  uid: string,
  email: string | null | undefined,
  consent: SyncConsentStatus
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`zenox_sync_consent_${uid}`, consent);
    if (email) {
      localStorage.setItem(`zenox_sync_consent_${email.trim().toLowerCase()}`, consent);
    }
    const accounts = getVaultAccounts();
    const acc = accounts.find(
      (a) => a.id === uid || (email && a.email.toLowerCase() === email.trim().toLowerCase())
    );
    if (acc) {
      acc.syncConsent = consent;
      saveVaultAccounts(accounts);
    }
  } catch (e) {
    console.warn('Could not persist sync consent:', e);
  }
}
