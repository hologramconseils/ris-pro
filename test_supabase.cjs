const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://afnluujjkdodbaufbnuw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmx1dWpqa2RvZGJhdWZibnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzI1MjAsImV4cCI6MjA5MjcwODUyMH0.9Sfc-FPZCubQ9EJXjv6mFZ4TpUete17ASSew3I-_oOY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Testing connection...");
  const { data, error } = await supabase.storage.from('documents').list();
  if (error) {
    console.error("Error listing bucket:", error.message);
    return;
  }
  console.log("Bucket access successful. Files found:", data.length);
  
  console.log("Testing upload...");
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload('test_connection.txt', 'Connection successful', { upsert: true });
    
  if (uploadError) {
    console.error("Upload failed:", uploadError.message);
  } else {
    console.log("Upload successful!");
  }
}

test();
