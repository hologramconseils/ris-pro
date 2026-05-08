
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://afnluujjkdodbaufbnuw.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmx1dWpqa2RvZGJhdWZibnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzI1MjAsImV4cCI6MjA5MjcwODUyMH0.9Sfc-FPZCubQ9EJXjv6mFZ4TpUete17ASSew3I-_oOY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  // Hack to see if tables exist by querying them
  const tables = ['analyses', 'profiles', 'documents'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table ${table}: ERROR - ${error.message}`);
    } else {
      console.log(`Table ${table}: OK`);
    }
  }
}

listTables();
