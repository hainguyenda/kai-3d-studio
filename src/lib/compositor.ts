import type { FrameCtx } from "./types";
import { clamp, easeOut, formatDepth, formatHudTime, formatSpeed } from "./math";
import { drawBeatImageOverlay, drawVisualDiagram } from "./DiagramOverlay";
import type { ImageOverlayMode } from "./visualTypes";
import { drawIntroOutroOverlay } from "./introOutro";
import { drawPromo } from "./promo";
import { drawSfx } from "./gag";

const FONT = '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", system-ui, sans-serif';

export interface CompositeOptions {
  showHud: boolean;
  showSubs: boolean;
  /** 0..1 màn đen phủ (chuyển cảnh, mở/kết) */
  fade: number;
  layerName?: string;
  /** nhãn gắn vào điểm 3D (toạ độ 0..1 trên khung hình) */
  labels?: { x: number; y: number; text: string }[];
  /** ảnh tải lên cho beat */
  image?: HTMLImageElement;
  imageMode?: ImageOverlayMode;
}

/**
 * Khung dọc 9:16 (hệ toạ độ thiết kế 1080x1920). Vùng an toàn Shorts / Reels / TikTok:
 * trên ~140px (thanh tìm kiếm), dưới ~420px (tên kênh, mô tả), phải ~140px (nút like / bình luận).
 */
const P = {
  hud: { x: 40, y: 140, k: 0.8 },
  captionY: 470,
  /** vùng đặt thẻ biểu đồ / ảnh / thẻ kênh (nửa trên, dưới HUD) */
  card: { x: 110, y: 520, w: 860 },
  subBottom: 1395,
  subWidth: 940,
  noteY: 1462,
};

/** Ghép khung hình 3D + HUD + phụ đề lên canvas xuất video (16:9: 1920x1080 / 1280x720; 9:16: 1080x1920 / 720x1280) */
export class Compositor {
  /** true = khung dọc 9:16 (StudioEngine.setResolution đặt) */
  portrait = false;
  constructor(public out: HTMLCanvasElement) {}

  private get g(): CanvasRenderingContext2D {
    const g = this.out.getContext("2d");
    if (!g) throw new Error("Canvas 2D không khả dụng");
    return g;
  }
  /** px thiết kế → px thật (thiết kế: 1920 rộng khi ngang, 1080 rộng khi dọc) */
  private get s(): number { return this.out.width / (this.portrait ? 1080 : 1920); }

  /** khung dọc: vẽ 1 thẻ thiết kế cho khung 1920x1080 (góc trái-trên srcX,srcY, rộng srcW) vào vùng thẻ của khung dọc */
  private portraitCard(srcX: number, srcY: number, srcW: number, srcH: number, draw: () => void): void {
    const g = this.g, k = P.card.w / srcW;
    g.save(); g.scale(this.s, this.s); g.translate(P.card.x, P.card.y); g.scale(k, k); g.translate(-srcX, -srcY);
    draw(); g.restore();
    this.cardBottom = Math.max(this.cardBottom, P.card.y + srcH * k);
  }
  /** khung dọc: mép dưới thẻ (px thiết kế) trong khung đang vẽ, 0 = không có thẻ */
  private cardBottom = 0;
  private font(weight: number, px: number): string { return `${weight} ${Math.round(px * this.s)}px ${FONT}`; }

