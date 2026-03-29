import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { GoogleGenAI } = await import('@google/genai');

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Missing GEMINI_API_KEY');
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const body = await req.json();
    const input = body.input;

    console.log("API ROUTE TRIGGERED");

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

    // Generate with Gemini
    const streamingResponse = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

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
