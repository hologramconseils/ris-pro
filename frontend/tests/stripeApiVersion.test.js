import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const API_DIR = new URL('../api/', import.meta.url);

// La version d'API Stripe est écrite dans checkout.js et webhook.js (pas de fichier partagé :
// chaque fichier de api/ est une fonction Vercel, limitées à 12 sur le plan Hobby). Ce test
// garantit que le paiement et le webhook utilisent toujours la même version.
function pinnedVersion(file) {
  const source = readFileSync(new URL(file, API_DIR), 'utf8');
  return source.match(/const STRIPE_API_VERSION = '([^']+)'/)?.[1];
}

test('checkout.js et webhook.js figent la même version d\'API Stripe', () => {
  const checkout = pinnedVersion('checkout.js');
  assert.ok(checkout, 'version absente de checkout.js');
  assert.equal(pinnedVersion('webhook.js'), checkout);
});

test('le nombre de fonctions Vercel (fichiers .js de api/) reste dans la limite du plan Hobby', () => {
  const count = readdirSync(API_DIR).filter((f) => f.endsWith('.js')).length;
  assert.ok(count <= 12, `${count} fichiers dans api/ : la limite du plan Hobby est de 12 fonctions`);
});
