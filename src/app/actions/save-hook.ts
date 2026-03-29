'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

export async function saveHookAction(originalText: string, hookContent: string, type: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("CRITICAL: SERVICE_ROLE_KEY IS MISSING IN PRODUCTION");
  }

  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    console.log("Saving hook for user:", user.id);

    // Use supabaseAdmin (Service Role) to bypass RLS
    // Column names: user_id, original_text, hook_content, type
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
      // Return the EXACT error message so I can see it
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
