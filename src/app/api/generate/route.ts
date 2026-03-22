import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FREE_TIER_LIMIT = 5;

export async function POST(req: NextRequest) {
  try {
    // Initialize clients inside the function to avoid build-time instantiation
    const { GoogleGenAI } = await import('@google/genai');
    const { supabaseAdmin } = await import('@/lib/supabase-admin');

    // Validate environment variables
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Missing GEMINI_API_KEY');
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const body = await req.json();
    const input = body.input;

    // Authenticate user gracefully (allow anonymous)
    const authHeader = req.headers.get('authorization');
    let user: any = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: authData } = await supabaseAdmin.auth.getUser(token);
      if (authData?.user) {
        user = authData.user;
      }
    }

    let newCount = 0;

    if (user) {
      // Check usage limits BEFORE AI generation
      const { data: usageData } = await supabaseAdmin
        .from('user_usage')
        .select('count, last_reset')
        .eq('user_id', user.id)
        .single();

      let currentCount = usageData?.count || 0;
      
      const today = new Date().toISOString().split('T')[0];
      let lastResetDate = '';
      if (usageData?.last_reset) {
        lastResetDate = new Date(usageData.last_reset).toISOString().split('T')[0];
      }

      console.log('RESET CHECK:', { today, lastResetDate, match: today === lastResetDate });

      if (today !== lastResetDate) {
        currentCount = 0;
        await supabaseAdmin.from('user_usage').upsert(
          { user_id: user.id, count: 0, last_reset: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      }

      if (currentCount >= FREE_TIER_LIMIT) {
        return NextResponse.json({ error: 'Limit Reached' }, { status: 403 });
      }

      newCount = currentCount + 1;
    }

    // Prepare Prompt
    const prompt = `You are an elite viral content strategist. Transform the provided text into 3 high-impact hooks using these psychological frameworks:

1. The Anti-Trend (Going against popular advice)
2. The Specificity Hook (Using exact numbers/data)
3. The "If/Then" Hook (Conditional logic that promises a result)

Input text: "${input}"

Return ONLY a valid JSON object with this exact structure (no markdown fences, just pure JSON):
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

    // Valid stream started successfully! Safely increment DB stats now.
    if (user) {
      console.log("Usage count updated:", newCount);
      Promise.allSettled([
        supabaseAdmin.from('user_usage').upsert(
          { user_id: user.id, count: newCount, last_reset: new Date().toISOString(), updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        ),
        supabaseAdmin.from('usage_logs').insert({ user_id: user.id, input_text: input })
      ]).catch(() => {});
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamingResponse) {
            if (chunk.text) {
              controller.enqueue(encoder.encode(chunk.text));
            }
          }
          controller.close();
        } catch (error) {
          console.error('Stream processing error:', error);
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Generation execution error:', error);
    return NextResponse.json(
      { error: 'Server Maintenance' },
      { status: 500 }
    );
  }
}
