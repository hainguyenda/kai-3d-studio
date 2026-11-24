/*
  Lớp kêu gọi tương tác vẽ đè lên mọi cảnh (beat.promo):
  - like_surprise: giữa video dài – nút 👍 bật ra, bàn tay bấm, nổ tim/sao, hộp quà mở ra câu "bất ngờ".
  - full_video:    cuối Short – thẻ "xem bản đầy đủ" + mũi tên chỉ xuống link video liên quan của Shorts.
  Toạ độ thiết kế: 1920x1080 (ngang) hoặc 1080x1920 (dọc), nhân với s để ra px thật.
*/
const FONT = '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", system-ui, sans-serif';

export interface BeatPromo {
  type: "like_surprise" | "full_video";
  /** dòng chữ lớn. like_surprise mặc định "高評価で サプライズ解禁！"; full_video mặc định "続きはフル動画で！" */
  text?: string;
  /** dòng chữ nhỏ (like_surprise: câu bất ngờ hiện ra khi hộp quà mở; full_video: tóm tắt nội dung bản dài) */
  sub?: string;
  /** giây trong beat bắt đầu hiện (mặc định 0.3) */
  at?: number;
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const backOut = (x: number) => { const c = clamp(x), k = 1.70158; return 1 + (k + 1) * Math.pow(c - 1, 3) + k * Math.pow(c - 1, 2); };
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
}

function wrap(g: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number, lh: number): number {
  let line = "", yy = y;
  for (const ch of Array.from(text)) {
    if (ch === "\n" || (g.measureText(line + ch).width > maxW && line)) { g.fillText(line, cx, yy); line = ch === "\n" ? "" : ch; yy += lh; }
    else line += ch;
  }
  if (line) g.fillText(line, cx, yy);
  return yy;
}

/** vẽ lớp promo. lt = giây trong beat */
export function drawPromo(g: CanvasRenderingContext2D, p: BeatPromo, lt: number, W: number, H: number, s: number, portrait: boolean): void {
  const t = lt - (p.at ?? 0.3);
  if (t <= 0) return;
  g.save(); g.scale(s, s);
  const DW = W / s, DH = H / s;
  if (p.type === "full_video") drawFullVideo(g, p, t, DW, DH, portrait);
  else drawLike(g, p, t, DW, DH, portrait);
  g.restore();
}

function drawLike(g: CanvasRenderingContext2D, p: BeatPromo, t: number, DW: number, DH: number, portrait: boolean): void {
  // thẻ nằm góc phải-dưới (ngang) hoặc giữa nửa trên (dọc), tránh phụ đề
  const cw = portrait ? 820 : 640, ch = portrait ? 520 : 400;
  const cx = portrait ? DW / 2 : DW - cw / 2 - 70, cy = portrait ? 860 : DH - ch / 2 - 250;
  const pop = backOut(t / 0.5);
  g.save(); g.translate(cx, cy); g.scale(pop, pop); g.globalAlpha = clamp(t * 3);
  // nền kính mờ
  g.shadowColor = "rgba(0,0,0,0.5)"; g.shadowBlur = 30;
  rr(g, -cw / 2, -ch / 2, cw, ch, 28); g.fillStyle = "rgba(18,22,30,0.88)"; g.fill();
  g.shadowBlur = 0; g.strokeStyle = "rgba(255,190,118,0.7)"; g.lineWidth = 3; g.stroke();
  g.textAlign = "center"; g.textBaseline = "middle";
  // tiêu đề
  g.fillStyle = "#ffbe76"; g.font = `900 ${portrait ? 50 : 40}px ${FONT}`;
  g.fillText(p.text ?? "高評価で サプライズ解禁！", 0, -ch / 2 + 62);

  // nút 👍: bàn tay bấm lúc 1.0s
  const press = 1.0, pressed = t > press;
  const bx = -cw * 0.2, by = 10, bw = portrait ? 260 : 210, bh = portrait ? 200 : 160;
  const squash = pressed ? 1 - 0.12 * Math.max(0, 1 - (t - press) / 0.18) : 1 + Math.sin(t * 6) * 0.03;
  g.save(); g.translate(bx, by); g.scale(squash, squash);
  rr(g, -bw / 2, -bh / 2, bw, bh, 26);
  g.fillStyle = pressed ? "#2563eb" : "rgba(255,255,255,0.1)"; g.fill();
  g.strokeStyle = pressed ? "#93c5fd" : "rgba(255,255,255,0.6)"; g.lineWidth = 4; g.stroke();
  g.font = `700 ${portrait ? 96 : 76}px ${FONT}`; g.fillStyle = "#fff"; g.fillText("👍", 0, -14);
  g.font = `800 ${portrait ? 30 : 24}px ${FONT}`; g.fillText(pressed ? "ありがとう！" : "高評価", 0, bh / 2 - 34);
  g.restore();
  // bàn tay trượt vào rồi bấm
  if (t < press + 0.6) {
    const k = easeOut(t / press), hx = bx + 160 * (1 - k) + 40, hy = by + 150 * (1 - k) + 50 + (pressed ? 0 : 0);
    g.globalAlpha = clamp((press + 0.6 - t) / 0.3) * clamp(t * 3);
    g.font = `700 ${portrait ? 90 : 72}px ${FONT}`; g.fillText("👆", hx, hy);
    g.globalAlpha = clamp(t * 3);
  }
  // nổ tim / sao + "+1"
  if (pressed) {
    const e = t - press;
    const items = ["❤️", "⭐", "💙", "✨", "❤️", "⭐", "💛", "✨"];
    items.forEach((it, i) => {
      const a = (i / items.length) * Math.PI * 2 + 0.3, d = easeOut(e / 0.7) * (portrait ? 190 : 150);
      g.globalAlpha = clamp(1 - (e - 0.4) / 0.6);
      g.font = `700 ${portrait ? 44 : 36}px ${FONT}`;
      g.fillText(it, bx + Math.cos(a) * d, by + Math.sin(a) * d);
    });
    g.globalAlpha = clamp(1 - (e - 0.6) / 0.5);
    g.fillStyle = "#93c5fd"; g.font = `900 ${portrait ? 54 : 44}px ${FONT}`;
    g.fillText("+1", bx + bw * 0.45, by - bh * 0.5 - easeOut(e / 0.8) * 60);
    g.globalAlpha = 1;
  }
  // hộp quà bên phải: rung rồi mở lúc 1.6s, câu bất ngờ hiện ra
  const gx = cw * 0.24, gy = 10, open = t > press + 0.6;
  const shake = !open && pressed ? Math.sin(t * 40) * 6 : 0;
  g.font = `700 ${portrait ? 120 : 96}px ${FONT}`;
  g.fillText(open ? "🎉" : "🎁", gx + shake, gy - (open ? easeOut((t - press - 0.6) / 0.4) * 20 : 0));
  if (open) {
    const e = t - press - 0.6;
    g.globalAlpha = clamp(e / 0.4);
    g.fillStyle = "#ffffff"; g.font = `800 ${portrait ? 36 : 28}px ${FONT}`;
    wrap(g, p.sub ?? "このあと、もっとびっくりな事実が…！", 0, ch / 2 - (portrait ? 96 : 76), cw - 80, portrait ? 46 : 36);
  } else {
    g.fillStyle = "rgba(255,255,255,0.6)"; g.font = `600 ${portrait ? 30 : 24}px ${FONT}`;
    g.fillText("押すと…？", gx, gy + (portrait ? 110 : 88));
  }
  g.restore();
}

