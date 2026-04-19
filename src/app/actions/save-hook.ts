'use server';

import { headers, cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

interface SaveHookParams {
  userId: string;
  originalText: string;
  hookContent: string;
  type: string;
  hookTitle?: string;
  hookId?: string;
  viralityScore?: number;
  psychologicalTrigger?: string;
  improvementTip?: string;
  platformFit?: string;
  reasoning?: string;
}

export async function saveHookAction(
  userId: string,
  originalText: string,
  hookContent: string,
  type: string,
  hookTitle?: string,
  hookId?: string,
  viralityScore?: number,
  psychologicalTrigger?: string,
  improvementTip?: string,
  platformFit?: string,
  reasoning?: string
) {
  // Verify userId is provided
  if (!userId) {
    console.error('SAVE HOOK: No userId provided');
    return { error: 'No User ID provided', hookId: null };
  }

  // Check if supabaseAdmin is available
  if (!supabaseAdmin) {
    console.error('Database not connected - supabaseAdmin is null');
    return { error: 'Database not connected', hookId: null };
  }

  try {
    console.log("SERVER ACTION AUTH CHECK:", userId || "No User Found");
    console.log("Saving hook for user:", userId);

    // Use supabaseAdmin to bypass RLS
    const insertData: Record<string, any> = {
      user_id: userId,
      original_text: originalText,
      hook_text: hookContent,
      hook_type: type,
      hook_title: hookTitle || type,
      hook_id: hookId || `${type}_${Date.now()}`,
    };

    if (viralityScore !== undefined) insertData.virality_score = viralityScore;
    if (psychologicalTrigger) insertData.psychological_trigger = psychologicalTrigger;
    if (improvementTip) insertData.improvement_tip = improvementTip;
    if (platformFit) insertData.platform_fit = platformFit;
    if (reasoning) insertData.reasoning = reasoning;

    const { data, error } = await supabaseAdmin
      .from('saved_hooks')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('SAVE HOOK FATAL INSERT ERROR:', JSON.stringify(error, null, 2));
      return { error: error.message, hookId: null };
    }

    console.log("Hook saved successfully:", data);

    // Revalidate root path after successful insert
    revalidatePath('/');

    return { success: true, hookId: data?.id };
  } catch (error) {
    console.error('SAVE HOOK UNEXPECTED ERROR:', error);
    return { error: error instanceof Error ? error.message : 'Failed to save hook', hookId: null };
  }
}

export async function updateHookViewsAction(
  hookId: string,
  views: number
) {
  if (!supabaseAdmin) {
    return { error: 'Database not connected' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('saved_hooks')
      .update({
        actual_views: views,
        updated_at: new Date().toISOString()
      })
      .eq('id', hookId);

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to update views' };
  }
}
