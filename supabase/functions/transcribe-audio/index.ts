// Supabase Edge Function: transcribe-audio
// Uses Groq Whisper API for Speech-to-Text
// Audio file is NOT stored — only the transcription is returned

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

Deno.serve(async (req: Request) => {
  // ── CORS Headers ───────────────────────────────────────────────
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
    const { audio_base64 } = await req.json();

    if (!audio_base64) {
      return new Response(JSON.stringify({ error: "No audio data provided." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: "Groq API key not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert base64 to binary
    const binaryStr = atob(audio_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Build multipart form — Groq Whisper expects an audio file
    const formData = new FormData();
    const audioBlob = new Blob([bytes], { type: "audio/m4a" });
    formData.append("file", audioBlob, "recording.m4a");
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("response_format", "json");
    formData.append("language", "en");

    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: formData,
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error("Groq error:", errText);
      return new Response(
        JSON.stringify({ error: `Groq API error: ${groqResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await groqResponse.json();
    const transcribedText = result.text?.trim() ?? "";

    return new Response(JSON.stringify({ text: transcribedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("transcribe-audio error:", err);
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
