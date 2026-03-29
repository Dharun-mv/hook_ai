'use server';

import { supabase, supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function saveHookAction(originalText: string, hookContent: string, type: string) {
  // Check if database is connected
  if (!supabase || !supabaseAdmin) {
    console.log('Database not connected - hook not saved');
    return { success: false, message: 'Database not connected' };
  }

  try {
    // Identify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

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

    // Revalidate dashboard so the new hook shows up immediately
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('SAVE HOOK UNEXPECTED ERROR:', error);
    return { error: error instanceof Error ? error.message : 'Failed to save hook' };
  }
}