  draw(src: HTMLCanvasElement, ctx: FrameCtx, o: CompositeOptions): void {
    const g = this.g, W = this.out.width, H = this.out.height;
    g.drawImage(src, 0, 0, W, H);
    // ảnh beat & thẻ biểu đồ (vẽ theo hệ 1920x1080 rồi co theo độ phân giải xuất)
    const s = this.s;
    const P9 = this.portrait, mode = o.imageMode ?? "fullscreen_kenburns";
    this.cardBottom = 0;
    if (o.image) {
      if (P9 && mode === "pip_right") this.portraitCard(1920 - 960 - 90, 210, 960, 560, () => drawBeatImageOverlay(g, o.image!, mode, clamp(ctx.lp)));
      else { g.save(); g.scale(s, s); drawBeatImageOverlay(g, o.image, mode, clamp(ctx.lp), W / s, H / s); g.restore(); }
    }
    for (const l of o.labels ?? []) this.callout(l.x * W, l.y * H, l.text, ctx.lt);
    const visual = ctx.beat.visual;
    if (visual) {
      if (P9) {
        const full = visual.position === "full", cw = full ? 1460 : 940;
        this.portraitCard(full ? (1920 - cw) / 2 : 1920 - cw - 95, full ? 220 : 210, cw, full ? 600 : 560, () => drawVisualDiagram(g, visual, ctx.lt));
      } else { g.save(); g.scale(s, s); drawVisualDiagram(g, visual, ctx.lt); g.restore(); }
    }
    // beat Intro / Outro: ẩn HUD, vẽ thẻ kênh bên phải (trước phụ đề)
    if (o.showHud && !ctx.beat.brandOverlay && !ctx.beat.hideHud) this.hud(ctx, o.layerName);
    if (ctx.beat.caption) this.caption(ctx.beat.caption, ctx.lt);
    const brand = ctx.beat.brandOverlay;
    if (brand) {
      if (P9) this.portraitCard(1920 - 940 - 95, 215, 940, 520, () => drawIntroOutroOverlay(g, brand, ctx.lt));
      else { g.save(); g.scale(s, s); drawIntroOutroOverlay(g, brand, ctx.lt); g.restore(); }
    }
    // lớp kêu gọi: like_surprise (video dài) / full_video (cuối Short)
    if (ctx.beat.sfx?.length) drawSfx(g, ctx.beat.sfx, ctx.lt, W, H);
    if (ctx.beat.promo) drawPromo(g, ctx.beat.promo, ctx.lt, W, H, s, P9);
    const note = ctx.beat.note?.trim();
    if (o.showSubs) this.subtitle(ctx.beat.ja_narration, ctx.lp, note ? 44 : 0);
    if (o.showSubs && note) this.note(note);
    if (o.fade > 0) { g.fillStyle = `rgba(0,0,0,${clamp(o.fade)})`; g.fillRect(0, 0, W, H); }
  }

  private hud(ctx: FrameCtx, layerName?: string): void {
    // khung dọc: HUD thu nhỏ ở góc trên-trái, dưới thanh tìm kiếm của Shorts
    const P9 = this.portrait, s = this.s * (P9 ? P.hud.k : 1), F = (wt: number, px: number) => `${wt} ${Math.round(px * s)}px ${FONT}`;
    const g = this.g, x = (P9 ? P.hud.x : 48) * this.s, y = (P9 ? P.hud.y : 44) * this.s, w = 560 * s, h = 318 * s;
    g.save();
    g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = 24 * s;
    g.fillStyle = "rgba(20,25,32,0.82)"; g.beginPath(); g.roundRect(x, y, w, h, 16 * s); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = "#e67e22"; g.beginPath(); g.roundRect(x, y, 4 * s, h, [16 * s, 0, 0, 16 * s]); g.fill();
    const rows: [string, string][] = [
      ["家の時刻", formatHudTime(ctx.hudSeconds)],
      ["深さ", formatDepth(ctx.hud.depthKm)],
      ["速さ", formatSpeed(ctx.hud.speedKmh)],
    ];
    g.textBaseline = "middle";
    rows.forEach(([label, value], i) => {
      const ry = y + (58 + i * 64) * s;
      g.fillStyle = "#9aa3ad"; g.font = F(500, 26); g.textAlign = "left"; g.fillText(label, x + 34 * s, ry);
      g.fillStyle = "#ffffff"; g.font = F(900, i === 0 ? 46 : 42); g.textAlign = "right"; g.fillText(value, x + w - 34 * s, ry);
    });
    if (layerName) {
      g.font = F(700, 22); const tw = g.measureText(layerName).width + 26 * s;
      g.fillStyle = "#e67e22"; g.beginPath(); g.roundRect(x + 150 * s, y + 104 * s, tw, 34 * s, 8 * s); g.fill();
      g.fillStyle = "#fff"; g.textAlign = "left"; g.fillText(layerName, x + 163 * s, y + 122 * s);
    }
    // thanh tiến trình 家 → 中心 → 反対側
    const bx0 = x + 44 * s, bx1 = x + w - 44 * s, by = y + 246 * s, p = clamp(ctx.hud.progress);
    g.strokeStyle = "rgba(230,126,34,0.35)"; g.lineWidth = 4 * s; g.lineCap = "round";
    g.beginPath(); g.moveTo(bx0, by); g.lineTo(bx1, by); g.stroke();
    g.strokeStyle = "#e67e22"; g.beginPath(); g.moveTo(bx0, by); g.lineTo(bx0 + (bx1 - bx0) * p, by); g.stroke();
    for (let k = 0; k <= 8; k++) {
      const tx = bx0 + (bx1 - bx0) * (k / 8), big = k % 4 === 0;
      g.strokeStyle = big ? "#e67e22" : "rgba(230,126,34,0.55)"; g.lineWidth = (big ? 3 : 2) * s;
      g.beginPath(); g.moveTo(tx, by - (big ? 11 : 7) * s); g.lineTo(tx, by + (big ? 11 : 7) * s); g.stroke();
    }
    g.font = F(700, 22); g.fillStyle = "#d6dbe1"; g.textAlign = "center";
    const mk = ctx.beat.hudMarks ?? ["家", "中心", "反対側"];
    [[mk[0], 0], [mk[1], 0.5], [mk[2], 1]].forEach(([t, f]) => g.fillText(String(t), bx0 + (bx1 - bx0) * Number(f), by + 34 * s));
    const ix = bx0 + (bx1 - bx0) * p;
    g.shadowColor = "#ff9a3c"; g.shadowBlur = 18 * s;
    g.fillStyle = "#1a1f27"; g.strokeStyle = "#ff9a3c"; g.lineWidth = 4 * s;
    g.beginPath(); g.arc(ix, by, 11 * s, 0, Math.PI * 2); g.fill(); g.stroke();
    g.restore();
  }

