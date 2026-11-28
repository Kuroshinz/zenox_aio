import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

const memLocal = createMemoryStorage();
const memSession = createMemoryStorage();
(globalThis as any).localStorage = memLocal;
(globalThis as any).sessionStorage = memSession;

import {
  registerZenoxAccount,
  loginZenoxAccount,
  verifyZenoxSession,
  logoutZenoxSession,
  establishZenoxSession,
  getVaultAccounts,
  getAccountSyncConsent,
  setAccountSyncConsent,
  sha256HexFallback,
} from './zenoxAuth';
import { accountStorage } from './accountStorage';

beforeEach(() => {
  memLocal.clear();
  memSession.clear();
});

test('registerZenoxAccount validates inputs and creates salted SHA-256 account + session', async () => {
  const shortName = await registerZenoxAccount('A', 'a@example.com', '123456');
  assert.equal(shortName.success, false);

  const badEmail = await registerZenoxAccount('An Nguyen', 'not-an-email', '123456');
  assert.equal(badEmail.success, false);

  const shortPass = await registerZenoxAccount('An Nguyen', 'an@example.com', '123');
  assert.equal(shortPass.success, false);

  const ok = await registerZenoxAccount('An Nguyen', 'An@Example.com', 'Secret123!');
  assert.equal(ok.success, true);
  assert.ok(ok.user);
  assert.equal(ok.user.email, 'an@example.com');
  assert.equal(ok.user.authMethod, 'zenox_vault');

  const dup = await registerZenoxAccount('Another', 'an@example.com', 'Secret123!');
  assert.equal(dup.success, false);

  const accounts = getVaultAccounts();
  assert.equal(accounts.length, 1);
  assert.notEqual(accounts[0].passwordHash, 'Secret123!');
  assert.equal(accounts[0].salt.length, 32);

  const verified = verifyZenoxSession();
  assert.ok(verified);
  assert.equal(verified.uid, ok.user.uid);
});

test('loginZenoxAccount verifies password, rejects wrong password, and flags google-only accounts', async () => {
  await registerZenoxAccount('Minh Tran', 'minh@example.com', 'StrongPass9');
  logoutZenoxSession();

  assert.equal(verifyZenoxSession(), null);

  const missing = await loginZenoxAccount('ghost@example.com', 'StrongPass9');
  assert.equal(missing.success, false);

  const wrong = await loginZenoxAccount('minh@example.com', 'WrongPass');
  assert.equal(wrong.success, false);

  const ok = await loginZenoxAccount('minh@example.com', 'StrongPass9', false);
  assert.equal(ok.success, true);
  assert.ok(verifyZenoxSession());

  // Session duration respects rememberMe = false (<= 24h)
  const rawSession = JSON.parse(memLocal.getItem('zenox_auth_session')!);
  assert.ok(rawSession.expiresAt - rawSession.authTime <= 24 * 60 * 60 * 1000 + 1000);

  // Google-managed vault record gives specific guidance on Web login
  const accounts = getVaultAccounts();
  accounts.push({
    id: 'google-123',
    name: 'Google User',
    email: 'guser@gmail.com',
    passwordHash: 'google_oauth_managed',
    salt: 'google_salt',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  });
  memLocal.setItem('zenox_vault_accounts', JSON.stringify(accounts));

  const googleAttempt = await loginZenoxAccount('guser@gmail.com', 'anything');
  assert.equal(googleAttempt.success, false);
  assert.match(googleAttempt.error || '', /Google/i);
});

test('verifyZenoxSession rejects expired, mismatched, or malformed sessions and clears state', async () => {
  const reg = await registerZenoxAccount('Linh Le', 'linh@example.com', 'Pass1234');
  assert.ok(reg.user);

  // Expired session
  const session = JSON.parse(memLocal.getItem('zenox_auth_session')!);
  session.expiresAt = Date.now() - 1000;
  memLocal.setItem('zenox_auth_session', JSON.stringify(session));
  assert.equal(verifyZenoxSession(), null);
  assert.equal(memLocal.getItem('gcal_active_user'), null);

  // UID mismatch tampering
  establishZenoxSession(reg.user, 'zenox_vault');
  const validSession = JSON.parse(memLocal.getItem('zenox_auth_session')!);
  validSession.uid = 'tampered-uid';
  memLocal.setItem('zenox_auth_session', JSON.stringify(validSession));
  assert.equal(verifyZenoxSession(), null);

  // Malformed JSON
  memLocal.setItem('zenox_auth_session', '{broken-json');
  memLocal.setItem('gcal_active_user', '{}');
  assert.equal(verifyZenoxSession(), null);
});

test('establishZenoxSession keeps external Google logins valid across reloads', () => {
  const user = establishZenoxSession(
    {
      uid: 'google-abc',
      displayName: 'Google Demo',
      email: 'Demo@Gmail.com',
      firebaseUid: 'abc',
    },
    'google'
  );
  assert.equal(user.email, 'demo@gmail.com');
  assert.equal(user.firebaseUid, 'abc');

  const verified = verifyZenoxSession();
  assert.ok(verified);
  assert.equal(verified.uid, 'google-abc');
  assert.equal(verified.firebaseUid, 'abc');
});

