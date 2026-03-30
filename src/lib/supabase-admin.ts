import { createClient } from '@supabase/supabase-js';

// Explicit naming for Vercel environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize admin client - returns null if keys are missing (no exports inside if-block)
export const supabaseAdmin = (supabaseUrl && serviceRoleKey)
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

// Log warning if keys are missing (server-side only)
if (typeof window === 'undefined' && (!supabaseUrl || !serviceRoleKey)) {
  console.error('CRITICAL: Supabase Admin Keys are missing!');
}
