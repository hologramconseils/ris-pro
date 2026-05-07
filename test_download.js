import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://afnluujjkdodbaufbnuw.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmx1dWpqa2RvZGJhdWZibnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzI1MjAsImV4cCI6MjA5MjcwODUyMH0.9Sfc-FPZCubQ9EJXjv6mFZ4TpUete17ASSew3I-_oOY"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const filePath = "uploads/80pjpy7lyd_1778167409366.pdf"
  console.log(`Attempting to download ${filePath}...`)
  const { data, error } = await supabase.storage.from('documents').download(filePath)
  if (error) {
    console.error("Download Error:", error.message)
  } else {
    console.log("Download Success! Size:", data.size, "bytes")
  }
}

test()
