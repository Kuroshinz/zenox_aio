import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
// Calendar & Profile scopes only

const REAL_TOKEN_KEY = 'gcal_real_access_token';
const TOKEN_EXPIRY_KEY = 'gcal_real_token_expires_at';

let cachedAccessToken: string | null = null;

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/** Check if the stored Google access token has passed its expiration time */
export const isTokenExpired = (): boolean => {
  if (typeof window === 'undefined') return false;
  const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiryStr) return false;
  const expiresAt = parseInt(expiryStr, 10);
  if (Number.isNaN(expiresAt)) return false;
  return Date.now() >= expiresAt;
};

/** Store a token obtained through Google Identity Services / OAuth with 2-minute safety buffer */
export const setAccessToken = (token: string, expiresInSeconds: number = 3600) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem(REAL_TOKEN_KEY, token);
    const expiresAt = Date.now() + Math.max(60, expiresInSeconds - 120) * 1000;
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt));
  }
};

/** Clear cached token both from memory and localStorage without logging out user profile */
export const clearAccessToken = () => {
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(REAL_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }
};

/** Synchronously check for stored token, auto-clearing stale tokens */
export const getStoredAccessTokenSync = (): string | null => {
  if (typeof window === 'undefined') return null;
  if (isTokenExpired()) {
    clearAccessToken();
    return null;
  }
  if (cachedAccessToken) return cachedAccessToken;
  const stored = localStorage.getItem(REAL_TOKEN_KEY);
  cachedAccessToken = stored || null;
  return cachedAccessToken;
};

/** Returns a real access token or null. Never returns an expired sentinel. */
export const getAccessToken = async (): Promise<string | null> => {
  return getStoredAccessTokenSync();
};

/** Check if there is currently an active, unexpired Google access token */
export const hasValidGoogleToken = (): boolean => {
  return Boolean(getStoredAccessTokenSync());
};

/**
 * Restore a previously authorized session. Preserves user profile locally even if
 * the Google Calendar token has expired, avoiding jarring cold-start 401 errors.
 */
export const initAuth = (
  onAuthSuccess?: (user: AppUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  const savedUser = localStorage.getItem('gcal_active_user');
  const savedToken = getStoredAccessTokenSync();

  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser) as AppUser;
      if (parsed?.email) {
        if (savedToken) {
          cachedAccessToken = savedToken;
          if (onAuthSuccess) onAuthSuccess(parsed, savedToken);
        } else {
          // Token expired or not present, but user profile is safely remembered locally
          if (onAuthSuccess) onAuthSuccess(parsed, '');
        }
      } else {
        if (onAuthFailure) onAuthFailure();
      }
    } catch {
      localStorage.removeItem('gcal_active_user');
      clearAccessToken();
      if (onAuthFailure) onAuthFailure();
    }
  } else if (onAuthFailure) {
    onAuthFailure();
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (!user) return;
    const token = cachedAccessToken || getStoredAccessTokenSync();

    const appUser: AppUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    };
    if (onAuthSuccess) onAuthSuccess(appUser, token || '');
  });
};

/**
 * Firebase Google popup sign-in.
 */
export const googleSignIn = async (): Promise<{ user: AppUser; accessToken: string }> => {
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken || '';

  if (accessToken) {
    setAccessToken(accessToken, 3600);
  }
  const appUser: AppUser = {
    uid: result.user.uid,
    email: result.user.email,
    displayName: result.user.displayName,
    photoURL: result.user.photoURL,
  };

  return { user: appUser, accessToken };
};

export const googleSignInRedirect = async (): Promise<void> => {
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  await signInWithRedirect(auth, provider);
};

export const resolveGoogleRedirectResult = async (): Promise<{ user: AppUser; accessToken: string } | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';
    if (accessToken) {
      setAccessToken(accessToken, 3600);
    }
    return {
      user: {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      },
      accessToken,
    };
  } catch {
    return null;
  }
};

export const registerWithFirebaseEmail = async (
  name: string,
  email: string,
  password: string
): Promise<AppUser> => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name.trim()) {
    await updateProfile(cred.user, { displayName: name.trim() }).catch(() => undefined);
  }
  return {
    uid: cred.user.uid,
    email: cred.user.email,
    displayName: name.trim() || cred.user.displayName,
    photoURL: cred.user.photoURL,
  };
};

export const loginWithFirebaseEmail = async (
  email: string,
  password: string
): Promise<AppUser> => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return {
    uid: cred.user.uid,
    email: cred.user.email,
    displayName: cred.user.displayName,
    photoURL: cred.user.photoURL,
  };
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch {}
  clearAccessToken();
  localStorage.removeItem('gcal_active_user');
};
