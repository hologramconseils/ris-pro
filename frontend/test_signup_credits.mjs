import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const email = `test_signup_${Date.now()}@example.com`;
  const password = 'TestPassword123!';
  
  console.log('Creating test user:', email);
  
  const { data, error } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true
  });
  
  if (error) {
    console.error('Error creating user:', error);
    return;
  }
  
  const user = data.user;
  console.log('User created in auth.users:', user.id);
  
  // Wait a moment for trigger to run
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const { data: profile, error: err2 } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
    
  if (err2) {
    console.error('Error fetching profile:', err2);
  } else {
    console.log('Profile found:', JSON.stringify(profile, null, 2));
  }
  
  // Cleanup
  await supabase.auth.admin.deleteUser(user.id);
  console.log('Test user deleted.');
}

check();
