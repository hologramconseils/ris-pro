import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.vercel') });

import { getDb } from '../frontend/api/db.js';

async function run() {
  const pool = getDb();
  try {
    const res = await pool.query('SELECT user_id, file_path, results FROM analyses ORDER BY created_at DESC LIMIT 1');
    if (res.rows.length > 0) {
      console.log(JSON.stringify(res.rows[0].results, null, 2));
    } else {
      console.log('No analyses found.');
    }
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
