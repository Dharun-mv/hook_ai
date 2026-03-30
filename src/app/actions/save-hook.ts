'use server';

import { headers, cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

export async function saveHookAction(
  originalText: string,
  hookContent: string,
  type: string,
  userId: string
) {
  // Verify userId is provided
  if (!userId) {
    console.error('SAVE HOOK: No userId provided');
    return { error: 'User ID is required' };
  }

  // Check if supabaseAdmin is available
  if (!supabaseAdmin) {
    console.error('Database not connected - supabaseAdmin is null');
    return { error: 'Database not connected' };
  }

  try {
    console.log("SERVER ACTION AUTH CHECK:", userId);
    console.log("Saving hook for user:", userId);

    // Verify user exists using supabaseAdmin
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('User verification failed:', userError);
      return { error: 'User not found' };
    }

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
