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
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("CRITICAL: SERVICE_ROLE_KEY IS MISSING IN PRODUCTION");
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
      const { data: authData } = await supabaseAdmin.auth.getUser(token);
      if (authData?.user) {
        user = authData.user;
      }
    }

    console.log("API ROUTE TRIGGERED for user:", user?.id);

    let newCount = 0;
    let shouldIncrement = false;
    let usage: { count: number; last_reset: string } | null = null;

    if (user) {
      // ==========================================
      // STEP 2: FETCH - Get current usage row
      // ==========================================
      const { data } = await supabaseAdmin
        .from('user_usage')
        .select('count, last_reset')
        .eq('user_id', user.id)
        .single();

      usage = data;

      // ==========================================
      // STEP 3: THE 'CLOCK' CHECK (MUST BE FIRST)
      // Clean the house BEFORE checking the door
      // ==========================================
      const today = new Date().getUTCDate();
      const lastResetDate = usage?.last_reset ? new Date(usage.last_reset).getUTCDate() : null;

      console.log('CLOCK CHECK:', { today, lastResetDate, currentCount: usage?.count });

      let currentCount = usage?.count ?? 0;

      if (today !== lastResetDate) {
        await supabaseAdmin.from('user_usage').upsert({
          user_id: user.id,
          count: 0,
          last_reset: new Date().toISOString()
        });
        // CRITICAL: Manually set the local variable to 0
        currentCount = 0;
        console.log('AUTOMATIC RESET TRIGGERED for user', user.id);
      }

      // ==========================================
      // THE LIMIT CHECK (SECOND)
      // ONLY NOW, check if currentCount >= 5
      // ==========================================
      if (currentCount >= FREE_TIER_LIMIT) {
        return NextResponse.json({ error: 'Limit Reached' }, { status: 403 });
      }

      newCount = currentCount + 1;
      shouldIncrement = true;
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