  /**
   * Ngắt dòng kiểu tiếng Nhật: chia đều độ dài các dòng (không để 1–2 chữ lẻ loi ở dòng cuối),
   * ưu tiên ngắt sau dấu 、・ hoặc khoảng trắng, và không để dấu câu / chữ nhỏ đứng đầu dòng.
   */
  private wrapCache = new Map<string, string[]>();
  private wrap(text: string, maxW: number): string[] {
    const key = `${this.g.font}|${maxW}|${text}`, hit = this.wrapCache.get(key);
    if (hit) return hit;
    const lines = this.wrapLines(text, maxW);
    if (this.wrapCache.size > 200) this.wrapCache.clear();
    this.wrapCache.set(key, lines);
    return lines;
  }
  private wrapLines(text: string, maxW: number): string[] {
    const g = this.g, chars = [...text];
    if (!chars.length) return [];
    const width = (a: number, b: number) => g.measureText(chars.slice(a, b).join("")).width;
    if (width(0, chars.length) <= maxW) return [text];
    const NO_START = new Set([..."、。，．・：；！？!?,.)）」』】〉》ーっゃゅょゎァィゥェォッャュョヮぁぃぅぇぉヵヶ々〜～"]);
    const NO_END = new Set([..."(（「『【〈《"]);
    const PREFER = new Set([..."、，,・ 　"]);
    const lines: string[] = [];
    let start = 0;
    while (start < chars.length) {
      const restW = width(start, chars.length);
      if (restW <= maxW) { lines.push(chars.slice(start).join("")); break; }
      // số dòng còn lại cần có, rồi nhắm độ dài đều nhau
      const n = Math.ceil(restW / maxW), target = restW / n;
      let maxEnd = start + 1;
      while (maxEnd < chars.length && width(start, maxEnd + 1) <= maxW) maxEnd++;
      let best = -1, bestScore = Infinity;
      for (let e = start + 1; e <= maxEnd; e++) {
        if (e < chars.length && NO_START.has(chars[e])) continue;
        if (NO_END.has(chars[e - 1])) continue;
        const w = width(start, e);
        let score = Math.abs(w - target);
        if (PREFER.has(chars[e - 1])) score -= target * 0.25;
        if (score < bestScore) { bestScore = score; best = e; }
      }
      if (best < 0) best = maxEnd;
      lines.push(chars.slice(start, best).join("").trimEnd());
      start = best;
      while (start < chars.length && (chars[start] === " " || chars[start] === "　")) start++;
    }
    return lines;
  }

  /** hộp nhãn tối viền trắng phía trên điểm neo, có vạch nối */
  private callout(ax: number, ay: number, text: string, lt: number): void {
    const g = this.g, s = this.s, a = easeOut(lt / 0.5);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    g.font = this.font(900, 40); g.textAlign = "center"; g.textBaseline = "middle";
    const tw = g.measureText(text).width, bw = tw + 44 * s, bh = 66 * s, gap = 34 * s;
    const W = this.out.width, bx = clamp(ax - bw / 2, 16 * s, W - bw - 16 * s), by = Math.max(16 * s, ay - gap - bh);
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 2.5 * s;
    g.beginPath(); g.moveTo(ax, ay - 8 * s); g.lineTo(ax, by + bh); g.stroke();
    g.shadowColor = "rgba(0,0,0,0.4)"; g.shadowBlur = 16 * s;
    g.fillStyle = "rgba(28,32,40,0.9)"; g.beginPath(); g.roundRect(bx, by, bw, bh, 12 * s); g.fill();
    g.shadowBlur = 0; g.stroke();
    g.fillStyle = "#ffffff"; g.fillText(text, bx + bw / 2, by + bh / 2 + 2 * s);
    g.restore();
  }

