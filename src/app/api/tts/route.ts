import { NextResponse } from "next/server";
import { guardRequest } from "@/lib/server/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

const VOICES = new Set(["ja-JP-KeitaNeural", "ja-JP-NanamiNeural"]);

type Readable = { on(ev: string, cb: (x?: unknown) => void): void };

/** Giọng Nhật miễn phí qua dịch vụ đọc của Microsoft Edge (msedge-tts). Không cần API key. */
export async function POST(req: Request): Promise<Response> {
  const blocked = guardRequest(req, 120);
  if (blocked) return blocked;
  let body: { text?: string; voice?: string; rate?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body không phải JSON" }, { status: 400 }); }
  const text = String(body.text ?? "").trim();
  const voice = VOICES.has(String(body.voice)) ? String(body.voice) : "ja-JP-KeitaNeural";
  const rate = Math.min(1.5, Math.max(0.5, Number(body.rate) || 1));
  if (!text) return NextResponse.json({ error: "Thiếu text" }, { status: 400 });
  if (text.length > 3000) return NextResponse.json({ error: "Text quá dài (tối đa 3000 ký tự)" }, { status: 400 });
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("msedge-tts");
    const tts = new mod.MsEdgeTTS();
    await tts.setMetadata(voice, mod.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const pct = Math.round((rate - 1) * 100), rateStr = `${pct >= 0 ? "+" : ""}${pct}%`;
    const res = tts.toStream(text, { rate: rateStr });
    const stream: Readable = res && res.audioStream ? res.audioStream : res;
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Hết thời gian chờ dịch vụ giọng Edge")), 45000);
      stream.on("data", (c?: unknown) => { if (c) chunks.push(Buffer.from(c as Uint8Array)); });
      stream.on("end", () => { clearTimeout(timer); resolve(); });
      stream.on("close", () => { clearTimeout(timer); resolve(); });
      stream.on("error", (e?: unknown) => { clearTimeout(timer); reject(e instanceof Error ? e : new Error(String(e))); });
    });
    try { tts.close?.(); } catch { /* bỏ qua */ }
    const audio = Buffer.concat(chunks);
    if (audio.length < 1000) throw new Error("Dịch vụ giọng Edge trả về âm thanh rỗng");
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Không tạo được giọng Edge: ${msg}` }, { status: 502 });
  }
}
