import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FREE_TIER_LIMIT = 5;

export async function POST(req: NextRequest) {
  // Initialize clients inside the function to avoid build-time instantiation
  const { GoogleGenAI } = await import('@google/genai');
  const { createClient } = await import('@supabase/supabase-js');

  // Validate environment variables
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await req.json();
        const input = body.input;

        // Authenticate user gracefully (allow anonymous)
        const authHeader = req.headers.get('authorization');
        let user: any = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.replace('Bearer ', '');
          // We can use supabaseAdmin.auth.getUser to verify token reliably
          const { data: authData } = await supabaseAdmin.auth.getUser(token);
          if (authData?.user) {
            user = authData.user;
          }
        }

        let newCount = 0;

        if (user) {
          // Check usage limit - optimized with single query
          const { data: usageData, error: usageError } = await supabaseAdmin
            .from('user_usage')
            .select('count, last_reset')
            .eq('user_id', user.id)
            .single();

          let currentCount = usageData?.count || 0;
          const todayString = new Date().toDateString();

          let lastResetString = null;
          if (usageData?.last_reset) {
            lastResetString = new Date(usageData.last_reset).toDateString();
          }

          if (usageData && lastResetString !== todayString) {
            // Reset needed
            currentCount = 0;
            await supabaseAdmin.from('user_usage')
              .update({ count: 0, last_reset: new Date().toISOString() })
              .eq('user_id', user.id);
          }

          if (!usageError && usageData && currentCount >= FREE_TIER_LIMIT) {
            controller.enqueue(encoder.encode(JSON.stringify({ error: 'Usage limit reached. Please upgrade to continue.' }) + '\n'));
            controller.close();
            return;
          }

          newCount = currentCount + 1;
          console.log("Usage count updated:", newCount);

          // Start database updates in the background immediately, bypassing RLS using service role
          Promise.allSettled([
            usageData
              ? supabaseAdmin.from('user_usage').update({ count: newCount, updated_at: new Date().toISOString() }).eq('user_id', user.id)
              : supabaseAdmin.from('user_usage').insert({ user_id: user.id, count: newCount, last_reset: new Date().toISOString() }),
            supabaseAdmin.from('usage_logs').insert({ user_id: user.id, input_text: input })
          ]).catch(() => {}); // Silently ignore background DB errors
        }
        // If user is null, frontend automatically enforces the 2 hook anonymous local limit.

        // Start streaming AI response immediately - don't wait for DB operations below
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
        const streamingResponse = await ai.models.generateContentStream({
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

        // Send complete response to client
        controller.enqueue(encoder.encode(JSON.stringify({
          hooks: parsed.hooks,
          done: true,
          usageCount: newCount
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
