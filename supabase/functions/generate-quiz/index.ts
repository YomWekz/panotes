// Supabase Edge Function: generate-quiz
// Uses Groq LLaMA for AI quiz generation from note content
// Generates Multiple Choice + Identification questions

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const QUIZ_SYSTEM_PROMPT = `You are an expert educational quiz generator.
Given a student's note title and content, generate a quiz with exactly 6 questions:
- 3 Multiple Choice questions (4 options each, exactly one correct)
- 3 Identification questions (short, specific 1-3 word answers)

IMPORTANT RULES:
1. Questions must be directly based on the provided note content.
2. Multiple choice options should be plausible but clearly distinguishable.
3. Identification answers must be exact, concise (1-3 words maximum).
4. Return ONLY valid JSON, no markdown, no extra text.

Return this exact JSON structure:
{
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option A"
    },
    {
      "id": "q4",
      "type": "identification",
      "question": "Question text here?",
      "answer": "Short Answer"
    }
  ]
}`;

Deno.serve(async (req: Request) => {
  // ── CORS ───────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  try {
    const { note_id, title, subject, user_id } = await req.json();

    if (!note_id || !title || !subject || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: note_id, title, subject, user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (subject.length < 100) {
      return new Response(
        JSON.stringify({ error: "Note content is too short to generate a quiz (min 100 chars)." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!groqApiKey || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Call Groq LLaMA ──────────────────────────────────────────
    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: QUIZ_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Note Title: ${title}\n\nNote Content:\n${subject}`,
          },
        ],
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error("Groq error:", errText);
      return new Response(
        JSON.stringify({ error: `Groq API error: ${groqResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqResponse.json();
    const rawContent = groqData.choices?.[0]?.message?.content ?? "{}";

    let parsed: { questions?: unknown[] };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse Groq JSON:", rawContent);
      return new Response(
        JSON.stringify({ error: "Failed to parse quiz from AI response." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return new Response(
        JSON.stringify({ error: "AI returned no questions." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Assign deterministic IDs ─────────────────────────────────
    const questions = (parsed.questions as Record<string, unknown>[]).map((q, idx) => ({
      ...q,
      id: `q${idx + 1}_${note_id.slice(0, 8)}`,
    }));

    // ── Save to Supabase (upsert to avoid duplicates) ────────────
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete any existing quiz for this note first
    await supabase.from("quizzes").delete().eq("note_id", note_id);

    const { data: quizData, error: insertError } = await supabase
      .from("quizzes")
      .insert({ note_id, user_id, questions })
      .select()
      .single();

    if (insertError) {
      console.error("DB insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save quiz to database." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-quiz] Quiz created for note ${note_id}: ${questions.length} questions`);

    return new Response(JSON.stringify({ quiz: quizData, questions_count: questions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-quiz error:", err);
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
