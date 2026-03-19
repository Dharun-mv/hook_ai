'use server';

import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

interface Hook {
  id: string;
  type: 'anti-trend' | 'specificity' | 'if-then';
  title: string;
  content: string;
  description: string;
}

interface GenerateHooksResult {
  hooks: Hook[];
  error?: string;
  usageCount?: number;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FREE_TIER_LIMIT = 5;

export async function generateHooks(input: string): Promise<GenerateHooksResult> {
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { hooks: [], error: 'Authentication required' };
    }

    // Check usage limit from user_usage table
    const { data: usageData, error: usageError } = await supabase
      .from('user_usage')
      .select('count')
      .eq('user_id', user.id)
      .single();

    if (!usageError && usageData && usageData.count >= FREE_TIER_LIMIT) {
      return { hooks: [], error: 'Usage limit reached. Please upgrade to continue.' };
    }
    const prompt = `You are an elite viral content strategist. Transform the provided text into 3 high-impact hooks using these psychological frameworks:

1. The Anti-Trend (Going against popular advice)
2. The Specificity Hook (Using exact numbers/data)
3. The "If/Then" Hook (Conditional logic that promises a result)

Input text: "${input}"

Return ONLY a valid JSON object with this exact structure:
{
  "hooks": [
    {
      "id": "anti-trend",
      "type": "anti-trend",
      "title": "The Anti-Trend",
      "description": "Going against popular advice",
      "content": "<hook content here>"
    },
    {
      "id": "specificity",
      "type": "specificity",
      "title": "The Specificity Hook",
      "description": "Using exact numbers/data",
      "content": "<hook content here>"
    },
    {
      "id": "if-then",
      "type": "if-then",
      "title": "The If/Then Hook",
      "description": "Conditional logic that promises a result",
      "content": "<hook content here>"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*"hooks"[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from AI');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Increment usage count in user_usage table
    const { data: existingUsage } = await supabase
      .from('user_usage')
      .select('count')
      .eq('user_id', user.id)
      .single();

    if (existingUsage) {
      await supabase
        .from('user_usage')
        .update({ count: (existingUsage.count || 0) + 1, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_usage')
        .insert({ user_id: user.id, count: 1 });
    }

    // Also log the usage
    await supabase
      .from('usage_logs')
      .insert({ user_id: user.id, input_text: input });

    return { hooks: parsed.hooks, usageCount: (existingUsage?.count || 0) + 1 };
  } catch (error) {
    console.error('Hook generation error:', error);
    return {
      hooks: [],
      error: error instanceof Error ? error.message : 'Failed to generate hooks',
    };
  }
}
