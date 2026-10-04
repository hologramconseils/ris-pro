import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { STRIPE_API_VERSION } from '../lib/stripeConfig.js';

const API_DIR = new URL('../api/', import.meta.url);

test('la version d\'API Stripe reste figée sur la famille « acacia »', () => {
  assert.match(STRIPE_API_VERSION, /^\d{4}-\d{2}-\d{2}\.acacia$/);
});

test('checkout.js et webhook.js utilisent la version d\'API figée', () => {
  for (const file of ['checkout.js', 'webhook.js']) {
    const source = readFileSync(new URL(file, API_DIR), 'utf8');
    assert.match(source, /apiVersion: STRIPE_API_VERSION/, `${file} n'utilise pas STRIPE_API_VERSION`);
  }
});

// Chaque fichier .js de api/ est déployé comme une fonction Vercel, limitées à 12 sur le plan
// Hobby : les modules partagés vont dans lib/, pas dans api/.
test('api/ ne contient que des points d\'API, dans la limite de 12 fonctions', () => {
  const files = readdirSync(API_DIR).filter((f) => f.endsWith('.js'));
  assert.ok(files.length <= 12, `${files.length} fichiers dans api/ : la limite du plan Hobby est de 12 fonctions`);
  for (const file of files) {
    const source = readFileSync(new URL(file, API_DIR), 'utf8');
    assert.match(source, /export default/, `${file} n'est pas un point d'API : le déplacer dans lib/`);
  }
});
