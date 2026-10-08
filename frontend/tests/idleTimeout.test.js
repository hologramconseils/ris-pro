import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDLE_LIMIT_MS, WARNING_MS, remainingMs, readLastActivity, writeLastActivity, clearLocalTraces, activityKey } from '../src/idleTimeout.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return new Proxy(data, {
    get(target, prop) {
      if (prop === 'getItem') return (k) => (k in target ? target[k] : null);
      if (prop === 'setItem') return (k, v) => { target[k] = String(v); };
      if (prop === 'removeItem') return (k) => { delete target[k]; };
      return target[prop];
    },
  });
}

test('déconnexion après 10 minutes, avertissement 1 minute avant', () => {
  assert.equal(IDLE_LIMIT_MS, 10 * 60 * 1000);
  assert.equal(WARNING_MS, 60 * 1000);
  const t0 = 1_000_000;
  assert.equal(remainingMs(t0, t0 + 5 * 60 * 1000), 5 * 60 * 1000);
  assert.ok(remainingMs(t0, t0 + 9.5 * 60 * 1000) <= WARNING_MS);
  assert.ok(remainingMs(t0, t0 + 10 * 60 * 1000) <= 0);
});

test('session qui vient de s\'ouvrir : délai complet', () => {
  assert.equal(remainingMs(null, Date.now()), IDLE_LIMIT_MS);
});

test('activité enregistrée par session : une nouvelle connexion n\'hérite pas d\'une ancienne inactivité', () => {
  const storage = fakeStorage();
  writeLastActivity(storage, 'sess_ancienne', 1000);
  assert.equal(readLastActivity(storage, 'sess_ancienne'), 1000);
  assert.equal(readLastActivity(storage, 'sess_nouvelle'), null);
});

test('déconnexion : analyses en cache et minuteries effacées, thème conservé', () => {
  const local = fakeStorage({ [activityKey('s1')]: '1', theme: 'dark' });
  const session = fakeStorage({ ris_pro_analysis_x: '{}', autre: 'garde' });
  clearLocalTraces(local, session);
  assert.deepEqual(Object.keys(local), ['theme']);
  assert.deepEqual(Object.keys(session), ['autre']);
});
