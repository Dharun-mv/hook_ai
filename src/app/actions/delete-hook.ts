'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

export async function deleteHookAction(userId: string, hookId: string) {
  if (!userId) {
    console.error('DELETE HOOK: No userId provided');
    return { error: 'No User ID provided', success: false };
  }

  if (!hookId) {
    console.error('DELETE HOOK: No hookId provided');
    return { error: 'No Hook ID provided', success: false };
  }

  if (!supabaseAdmin) {
    console.error('Database not connected - supabaseAdmin is null');
    return { error: 'Database not connected', success: false };
  }

  try {
    console.log("SERVER ACTION: Deleting hook for user:", userId, "hookId:", hookId);

    const { error } = await supabaseAdmin
      .from('saved_hooks')
      .delete()
      .eq('id', hookId)
      .eq('user_id', userId);

    if (error) {
      console.error('DELETE HOOK ERROR:', JSON.stringify(error, null, 2));
      return { error: error.message, success: false };
    }

    console.log("Hook deleted successfully:", hookId);

    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('DELETE HOOK UNEXPECTED ERROR:', error);
    return { error: error instanceof Error ? error.message : 'Failed to delete hook', success: false };
  }
}
