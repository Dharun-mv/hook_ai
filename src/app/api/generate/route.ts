import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GUEST_LIMIT = 5;

// Platform-specific prompt configurations
const PLATFORM_CONFIG: Record<string, { name: string; maxLen: number; tone: string; tips: string }> = {
  tiktok: {
    name: 'TikTok',
    maxLen: 100,
    tone: 'casual, Gen Z, punchy, trend-aware',
    tips: 'Use trending sound references, quick cuts, text overlays'
  },
  x: {
    name: 'X (Twitter)',
    maxLen: 280,
    tone: 'concise, witty, thread-friendly',
    tips: 'Hook must work as a standalone tweet, consider thread continuation'
  },
  linkedin: {
    name: 'LinkedIn',
    maxLen: 150,
    tone: 'professional, insightful, career-focused',
    tips: 'Lead with business value, use professional credibility markers'
  },
  instagram: {
    name: 'Instagram',
    maxLen: 120,
    tone: 'visual, lifestyle, aspirational',
    tips: 'Reference Reels format, visual storytelling, aesthetic appeal'
  },
  youtube: {
    name: 'YouTube',
    maxLen: 100,
    tone: 'high CTR, curiosity gaps, extreme specificity',
    tips: 'Focus on high CTR, curiosity gaps, and extreme specificity (e.g., I tried X for 30 days so you don\'t have to)'
  }
};

// Fallback examples when trending_benchmarks table is empty
const FALLBACK_EXAMPLES = [
  {
    hook_text: "Stop trying to go viral. I gained 100K followers in 30 days by doing the exact opposite.",
    hook_type: "anti-trend",
    psychological_trigger: "Negative Constraint + Curiosity Gap",
    virality_score: 92,
    reasoning: "Challenges conventional wisdom while promising a counterintuitive secret",
    platform_fit: "tiktok"
  },
  {
    hook_text: "I analyzed 10,000 viral videos. Here are the exact 3 seconds that determine if people watch or scroll.",
    hook_type: "specificity",
    psychological_trigger: "Social Proof + Specificity",
    virality_score: 88,
    reasoning: "Uses exact numbers to establish authority and creates curiosity about the '3 seconds'",
    platform_fit: "linkedin"
  },
  {
    hook_text: "If your hook doesn't pass the 2-second test, your video is already dead. Here's the fix.",
    hook_type: "if-then",
    psychological_trigger: "Urgency + Pattern Interrupt",
    virality_score: 85,
    reasoning: "Creates urgency with time constraint and promises immediate solution",
    platform_fit: "tiktok"
  }
];

async function fetchTrendingExamples() {
  if (!supabaseAdmin) return FALLBACK_EXAMPLES;

  try {
    const { data, error } = await supabaseAdmin
      .from('trending_benchmarks')
      .select('hook_text, hook_type, psychological_trigger, virality_score, reasoning, platform_fit')
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

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === '') {
      throw new Error('Missing GEMINI_API_KEY in environment variables');
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const body = await req.json();
    const input = body.input;
    const platform = body.platform || 'tiktok';

    // Auth check
    const authHeader = req.headers.get('authorization');
    let user: any = null;
    let userPlan = 'free';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: authData } = await supabase.auth.getUser(token);
      if (authData?.user) {
        user = authData.user;

        // Fetch user's plan
        if (supabaseAdmin) {
          const { data: usageData } = await supabaseAdmin
            .from('user_usage')
            .select('plan')
            .eq('user_id', user.id)
            .single();

          if (usageData?.plan) {
            userPlan = usageData.plan;
          }
        }
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
   - Virality Score: ${ex.virality_score || 'N/A'}
   - Reasoning: ${ex.reasoning || 'N/A'}
   - Platform Fit: ${ex.platform_fit || 'N/A'}`
    ).join('\n\n');

    const platformConfig = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.tiktok;

    // System instruction for Gemini - Enhanced for Pro features
    const systemInstruction = `You are the HOOK ARCHITECT PRO - a Viral Growth Expert specializing in 2026 short-form video content.

CURRENT PLATFORM: ${platformConfig.name.toUpperCase()}
- Target length: Under ${platformConfig.maxLen} characters
- Tone: ${platformConfig.tone}
- Production tips: ${platformConfig.tips}

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

REASONING REQUIREMENTS:
Provide a 1-sentence psychological breakdown explaining WHY this hook will work.
Example: "Uses negative constraint to create curiosity about the counterintuitive method"

PLATFORM FIT ANALYSIS:
Recommend which platform (TikTok, X, LinkedIn, Instagram) this hook is BEST suited for.
Consider: length, tone, audience expectations, format constraints

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
      "content": "the actual hook text",
      "score": number (1-100),
      "reasoning": "1-sentence psychological breakdown",
      "platform_fit": "tiktok | x | linkedin | instagram | youtube",
      "hook_type": "anti-trend | specificity | if-then",
      "psychological_trigger": "specific trigger name",
      "improvement_tip": "one sentence on filming/editing"
    }
  ]
}

