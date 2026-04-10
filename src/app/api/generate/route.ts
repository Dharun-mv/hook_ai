import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GUEST_LIMIT = 5;

// Fallback examples when trending_benchmarks table is empty
const FALLBACK_EXAMPLES = [
  {
    hook_text: "Stop trying to go viral. I gained 100K followers in 30 days by doing the exact opposite.",
    hook_type: "anti-trend",
    psychological_trigger: "Negative Constraint + Curiosity Gap",
    virality_score: 92
  },
  {
    hook_text: "I analyzed 10,000 viral videos. Here are the exact 3 seconds that determine if people watch or scroll.",
    hook_type: "specificity",
    psychological_trigger: "Social Proof + Specificity",
    virality_score: 88
  },
  {
    hook_text: "If your hook doesn't pass the 2-second test, your video is already dead. Here's the fix.",
    hook_type: "if-then",
    psychological_trigger: "Urgency + Pattern Interrupt",
    virality_score: 85
  }
];

async function fetchTrendingExamples() {
  if (!supabaseAdmin) return FALLBACK_EXAMPLES;

  try {
    const { data, error } = await supabaseAdmin
      .from('trending_benchmarks')
      .select('hook_text, hook_type, psychological_trigger, virality_score')
      .order('view_count', { ascending: false })
      .limit(3);

    if (error || !data || data.length === 0) {
      console.log('No trending examples found, using fallback');
      return FALLBACK_EXAMPLES;
    }

    return data;
  } catch (err) {
    console.error('Error fetching trending examples:', err);
    return FALLBACK_EXAMPLES;
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

    // Auth check
    const authHeader = req.headers.get('authorization');
    let user: any = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: authData } = await supabase.auth.getUser(token);
      if (authData?.user) {
        user = authData.user;
      }
    }

    // Guest limit check
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
          return NextResponse.json({ error: 'Sign in to continue' }, { status: 403 });
        }
      }
    }

    // Fetch trending examples (or fallback)
    const examples = await fetchTrendingExamples();

    const fewShotExamples = examples.map((ex, i) =>
      `Example ${i + 1}:
   - Hook: "${ex.hook_text}"
   - Type: ${ex.hook_type}
   - Trigger: ${ex.psychological_trigger || 'N/A'}
   - Virality Score: ${ex.virality_score || 'N/A'}`
    ).join('\n\n');

    // System instruction for Gemini
    const systemInstruction = `You are the HOOK ARCHITECT - a Viral Growth Expert specializing in 2026 short-form video content (TikTok, Instagram Reels, YouTube Shorts).

YOUR MISSION:
Transform any input text into 3 psychologically-optimized viral hooks that stop scrolls and drive engagement.

2026 VIRAL HOOK FRAMEWORKS:
1. ANTI-TREND: Challenge popular advice, create controversy, go against the grain
2. SPECIFICITY: Use exact numbers, data, timestamps - specificity creates credibility
3. IF/THEN: Conditional promise with clear cause-effect relationship

PSYCHOLOGICAL TRIGGERS TO USE:
- Curiosity Gap: Withhold key information to create tension
- Negative Constraint: What NOT to do (performs 2x better than positive)
- Social Proof: Implied popularity or authority
- Urgency/Scarcity: Time-sensitive framing
- Pattern Interrupt: Break expected narrative
- Identity Appeal: Speak to who they want to become

VIRALITY SCORE GUIDELINES (1-100):
- 80-100: Elite - combines 2+ triggers, specific numbers, emotionally charged
- 50-79: Solid - clear hook with one strong psychological trigger
- Below 50: Weak - generic, no clear trigger, boring

IMPROVEMENT TIPS MUST BE ACTIONABLE:
- Camera direction (zoom, cut, angle changes)
- Editing technique (text overlay, sound effect, timing)
- Delivery note (pace, pause, emphasis)

FEW-SHOT EXAMPLES FROM TRENDING BENCHMARKS:
${fewShotExamples}

OUTPUT FORMAT - RETURN ONLY VALID JSON:
{
  "hooks": [
    {
      "hook_text": "the actual hook text",
      "hook_type": "anti-trend | specificity | if-then",
      "virality_score": number (1-100),
      "psychological_trigger": "specific trigger name",
      "improvement_tip": "one sentence on filming/editing"
    }
  ]
}

CRITICAL: Return ONLY the JSON object. No markdown. No commentary.`;

    const userPrompt = `Transform this input into 3 viral hooks:

INPUT: "${input}"

Return the JSON object now.`;

    const fullPrompt = `${systemInstruction}\n\n---\n\n${userPrompt}`;

    const streamingResponse = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-lite',
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.8,
        topP: 0.95,
      },
    });

    // Collect the full response
    let fullResponse = '';
    for await (const chunk of streamingResponse) {
      if (chunk.text) {
        fullResponse += chunk.text;
      }
    }

    // Parse JSON with error handling
    let parsedResponse;
    try {
      // Clean up response - remove markdown code blocks if present
      let cleanJson = fullResponse.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      parsedResponse = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Fallback: create basic hooks from the response
      parsedResponse = {
        hooks: [
          {
            hook_text: fullResponse.trim() || `Transform this: ${input}`,
            hook_type: 'anti-trend',
            virality_score: 50,
            psychological_trigger: 'Fallback - parsing failed',
            improvement_tip: 'Review and refine this hook manually'
          }
        ]
      };
    }

    // Validate and normalize hooks
    const hooks = Array.isArray(parsedResponse?.hooks) ? parsedResponse.hooks : [];
    const normalizedHooks = hooks.map((hook: any, index: number) => ({
      hook_text: hook.hook_text || `Hook ${index + 1}: ${input}`,
      hook_type: (['anti-trend', 'specificity', 'if-then'].includes(hook.hook_type) ? hook.hook_type : 'anti-trend') as 'anti-trend' | 'specificity' | 'if-then',
      virality_score: Math.min(100, Math.max(1, parseInt(hook.virality_score) || 50)),
      psychological_trigger: hook.psychological_trigger || 'Curiosity Gap',
      improvement_tip: hook.improvement_tip || 'Focus on clear delivery and good lighting'
    }));

    // Save hooks to database immediately
    const savedHooks = [];
    if (user && supabaseAdmin) {
      for (const hook of normalizedHooks) {
        try {
          const { data, error } = await supabaseAdmin
            .from('saved_hooks')
            .insert({
              user_id: user.id,
              hook_text: hook.hook_text,
              hook_type: hook.hook_type,
              virality_score: hook.virality_score,
              psychological_trigger: hook.psychological_trigger,
              improvement_tip: hook.improvement_tip,
              status: 'draft',
              actual_views: 0,
              original_text: input,
              updated_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (data && !error) {
            savedHooks.push({ id: data.id, ...hook });
          }
        } catch (saveError) {
          console.error('Error saving hook:', saveError);
          savedHooks.push({ id: null, ...hook });
        }
      }
    }

    // Increment usage
    if (user && supabaseAdmin) {
      Promise.allSettled([
        supabaseAdmin.from('user_usage').upsert({
          user_id: user.id,
          count: 1,
          last_reset: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' }),
        supabaseAdmin.from('usage_logs').insert({ user_id: user.id, input_text: input })
      ]).catch(() => {});
    } else if (supabaseAdmin && guestId) {
      Promise.allSettled([
        supabaseAdmin.from('guest_usage').upsert({
          guest_id: guestId,
          count: 1,
          updated_at: new Date().toISOString()
        }, { onConflict: 'guest_id' })
      ]).catch(() => {});
    }

    // Return hooks with IDs if saved
    const responseHooks = savedHooks.length > 0
      ? savedHooks
      : normalizedHooks.map((hook: any) => ({ id: null, ...hook }));

    const response = NextResponse.json({ hooks: responseHooks });

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
      { error: 'Server Maintenance', hooks: [] },
      { status: 500 }
    );
  }
}
