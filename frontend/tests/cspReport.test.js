import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCspReports } from '../api/csp-report.js';

test('summarizeCspReports : format report-uri ({"csp-report": ...})', () => {
  const reports = summarizeCspReports({
    'csp-report': {
      'document-uri': 'https://ris.hologramconseils.com/bilan?file=https%3A%2F%2Fblob%2Fsecret.pdf',
      'effective-directive': 'script-src-elem',
      'blocked-uri': 'https://clerk.example.com/npm/@clerk/clerk-js@5/dist/clerk.browser.js',
    },
  });
  assert.deepEqual(reports, [{ directive: 'script-src-elem', blocked: 'https://clerk.example.com', page: '/bilan' }]);
});

test('summarizeCspReports : format report-to (Reporting API)', () => {
  const reports = summarizeCspReports([
    { type: 'csp-violation', body: { effectiveDirective: 'connect-src', blockedURL: 'https://api.tiers.com/x?token=abc', documentURL: 'https://ris.hologramconseils.com/' } },
    { type: 'deprecation', body: {} },
  ]);
  assert.deepEqual(reports, [{ directive: 'connect-src', blocked: 'https://api.tiers.com', page: '/' }]);
});

test('summarizeCspReports : ne journalise jamais le chemin ni les paramètres de la ressource bloquée', () => {
  const [r] = summarizeCspReports({ 'csp-report': { 'blocked-uri': 'https://x.com/chemin?jeton=secret', 'document-uri': 'https://ris.hologramconseils.com/a?b=c' } });
  assert.ok(!r.blocked.includes('jeton') && !r.page.includes('b=c'));
});

test('summarizeCspReports : valeurs non-URL (inline, eval) conservées, contenu inconnu ignoré', () => {
  assert.equal(summarizeCspReports({ 'csp-report': { 'blocked-uri': 'inline', 'violated-directive': 'script-src' } })[0].blocked, 'inline');
  assert.deepEqual(summarizeCspReports({ autre: 1 }), []);
  assert.deepEqual(summarizeCspReports(null), []);
});

test('summarizeCspReports : nombre de rapports journalisés plafonné', () => {
  const many = Array.from({ length: 100 }, () => ({ type: 'csp-violation', body: { effectiveDirective: 'img-src', blockedURL: 'https://a.com/x', documentURL: 'https://ris.hologramconseils.com/' } }));
  assert.equal(summarizeCspReports(many).length, 20);
});
