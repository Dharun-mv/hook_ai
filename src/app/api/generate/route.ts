import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FREE_TIER_LIMIT = 5;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await req.json();
        const input = body.input;

        // Get authenticated user
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: 'Authentication required' }) + '\n'));
          controller.close();
          return;
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: 'Authentication required' }) + '\n'));
          controller.close();
          return;
        }

        // Check usage limit - optimized with single query
        const { data: usageData, error: usageError } = await supabase
          .from('user_usage')
          .select('count')
          .eq('user_id', user.id)
          .single();

        if (!usageError && usageData && usageData.count >= FREE_TIER_LIMIT) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: 'Usage limit reached. Please upgrade to continue.' }) + '\n'));
          controller.close();
          return;
        }

        // Start streaming AI response immediately
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

        // Use streaming for faster perceived response
        const streamingResponse = await ai.models.streamGenerateContent({
          model: 'gemini-2.5-flash-lite',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        let fullText = '';

        for await (const chunk of streamingResponse) {
          if (chunk.text) {
            fullText += chunk.text;
            controller.enqueue(encoder.encode(JSON.stringify({ chunk: chunk.text, done: false }) + '\n'));
          }
        }

        // Parse complete JSON and send final result
        const jsonMatch = fullText.match(/\{[\s\S]*"hooks"[\s\S]*\}/);
        if (!jsonMatch) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: 'Invalid response format from AI' }) + '\n'));
          controller.close();
          return;
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Update usage count after successful generation
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

        // Log usage
        await supabase
          .from('usage_logs')
          .insert({ user_id: user.id, input_text: input });

        controller.enqueue(encoder.encode(JSON.stringify({
          hooks: parsed.hooks,
          done: true,
          usageCount: (existingUsage?.count || 0) + 1
        }) + '\n'));
        controller.close();

      } catch (error) {
        console.error('Generation error:', error);
        controller.enqueue(encoder.encode(JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to generate hooks'
        }) + '\n'));
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
