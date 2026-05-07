import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://afnluujjkdodbaufbnuw.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkErrors() {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  console.log('Latest Analyses Logs:');
  console.log(JSON.stringify(data, null, 2));
}

checkErrors();
