import { NextRequest, NextResponse } from "next/server";

interface TtsRequestBody {
  text?: string;
  examinerId?: string;
}

const DEFAULT_FEMALE_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MALE_VOICE_ID = "pNInz6obpgDQGcFmaJgB";

const VOICE_BY_EXAMINER: Record<string, string> = {
  jessica: "21m00Tcm4TlvDq8ikWAM",
  arthur: "N2lVS1w4EtoT3dr4eOWO",
  david: "ErXwobaYiN019PkySvjV",
  sarah: "zrHiDhphv9ZnVXBqCLjz",
  raj: DEFAULT_MALE_VOICE_ID,
  kevin: DEFAULT_MALE_VOICE_ID,
};

function getVoiceId(examinerId: string) {
  const mappedVoiceId = VOICE_BY_EXAMINER[examinerId];
  return mappedVoiceId?.trim() || DEFAULT_FEMALE_VOICE_ID;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();

  console.log("Current API Key:", apiKey ? "EXISTS" : "MISSING");

  if (!apiKey) {
    return NextResponse.json({ error: "Missing API Key" }, { status: 401 });
  }

  let body: TtsRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();
  const examinerId = body.examinerId?.trim().toLowerCase();

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  if (!examinerId) {
    return NextResponse.json({ error: "examinerId is required" }, { status: 400 });
  }

  const voiceId = getVoiceId(examinerId);
  console.log("Requesting Voice ID:", voiceId);

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
        }),
      }
    );

    console.log("ElevenLabs Response Status:", response.status);

    if (!response.ok) {
      const errorDetail = await response.text();
      console.error("CRITICAL: ElevenLabs API Failed!", errorDetail);
      return new Response(JSON.stringify({ error: errorDetail }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[tts] request failed:", error);
    return NextResponse.json({ error: "TTS request failed" }, { status: 500 });
  }
}
