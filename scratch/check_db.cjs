const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query("SELECT * FROM analyses ORDER BY created_at DESC LIMIT 1");
    if (res.rows.length > 0) {
      const results = res.rows[0].results;
      console.log("Trimestres valides (Ag2):", results.trimestres_valides);
      console.log("Anomalies:", JSON.stringify(results.anomalies).substring(0, 100));
      console.log("Summary:", results.summary.substring(0, 500));
      console.log("Strategies:", results.strategies ? results.strategies.length : "undefined");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
