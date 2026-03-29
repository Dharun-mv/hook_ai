import { createClient } from '@supabase/supabase-js';

// Explicit naming for Vercel environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// THE SAFETY CHECK - Return null instead of crashing
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRITICAL: Supabase Public Keys are missing!');
  export const supabase = null;
  export const supabaseAdmin = null;
} else {
  // Client-side client (uses anon key)
  export const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Server-side admin client (uses service role key - bypasses RLS)
  export const supabaseAdmin = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  // Throw error ONLY on server-side to prevent leaks
  if (typeof window === 'undefined' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in server environments');
  }
}
