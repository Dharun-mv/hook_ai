import { createClient } from '@supabase/supabase-js';

// Explicit naming for Vercel environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// THE SAFETY CHECK - Return null instead of crashing
if (!supabaseUrl || !serviceRoleKey) {
  console.error('CRITICAL: Supabase Admin Keys are missing!');
  export const supabaseAdmin = null;
} else {
  // Server-side admin client (uses service role key - bypasses RLS)
  export const supabaseAdmin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  // Throw error ONLY on server-side to prevent leaks
  if (typeof window === 'undefined' && !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in server environments');
  }
}
