import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FREE_TIER_LIMIT = 5;

export async function POST(req: NextRequest) {
  try {
    const { GoogleGenAI } = await import('@google/genai');

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Missing GEMINI_API_KEY');
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const body = await req.json();
    const input = body.input;

    // ==========================================
    // STEP 1: AUTH - Get the user
    // ==========================================
    const authHeader = req.headers.get('authorization');
    let user: any = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: authData } = await supabase.auth.getUser(token);
      if (authData?.user) {
        user = authData.user;
      }
    }

    console.log("API ROUTE TRIGGERED for user:", user?.id);

    let newCount = 0;
    let shouldIncrement = false;
    let currentCount = 0;

    if (user) {
      // ==========================================
      // STEP 2: FETCH USAGE - Get the user_usage row
      // ==========================================
      const { data: usage } = await supabaseAdmin
        .from('user_usage')
        .select('count, last_reset')
        .eq('user_id', user.id)
        .single();

      // ==========================================
      // STEP 3: DATE RESET (THE PRIORITY)
      // ==========================================
      const today = new Date().getUTCDate();
      const lastResetDate = usage?.last_reset ? new Date(usage.last_reset).getUTCDate() : null;

      currentCount = usage?.count ?? 0;

      if (today !== lastResetDate) {
        await supabaseAdmin.from('user_usage').upsert({
          user_id: user.id,
          count: 0,
          last_reset: new Date().toISOString()
        });
        // Update local variable for the next check
        currentCount = 0;
        console.log('AUTOMATIC RESET TRIGGERED for user', user.id);
      }

      // ==========================================
      // STEP 4: LIMIT CHECK
      // ==========================================
      if (currentCount >= FREE_TIER_LIMIT) {
        return NextResponse.json({ error: 'Limit Reached' }, { status: 403 });
      }

      newCount = currentCount + 1;
      shouldIncrement = true;
    }

    // ==========================================
    // STEP 5: AI STREAM - Generate hook via Gemini
    // ==========================================
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

    const streamingResponse = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    // ==========================================
    // STEP 6: INCREMENT - After stream starts, increment count
    // ==========================================
    if (user && shouldIncrement) {
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
