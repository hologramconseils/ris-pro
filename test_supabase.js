import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://afnluujjkdodbaufbnuw.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmx1dWpqa2RvZGJhdWZibnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzI1MjAsImV4cCI6MjA5MjcwODUyMH0.9Sfc-FPZCubQ9EJXjv6mFZ4TpUete17ASSew3I-_oOY"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  console.log("Checking bucket 'documents'...")
  const { data, error } = await supabase.storage.from('documents').list('uploads')
  if (error) {
    console.error("Error listing files:", error)
  } else {
    console.log("Files found:", data.length)
    data.slice(0, 5).forEach(f => console.log(`- ${f.name}`))
  }
}

test()
