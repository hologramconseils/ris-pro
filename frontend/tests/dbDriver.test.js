import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNeonUrl } from '../lib/dbUrl.js';

test('isNeonUrl reconnaît les adresses Neon', () => {
  assert.equal(isNeonUrl('postgresql://u:p@ep-square-block-ash3z8y6-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require'), true);
  assert.equal(isNeonUrl('postgresql://u:p@neon.tech/db'), true);
});

test('isNeonUrl rejette un PostgreSQL local ou une adresse piégée', () => {
  assert.equal(isNeonUrl('postgresql://ris:mdp@127.0.0.1:5432/ris'), false);
  assert.equal(isNeonUrl('postgresql://ris:mdp@localhost/ris'), false);
  assert.equal(isNeonUrl('postgresql://ris:mdp@notneon.tech.example.com/ris'), false);
  assert.equal(isNeonUrl(''), false);
  assert.equal(isNeonUrl(undefined), false);
});
