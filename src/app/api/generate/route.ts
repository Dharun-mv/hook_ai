import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GUEST_LIMIT = 5;

// Fetch top 3 trending hooks for few-shot examples
async function fetchTrendingExamples() {
  if (!supabaseAdmin) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from('trending_benchmarks')
      .select('hook_text, hook_type, psychological_trigger')
      .order('view_count', { ascending: false })
      .limit(3);

    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

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
      const cookieStore = await cookies();
      guestId = cookieStore.get('guest_id')?.value || null;

      if (!guestId) {
        guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

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
    // STEP 3: FETCH TRENDING EXAMPLES FOR FEW-SHOT
    // ==========================================
    const trendingExamples = await fetchTrendingExamples();

    const fewShotContext = trendingExamples.length > 0
      ? trendingExamples.map((ex, i) => `Example ${i + 1}:
   - Hook: "${ex.hook_text}"
   - Type: ${ex.hook_type}
   - Trigger: ${ex.psychological_trigger || 'N/A'}
   - Performance: Top trending (high view count)`).join('\n\n')
      : 'No trending examples available - use your training on 2026 viral content patterns.';

    // ==========================================
    // STEP 4: AI GENERATION WITH SYSTEM INSTRUCTIONS
    // ==========================================
    const systemInstruction = `You are the HOOK ARCHITECT - an elite viral content AI engine specialized in 2026 short-form video hooks (TikTok, Reels, Shorts).

YOUR MISSION:
Transform any input text into 3 psychologically-optimized viral hooks that stop scrolls and drive engagement.

2026 VIRAL HOOK FRAMEWORKS:
1. ANTI-TREND: Challenge popular advice, create controversy, go against the grain
2. SPECIFICITY: Use exact numbers, data, timestamps - specificity = credibility
3. IF/THEN: Conditional promise with clear cause-effect relationship

PSYCHOLOGICAL TRIGGERS TO LEVERAGE:
- Curiosity Gap (withhold key info to create tension)
- Negative Constraint (what NOT to do performs 2x better)
- Social Proof (implied popularity/authority)
- Urgency/Scarcity (time-sensitive framing)
- Pattern Interrupt (break expected narrative)
- Identity Appeal (speak to who they want to be)

VIRALITY SCORE CALCULATION (1-100):
- 80-100: Elite - combines 2+ triggers, specific, emotionally charged
- 50-79: Solid - clear hook with one strong trigger
- Below 50: Weak - generic, no clear trigger, boring

IMPROVEMENT TIPS MUST BE ACTIONABLE:
- Camera direction (zoom, cut, angle)
- Editing technique (text overlay, sound effect, timing)
- Delivery note (pace, pause, emphasis)

FEW-SHOT EXAMPLES FROM TRENDING BENCHMARKS:
${fewShotContext}

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure - no markdown, no commentary:
{
  "hooks": [
    {
      "id": "anti-trend",
      "type": "anti-trend",
      "title": "The Anti-Trend",
      "description": "Going against popular advice",
      "content": "<the actual hook text>",
      "virality_score": <number 1-100>,
      "psychological_trigger": "<specific trigger name>",
      "improvement_tip": "<one sentence on filming/editing>"
    },
    {
      "id": "specificity",
      "type": "specificity",
      "title": "The Specificity Hook",
      "description": "Using exact numbers/data",
      "content": "<the actual hook text>",
      "virality_score": <number 1-100>,
      "psychological_trigger": "<specific trigger name>",
      "improvement_tip": "<one sentence on filming/editing>"
    },
    {
      "id": "if-then",
      "type": "if-then",
      "title": "The If/Then Hook",
      "description": "Conditional logic that promises a result",
      "content": "<the actual hook text>",
      "virality_score": <number 1-100>,
      "psychological_trigger": "<specific trigger name>",
      "improvement_tip": "<one sentence on filming/editing>"
    }
  ]
}`;

    const fullPrompt = `${systemInstruction}

---

INPUT TO TRANSFORM: "${input}"

Return the JSON object now.`;

    const streamingResponse = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-lite',
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.8,
        topP: 0.95,
      },
    });

    // ==========================================
    // STEP 5: INCREMENT USAGE
    // ==========================================
    if (user && supabaseAdmin) {
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

    if (!user && guestId) {
      response.cookies.set('guest_id', guestId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 86400,
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
