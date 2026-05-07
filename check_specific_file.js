import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.production" });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const filePath = 'uploads/d7e4v1jqn4m_1778151620519.pdf';
  const { data, error } = await supabase.storage.from('documents').download(filePath);
  if (error) {
    console.log(`ERROR DOWNLOADING: ${error.message}`);
  } else {
    console.log(`SUCCESS: Downloaded ${data.size} bytes`);
  }
}
run();
