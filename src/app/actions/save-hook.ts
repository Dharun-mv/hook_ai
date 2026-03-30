'use server';

import { createClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

export async function saveHookAction(originalText: string, hookContent: string, type: string) {
  // Create Supabase client with cookies for server action auth
  const cookieStore = await cookies();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
    {
      cookies: {
        getAll: () => {
          const allCookies = cookieStore.getAll();
          return allCookies.map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }));
        },
        setAll: (cookiesToSet) => {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie);
          }
        },
      },
    }
  );

  // Check if user is signed in
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  console.log("SERVER ACTION AUTH CHECK:", user?.id || "No User Found");

  if (authError || !user) {
    console.error('Auth error:', authError);
    return { error: 'Please sign in to save hooks' };
  }

  // Check if supabaseAdmin is available
  if (!supabaseAdmin) {
    console.error('Database not connected - supabaseAdmin is null');
    return { error: 'Database not connected' };
  }

  try {
    console.log("Saving hook for user:", user.id);

    // Use supabaseAdmin to bypass RLS
    // Columns: user_id, original_text, hook_content, type
    const { data, error } = await supabaseAdmin
      .from('saved_hooks')
      .insert({
        user_id: user.id,
        original_text: originalText,
        hook_content: hookContent,
        type: type,
      });

    if (error) {
      console.error('SAVE HOOK FATAL INSERT ERROR:', error);
      return { error: error.message };
    }

    console.log("Hook saved successfully:", data);

    // Revalidate root path after successful insert
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('SAVE HOOK UNEXPECTED ERROR:', error);
    return { error: error instanceof Error ? error.message : 'Failed to save hook' };
  }
}
