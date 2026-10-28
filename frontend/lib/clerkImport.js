// Reprise des comptes Clerk existants : on conserve leur identifiant (« user_… »), donc les profils, crédits et
// analyses déjà en base restent rattachés. Les comptes repris ont une adresse vérifiée (Clerk l'avait confirmée)
// et AUCUN mot de passe : leur titulaire en choisit un via « Mot de passe oublié ».
// Entrée : l'export CSV de Clerk (tableau de bord > Users > Export), qui contient au minimum les colonnes
// « id » et « primary_email_address ».

import { normalizeEmail } from './authStore.js';

// Lecture CSV minimale (guillemets, virgules et retours à la ligne dans les champs entre guillemets).
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = String(text).replace(/^﻿/, '');
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && source[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}

// Renvoie { users: [{ id, email }], skipped: [raison...] }.
export function parseClerkExport(text) {
  const [header = [], ...rows] = parseCsv(text);
  const idCol = header.indexOf('id');
  const emailCol = header.indexOf('primary_email_address');
  if (idCol < 0 || emailCol < 0) throw new Error('Colonnes « id » et « primary_email_address » introuvables dans l\'export.');
  const users = [];
  const skipped = [];
  const seen = new Set();
  rows.forEach((row, index) => {
    const id = (row[idCol] || '').trim();
    const email = normalizeEmail(row[emailCol] || '');
    if (!/^user_[A-Za-z0-9]+$/.test(id)) return skipped.push(`ligne ${index + 2} : identifiant invalide`);
    if (!email) return skipped.push(`ligne ${index + 2} : adresse e-mail invalide`);
    if (seen.has(email)) return skipped.push(`ligne ${index + 2} : adresse en double`);
    seen.add(email);
    users.push({ id, email });
  });
  return { users, skipped };
}

// Crée les comptes absents. Sans `apply`, ne modifie rien et indique ce qui serait fait.
export async function importClerkUsers({ db, store, users, apply = false }) {
  const result = { created: [], existing: [], conflicts: [] };
  for (const { id, email } of users) {
    const byEmail = await store.findUserByEmail(db, email);
    const byId = await store.findUserById(db, id);
    if (byId && byId.email === email) { result.existing.push(email); continue; }
    // Un compte RIS Pro existe déjà avec cette adresse ou cet identifiant, mais pas les deux : à régler à la main.
    if (byEmail || byId) { result.conflicts.push(`${email} (${id})`); continue; }
    if (apply) await store.createUser(db, { id, email, emailVerified: true });
    result.created.push(email);
  }
  return result;
}
