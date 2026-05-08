
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://afnluujjkdodbaufbnuw.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmx1dWpqa2RvZGJhdWZibnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzI1MjAsImV4cCI6MjA5MjcwODUyMH0.9Sfc-FPZCubQ9EJXjv6mFZ4TpUete17ASSew3I-_oOY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLastAnalysis() {
  const { data, error } = await supabase
    .from('analyses')
    .select('status, results')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching last analysis:", error);
  } else if (data && data.length > 0) {
    console.log("Last Analysis Status:", data[0].status);
    console.log("Results/Error:", data[0].results);
  } else {
    console.log("No analyses found.");
  }
}

checkLastAnalysis();
