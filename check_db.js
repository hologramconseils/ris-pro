
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching analyses:", error);
  } else if (data && data.length > 0) {
    console.log("Columns in 'analyses':", Object.keys(data[0]));
  } else {
    console.log("No data in 'analyses' to check columns.");
  }
}

checkSchema();