You are a raw data generator. Return ONLY a JSON array. No markdown, no backticks, no explanations.

${userPlan === 'pro' ?
'PRO MODE: Use higher creativity (temperature 0.9), combine multiple psychological triggers, and provide more detailed reasoning.' :
'STANDARD MODE: Use balanced creativity (temperature 0.8) with clear, proven hook structures.'}`;

    let userPrompt = `Transform this input into 3 viral hooks optimized for ${platformConfig.name}:

INPUT: "${input}"

Return the JSON array now.`;

    if (platform === 'youtube') {
      userPrompt += '\n\nRespond ONLY with a raw JSON array. Do not include any text before or after the JSON.';
    }

    const fullPrompt = `${systemInstruction}\n\n---\n\n${userPrompt}`;

    let parsedResponse: any;
    let fullResponse = '';

    try {
      const streamingResponse = await ai.models.generateContentStream({
        model: 'gemini-1.5-flash',
        contents: fullPrompt,
        config: {
          responseMimeType: 'application/json',
          temperature: userPlan === 'pro' ? 0.9 : 0.8,
          topP: userPlan === 'pro' ? 0.98 : 0.95,
        },
      });

      // Collect the full response
      for await (const chunk of streamingResponse) {
        if (chunk.text) {
          fullResponse += chunk.text;
        }
      }

      console.log("RAW AI RESPONSE:", fullResponse);

      const startIdx = fullResponse.indexOf('[');
      const endIdx = fullResponse.lastIndexOf(']') + 1;
      
      if (startIdx !== -1 && endIdx !== 0 && startIdx < endIdx) {
        const jsonStr = fullResponse.substring(startIdx, endIdx);
        parsedResponse = JSON.parse(jsonStr);
      } else {
        throw new Error('No array brackets found in response');
      }

    } catch (parseError) {
      console.error('JSON Parse Failed. Raw Response:', fullResponse);
      // Emergency Fallback: split raw text and construct manual objects
      const lines = fullResponse.split('\n').filter(line => line.trim().length > 10);
      parsedResponse = [];
      for (let i = 0; i < 3; i++) {
        parsedResponse.push({
          content: lines[i] ? lines[i].trim() : `Fallback Hook ${i + 1}: ${input.substring(0, 50)}...`,
          score: 50,
          reasoning: 'Parsing error fallback',
          platform_fit: platform === 'youtube' ? 'youtube' : platform,
          hook_type: 'anti-trend',
          psychological_trigger: 'Curiosity Gap',
          improvement_tip: 'Review and refine this hook manually'
        });
      }
    }

    // Validate and normalize hooks
    let baseHooks = [];
    if (Array.isArray(parsedResponse)) {
      baseHooks = parsedResponse;
    } else if (parsedResponse?.hooks && Array.isArray(parsedResponse.hooks)) {
      baseHooks = parsedResponse.hooks;
    }

    const normalizedHooks = baseHooks.map((hook: any, index: number) => {
      const baseHook = {
        content: hook.content || `Hook ${index + 1}: ${input}`,
        hook_type: (['anti-trend', 'specificity', 'if-then'].includes(hook.hook_type) ? hook.hook_type : 'anti-trend') as 'anti-trend' | 'specificity' | 'if-then',
      };

      if (userPlan === 'pro') {
        return {
          ...baseHook,
          score: Math.min(100, Math.max(1, parseInt(hook.score) || 50)),
          reasoning: hook.reasoning || 'Creates curiosity through unexpected framing',
          platform_fit: (['tiktok', 'x', 'linkedin', 'instagram', 'youtube'].includes(hook.platform_fit) ? hook.platform_fit : platform) as 'tiktok' | 'x' | 'linkedin' | 'instagram' | 'youtube',
          psychological_trigger: hook.psychological_trigger || 'Curiosity Gap',
          improvement_tip: hook.improvement_tip || platformConfig.tips
        };
      }

      return {
        ...baseHook,
        // Default standard values for free users
        platform_fit: platform as 'tiktok' | 'x' | 'linkedin' | 'instagram' | 'youtube',
        score: 50, // Standard neutral score
      };
    });

    // Save hooks to database immediately
    const savedHooks = [];
    if (user && supabaseAdmin) {
      for (const hook of normalizedHooks) {
        try {
          const { data, error } = await supabaseAdmin
            .from('saved_hooks')
            .insert({
              user_id: user.id,
              hook_text: hook.content,
              hook_type: hook.hook_type,
              virality_score: hook.score,
              psychological_trigger: hook.psychological_trigger,
              improvement_tip: hook.improvement_tip,
              platform_fit: hook.platform_fit,
              reasoning: hook.reasoning,
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
          updated_at: new Date().toISOString(),
          plan: userPlan
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
      { error: 'AI is overthinking. Please try again!', hooks: [] },
      { status: 500 }
    );
  }
}
