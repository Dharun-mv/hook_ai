'use server';

import { supabase, supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function saveHookAction(originalText: string, hookContent: string, type: string) {
  // Check if user is signed in
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
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
