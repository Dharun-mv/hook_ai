'use server';

import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function saveHookAction(originalText: string, hookContent: string, type: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("CRITICAL: SERVICE_ROLE_KEY IS MISSING IN PRODUCTION");
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: any) {
          cookieStore.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthorized' };
  }

  console.log("Saving hook for user:", user.id);
  console.log("Attempting to insert into saved_hooks with:", { user_id: user.id, original_text: originalText, hook_content: hookContent });

  const payload = {
    user_id: user.id,
    original_text: originalText,
    hook_content: hookContent,
    type: type,
  };

  console.log("Payload to save:", payload);

  const response = await supabaseAdmin.from('saved_hooks').insert(payload);
  const { data, error } = response;

  console.log("Supabase Response:", { data, error });

  if (error) {
    console.error('SAVE HOOK FATAL INSERT ERROR:', error);
    return { error: error.message };
  }

  return { success: true };
}
