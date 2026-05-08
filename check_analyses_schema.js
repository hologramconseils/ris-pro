
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://afnluujjkdodbaufbnuw.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmx1dWpqa2RvZGJhdWZibnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzI1MjAsImV4cCI6MjA5MjcwODUyMH0.9Sfc-FPZCubQ9EJXjv6mFZ4TpUete17ASSew3I-_oOY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAnalysesSchema() {
  const { data, error } = await supabase.from('analyses').select('*').limit(1);
  if (error) {
    console.error("Error fetching analyses:", error.message);
    return;
  }
  if (data && data.length > 0) {
    console.log("Analyses columns:", Object.keys(data[0]));
  } else {
    console.log("No analysis found.");
  }
}

checkAnalysesSchema();
