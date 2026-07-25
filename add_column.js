import { getDb } from './frontend/api/db.js';

async function run() {
  const pool = getDb();
  try {
    await pool.query('ALTER TABLE analyses ADD COLUMN IF NOT EXISTS file_base64 TEXT;');
    console.log("Column file_base64 added successfully.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
