'use server';

import { headers, cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

export async function saveHookAction(
  userId: string,
  originalText: string,
  hookContent: string,
  type: string
) {
  // Verify userId is provided
  if (!userId) {
    console.error('SAVE HOOK: No userId provided');
    return { error: 'No User ID provided' };
  }

  // Check if supabaseAdmin is available
  if (!supabaseAdmin) {
    console.error('Database not connected - supabaseAdmin is null');
    return { error: 'Database not connected' };
  }

  try {
    console.log("SERVER ACTION AUTH CHECK:", userId || "No User Found");
    console.log("Saving hook for user:", userId);

    // Use supabaseAdmin to bypass RLS
    // Columns: user_id, original_text, hook_content, type
    const { data, error } = await supabaseAdmin
      .from('saved_hooks')
      .insert({
        user_id: userId,
        original_text: originalText,
        hook_content: hookContent,
        type: type,
      });

    if (error) {
      console.error('SAVE HOOK FATAL INSERT ERROR:', JSON.stringify(error, null, 2));
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
