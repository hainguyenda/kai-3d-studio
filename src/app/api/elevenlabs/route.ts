import { NextResponse } from "next/server";
import { guardRequest } from "@/lib/server/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Chuyển tiếp yêu cầu tạo giọng tới ElevenLabs bằng API key của người dùng (không lưu trên server) */
export async function POST(req: Request): Promise<Response> {
  const blocked = guardRequest(req, 120);
  if (blocked) return blocked;
  let b: { apiKey?: string; voiceId?: string; text?: string; modelId?: string; stability?: number; speed?: number };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Body không phải JSON" }, { status: 400 }); }
  const apiKey = String(b.apiKey ?? "").trim(), voiceId = String(b.voiceId ?? "").trim(), text = String(b.text ?? "").trim();
  if (!apiKey || !voiceId || !text) return NextResponse.json({ error: "Thiếu API key, voice ID hoặc text" }, { status: 400 });
  if (!/^[A-Za-z0-9]+$/.test(voiceId)) return NextResponse.json({ error: "Voice ID không hợp lệ" }, { status: 400 });
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: b.modelId || "eleven_multilingual_v2",
      voice_settings: { stability: b.stability ?? 0.5, similarity_boost: 0.75, speed: Math.min(1.2, Math.max(0.7, Number(b.speed) || 1)) },
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    return NextResponse.json({ error: `ElevenLabs báo lỗi ${r.status}: ${detail.slice(0, 300)}` }, { status: r.status });
  }
  return new Response(await r.arrayBuffer(), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