test('accountStorage and syncConsent stay strictly isolated from unscoped root gcal_events', async () => {
  // Simulate legacy/previous user root gcal_events sitting in localStorage
  memLocal.setItem('gcal_events', JSON.stringify([{ id: 'leaked-ev', title: 'Private event' }]));

  const reg = await registerZenoxAccount('New User', 'new@example.com', 'Pass1234');
  assert.ok(reg.user);

  // New user must NOT inherit unscoped root gcal_events
  assert.equal(accountStorage.getItem('gcal_events', reg.user.uid), null);

  // Root gcal_events must NOT trick sync consent into 'agreed'
  assert.equal(getAccountSyncConsent(reg.user.uid, reg.user.email), null);

  // Declining consent stores blank events strictly under user's scoped key
  setAccountSyncConsent(reg.user.uid, reg.user.email, 'declined');
  accountStorage.setItem('gcal_events', JSON.stringify([]), reg.user.uid);
  assert.equal(getAccountSyncConsent(reg.user.uid, reg.user.email), 'declined');
  assert.equal(accountStorage.getItem('gcal_events', reg.user.uid), '[]');

  // Focus timer & weekly goals stay isolated per account UID
  accountStorage.setItem('gcal_focus_timer', JSON.stringify({ linkedTaskId: 'task-999' }), reg.user.uid);
  accountStorage.setItem('gcal_weekly_goals', JSON.stringify([{ id: 'g1', category: 'work', targetHours: 12 }]), reg.user.uid);
  assert.equal(accountStorage.getItem('gcal_focus_timer', 'other-uid'), null);
  assert.equal(accountStorage.getItem('gcal_weekly_goals', 'other-uid'), null);
});

test('loginCloneDemoAccount seeds full Phase 1-4 test data and supports password login', async () => {
  const {
    loginCloneDemoAccount,
    CLONE_ACCOUNT_EMAIL,
    CLONE_ACCOUNT_PASSWORD,
    CLONE_ACCOUNT_UID,
  } = await import('./cloneAccountSeed');

  const cloneUser = await loginCloneDemoAccount(true);
  assert.equal(cloneUser.uid, CLONE_ACCOUNT_UID);
  assert.equal(cloneUser.email, CLONE_ACCOUNT_EMAIL);

  const photosRaw = accountStorage.getItem('gcal_prod_body_photos', CLONE_ACCOUNT_UID);
  const checkinsRaw = accountStorage.getItem('gcal_ctg_weekly_checkins', CLONE_ACCOUNT_UID);
  const mealsRaw = accountStorage.getItem('gcal_ctg_meals', CLONE_ACCOUNT_UID);
  const eventsRaw = accountStorage.getItem('gcal_events', CLONE_ACCOUNT_UID);
  assert.ok(photosRaw && JSON.parse(photosRaw).length >= 2, 'Clone account should have before/after photos');
  assert.ok(checkinsRaw && JSON.parse(checkinsRaw).length >= 2, 'Clone account should have weekly checkins');
  assert.ok(mealsRaw && JSON.parse(mealsRaw).length >= 15, 'Clone account should have multi-week meals');
  assert.ok(eventsRaw && JSON.parse(eventsRaw).length >= 4, 'Clone account should have calendar events');
  assert.equal(getAccountSyncConsent(CLONE_ACCOUNT_UID, CLONE_ACCOUNT_EMAIL), 'declined');

  // Also verify manual email/password sign-in works cleanly
  const pwLogin = await loginZenoxAccount(CLONE_ACCOUNT_EMAIL, CLONE_ACCOUNT_PASSWORD);
  assert.equal(pwLogin.success, true);
  assert.equal(pwLogin.user?.uid, CLONE_ACCOUNT_UID);
});

test('sha256HexFallback matches RFC 6234 vectors and auth works without crypto.subtle (HTTP LAN iPhone Safari)', async () => {
  // Known NIST / RFC 6234 SHA-256 test vectors
  const enc = new TextEncoder();
  assert.equal(
    sha256HexFallback(enc.encode('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
  assert.equal(
    sha256HexFallback(enc.encode('')),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );

  // Simulate non-secure HTTP LAN context where crypto.subtle is undefined
  const originalCryptoDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = (i * 37 + 13) & 0xff;
        return arr;
      },
      // subtle intentionally omitted (HTTP LAN / older WebView)
    },
  });

  try {
    const reg = await registerZenoxAccount('iPhone User', 'iphone@zenox.local', 'Pass1234!');
    assert.equal(reg.success, true);
    assert.ok(reg.user?.uid);

    logoutZenoxSession();
    assert.equal(verifyZenoxSession(), null);

    const login = await loginZenoxAccount('iphone@zenox.local', 'Pass1234!', true);
    assert.equal(login.success, true);
    assert.equal(login.user?.email, 'iphone@zenox.local');
    assert.equal(verifyZenoxSession()?.uid, reg.user?.uid);
  } finally {
    if (originalCryptoDesc) {
      Object.defineProperty(globalThis, 'crypto', originalCryptoDesc);
    }
  }
});