  /** px thật: dòng cuối phụ đề vừa vẽ */
  private subEnd = 0;
  /** dòng chú thích nhỏ dưới phụ đề */
  private note(text: string): void {
    const g = this.g, s = this.s, W = this.out.width, H = this.out.height;
    g.save(); g.font = this.font(800, 34); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    const y = this.portrait ? (this.cardBottom > 0 ? this.subEnd + 80 * s : P.noteY * s) : H - 34 * s;
    if (this.portrait) g.font = this.font(800, 32);
    g.strokeStyle = "rgba(10,12,16,0.92)"; g.lineWidth = 10 * s; g.strokeText(text, W / 2, y);
    g.fillStyle = "#e9edf2"; g.fillText(text, W / 2, y);
    g.restore();
  }

  /** phụ đề: chia lời đọc thành các câu, hiện câu tương ứng tiến độ beat */
  private subtitle(text: string, lp: number, lift = 0): void {
    if (!text) return;
    const sentences = text.match(/[^。！？!?]+[。！？!?]*/g)?.map(x => x.trim()).filter(Boolean) ?? [text];
    const total = sentences.reduce((a, b) => a + b.length, 0);
    let acc = 0, cur = sentences[0];
    for (const sn of sentences) { if (lp * total <= acc + sn.length) { cur = sn; break; } acc += sn.length; cur = sn; }
    const g = this.g, s = this.s, W = this.out.width, H = this.out.height;
    g.save(); g.font = this.font(900, 58); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    const P9 = this.portrait;
    if (P9) g.font = this.font(900, 62);
    const lines = this.wrap(cur.replace(/。$/, ""), (P9 ? P.subWidth : 1680) * s), lh = (P9 ? 84 : 78) * s;
    // khung dọc có thẻ: phụ đề ngay dưới thẻ (nhân vật được dời xuống phần dưới khung)
    const below = P9 && this.cardBottom > 0, top = (this.cardBottom + 70) * s;
    const bottom = below ? top + (lines.length - 1) * lh : P9 ? P.subBottom * s - lift * s : H - (74 + lift) * s;
    this.subEnd = bottom;
    lines.forEach((l, i) => {
      const ly = bottom - (lines.length - 1 - i) * lh;
      g.strokeStyle = "rgba(10,12,16,0.95)"; g.lineWidth = 15 * s; g.strokeText(l, W / 2, ly);
      g.fillStyle = "#ffffff"; g.fillText(l, W / 2, ly);
    });
    g.restore();
  }

  private caption(text: string, lt: number): void {
    const g = this.g, s = this.s, a = easeOut(lt / 0.6);
    g.save(); g.globalAlpha = a; g.font = this.font(900, this.portrait ? 92 : 104); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    const y0 = this.portrait ? P.captionY : 190, y = (y0 - 18 * (1 - a)) * s; // phía trên khung, tránh che mặt nhân vật
    // khung dọc hẹp: chữ dài thì xuống dòng
    const lines = this.portrait ? this.wrap(text, 980 * s) : [text], lh = 108 * s;
    lines.forEach((l, i) => {
      const ly = y + i * lh;
      g.strokeStyle = "rgba(0,0,0,0.85)"; g.lineWidth = 18 * s; g.strokeText(l, this.out.width / 2, ly);
      g.fillStyle = "#ffd25a"; g.fillText(l, this.out.width / 2, ly);
    });
    g.restore();
  }

  /** chữ to cho thumbnail */
  thumbnailText(text: string): void {
    const g = this.g, s = this.s, W = this.out.width;
    g.save(); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, 0, W, this.out.height);
    const P9 = this.portrait, px = P9 ? 130 : 150, x = (P9 ? 70 : 90) * s;
    g.font = this.font(900, px); g.textAlign = "left"; g.textBaseline = "middle"; g.lineJoin = "round";
    const lines = this.wrap(text, (P9 ? 940 : 1700) * s), lh = (px + 22) * s;
    // khung dọc: chữ ở 1/3 trên (giữa màn hình hay bị nút Shorts che)
    const y0 = (P9 ? this.out.height * 0.36 : this.out.height / 2) - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => {
      const y = y0 + i * lh; g.strokeStyle = "#000"; g.lineWidth = 30 * s; g.strokeText(l, x, y);
      g.fillStyle = i === lines.length - 1 ? "#ffd25a" : "#ffffff"; g.fillText(l, x, y);
    });
    g.restore();
  }
}
