import { NextResponse } from "next/server";

/*
  Bảo vệ đơn giản cho /api/tts và /api/elevenlabs:
  1. Chỉ nhận yêu cầu gửi từ chính trang của app (header Origin/Referer cùng tên miền).
     Chặn được trang web khác gọi ké; script tự viết vẫn có thể giả header nên cần thêm (2).
  2. Giới hạn số lượt gọi theo IP trong bộ nhớ của từng instance serverless (ước lượng, không tuyệt đối).
  3. Tuỳ chọn: đặt biến môi trường STUDIO_PASSWORD trên Vercel thì mọi lượt gọi phải gửi header
     x-studio-password đúng mật khẩu (app tự gửi mật khẩu bạn nhập ở ô Giọng đọc).
*/
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

function sameOrigin(req: Request): boolean {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return false;
  const src = req.headers.get("origin") || req.headers.get("referer");
  if (!src) return false;
  try { return new URL(src).host === host; } catch { return false; }
}

/** trả về Response lỗi nếu bị chặn, hoặc null nếu cho qua */
export function guardRequest(req: Request, limitPer10Min: number): Response | null {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Chỉ dùng được từ trang Kai 3D Studio." }, { status: 403 });
  const pw = process.env.STUDIO_PASSWORD;
  if (pw && req.headers.get("x-studio-password") !== pw) {
    return NextResponse.json({ error: "Sai hoặc thiếu mật khẩu studio (nhập ở ô Giọng đọc)." }, { status: 401 });
  }
  const ip = clientIp(req), now = Date.now();
  const list = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS);
  if (list.length >= limitPer10Min) {
    hits.set(ip, list);
    return NextResponse.json({ error: "Gọi quá nhiều lần, thử lại sau vài phút." }, { status: 429 });
  }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW_MS)) hits.delete(k);
  return null;
}
