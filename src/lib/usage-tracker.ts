'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getUserCredits(userId: string) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('usage_logs')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', today)
    .order('created_at', { ascending: false });

  if (error) return { count: 0, error };
  return { count: data?.length || 0, data };
}

export async function incrementUsage(userId: string, inputText: string) {
  const { error } = await supabase.from('usage_logs').insert({
    user_id: userId,
    input_text: inputText,
  });

  return !error;
}
