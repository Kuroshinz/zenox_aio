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
});
