import { getDb } from './db.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function run() {
  const pool = getDb();
  try {
    const { rows } = await pool.query("SELECT * FROM analyses ORDER BY created_at DESC LIMIT 1");
    if (rows.length > 0) {
      const results = rows[0].results;
      console.log("Trimestres valides:", results.trimestres_valides);
      console.log("Anomalies:", JSON.stringify(results.anomalies).substring(0, 100));
      console.log("Summary:", results.summary ? results.summary.substring(0, 200) : "NO SUMMARY");
      console.log("Strategies array length:", results.strategies ? results.strategies.length : "undefined");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