function drawFullVideo(g: CanvasRenderingContext2D, p: BeatPromo, t: number, DW: number, DH: number, portrait: boolean): void {
  // phủ tối nhẹ để thẻ nổi bật
  g.fillStyle = `rgba(0,0,0,${0.35 * clamp(t * 2)})`; g.fillRect(0, 0, DW, DH);
  const cw = portrait ? 900 : 1100, ch = portrait ? 640 : 520;
  const cx = DW / 2, cy = portrait ? 820 : DH / 2 - 60;
  const pop = backOut(t / 0.55);
  g.save(); g.translate(cx, cy); g.scale(pop, pop); g.globalAlpha = clamp(t * 3);
  g.shadowColor = "rgba(0,0,0,0.55)"; g.shadowBlur = 36;
  rr(g, -cw / 2, -ch / 2, cw, ch, 32); g.fillStyle = "rgba(16,18,26,0.92)"; g.fill();
  g.shadowBlur = 0; g.strokeStyle = "#ff3b30"; g.lineWidth = 4; g.stroke();
  g.textAlign = "center"; g.textBaseline = "middle";
  // logo play đỏ, nhịp đập
  const beat = 1 + Math.sin(t * 5) * 0.05;
  g.save(); g.translate(0, -ch / 2 + 150); g.scale(beat, beat);
  rr(g, -110, -76, 220, 152, 40); g.fillStyle = "#ff0033"; g.fill();
  g.beginPath(); g.moveTo(-30, -42); g.lineTo(50, 0); g.lineTo(-30, 42); g.closePath(); g.fillStyle = "#fff"; g.fill();
  g.restore();
  g.fillStyle = "#ffffff"; g.font = `900 ${portrait ? 66 : 60}px ${FONT}`;
  g.fillText(p.text ?? "続きはフル動画で！", 0, -ch / 2 + 300);
  g.fillStyle = "#cbd5e1"; g.font = `700 ${portrait ? 36 : 32}px ${FONT}`;
  const endY = wrap(g, p.sub ?? "この先の展開を、たっぷり解説しています", 0, -ch / 2 + 380, cw - 110, portrait ? 48 : 42);
  g.fillStyle = "#ffbe76"; g.font = `800 ${portrait ? 40 : 34}px ${FONT}`;
  g.fillText(portrait ? "👇 下のリンクからどうぞ" : "▶ チャンネルでフル動画をチェック", 0, Math.max(endY + 80, ch / 2 - 60));
  g.restore();
  // dọc: mũi tên nhún nhảy chỉ xuống vùng link "video liên quan" của Shorts (trên tên kênh)
  if (portrait && t > 0.6) {
    const bob = Math.sin(t * 6) * 18;
    g.globalAlpha = clamp((t - 0.6) * 3);
    g.fillStyle = "#ffbe76";
    const ax = 300, ay = 1440 + bob;
    g.beginPath(); g.moveTo(ax - 46, ay); g.lineTo(ax + 46, ay); g.lineTo(ax, ay + 60); g.closePath(); g.fill();
    g.fillRect(ax - 16, ay - 70, 32, 72);
    g.globalAlpha = 1;
  }
}
