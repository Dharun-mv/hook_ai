import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GUEST_LIMIT = 5;

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
    // STEP 1: AUTH CHECK - Get the user
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

    // ==========================================
    // STEP 2: TWO-TIER GATE
    // ==========================================
    let guestId: string | null = null;

    if (!user) {
      // GUEST: Check guest limit
      const cookieStore = await cookies();
      guestId = cookieStore.get('guest_id')?.value || null;

      if (!guestId) {
        guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Check guest usage via supabaseAdmin
      if (supabaseAdmin && guestId) {
        const { data: guestUsage } = await supabaseAdmin
          .from('guest_usage')
          .select('count')
          .eq('guest_id', guestId)
          .single();

        const guestCount = guestUsage?.count ?? 0;

        if (guestCount >= GUEST_LIMIT) {
          return NextResponse.json(
            { error: 'Sign in to continue' },
            { status: 403 }
          );
        }
      }
    }

    // ==========================================
    // STEP 3: AI GENERATION
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
    // STEP 4: INCREMENT USAGE (Optional stats)
    // ==========================================
    if (user && supabaseAdmin) {
      // Logged in user - increment user_usage
      Promise.allSettled([
        supabaseAdmin.from('user_usage').upsert(
          {
            user_id: user.id,
            count: 1,
            last_reset: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        ),
        supabaseAdmin.from('usage_logs').insert({ user_id: user.id, input_text: input })
      ]).catch(() => {});
    } else if (supabaseAdmin && guestId) {
      // Guest - increment guest_usage
      Promise.allSettled([
        supabaseAdmin.from('guest_usage').upsert(
          {
            guest_id: guestId,
            count: 1,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'guest_id' }
        )
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

    const response = new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

    // Set guest_id cookie if guest
    if (!user && guestId) {
      response.cookies.set('guest_id', guestId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 86400, // 1 day
      });
    }

    return response;

  } catch (error) {
    console.error('Generation execution error:', error);
    return NextResponse.json(
      { error: 'Server Maintenance' },
      { status: 500 }
    );
  }
}
