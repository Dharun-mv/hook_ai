import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 1. Define the variables at the top level
export let supabase: any = null;

// 2. Initialize only if keys exist
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.error('CRITICAL: Supabase Public Keys are missing!');
}

  // Throw error ONLY on server-side to prevent leaks
  if (typeof window === 'undefined' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in server environments');
  }
}
