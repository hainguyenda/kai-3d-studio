import type { FrameCtx } from "./types";
import { clamp, easeOut, formatDepth, formatHudTime, formatSpeed } from "./math";
import { drawBeatImageOverlay, drawVisualDiagram } from "./DiagramOverlay";
import type { ImageOverlayMode } from "./visualTypes";
import { drawIntroOutroOverlay } from "./introOutro";

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

/** Ghép khung hình 3D + HUD + phụ đề lên canvas xuất video (1920x1080 hoặc 1280x720) */
export class Compositor {
  constructor(public out: HTMLCanvasElement) {}

  private get g(): CanvasRenderingContext2D {
    const g = this.out.getContext("2d");
    if (!g) throw new Error("Canvas 2D không khả dụng");
    return g;
  }
  private get s(): number { return this.out.width / 1920; }
  private font(weight: number, px: number): string { return `${weight} ${Math.round(px * this.s)}px ${FONT}`; }

  draw(src: HTMLCanvasElement, ctx: FrameCtx, o: CompositeOptions): void {
    const g = this.g, W = this.out.width, H = this.out.height;
    g.drawImage(src, 0, 0, W, H);
    // ảnh beat & thẻ biểu đồ (vẽ theo hệ 1920x1080 rồi co theo độ phân giải xuất)
    const s = this.s;
    if (o.image) { g.save(); g.scale(s, s); drawBeatImageOverlay(g, o.image, o.imageMode ?? "fullscreen_kenburns", clamp(ctx.lp)); g.restore(); }
    for (const l of o.labels ?? []) this.callout(l.x * W, l.y * H, l.text, ctx.lt);
    if (ctx.beat.visual) { g.save(); g.scale(s, s); drawVisualDiagram(g, ctx.beat.visual, ctx.lt); g.restore(); }
    // beat Intro / Outro: ẩn HUD, vẽ thẻ kênh bên phải (trước phụ đề)
    if (o.showHud && !ctx.beat.brandOverlay && !ctx.beat.hideHud) this.hud(ctx, o.layerName);
    if (ctx.beat.caption) this.caption(ctx.beat.caption, ctx.lt);
    if (ctx.beat.brandOverlay) { g.save(); g.scale(s, s); drawIntroOutroOverlay(g, ctx.beat.brandOverlay, ctx.lt); g.restore(); }
    const note = ctx.beat.note?.trim();
    if (o.showSubs) this.subtitle(ctx.beat.ja_narration, ctx.lp, note ? 44 : 0);
    if (o.showSubs && note) this.note(note);
    if (o.fade > 0) { g.fillStyle = `rgba(0,0,0,${clamp(o.fade)})`; g.fillRect(0, 0, W, H); }
  }

  private hud(ctx: FrameCtx, layerName?: string): void {
    const g = this.g, s = this.s, x = 48 * s, y = 44 * s, w = 560 * s, h = 318 * s;
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
      g.fillStyle = "#9aa3ad"; g.font = this.font(500, 26); g.textAlign = "left"; g.fillText(label, x + 34 * s, ry);
      g.fillStyle = "#ffffff"; g.font = this.font(900, i === 0 ? 46 : 42); g.textAlign = "right"; g.fillText(value, x + w - 34 * s, ry);
    });
    if (layerName) {
      g.font = this.font(700, 22); const tw = g.measureText(layerName).width + 26 * s;
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
    g.font = this.font(700, 22); g.fillStyle = "#d6dbe1"; g.textAlign = "center";
    [["家", 0], ["中心", 0.5], ["反対側", 1]].forEach(([t, f]) => g.fillText(String(t), bx0 + (bx1 - bx0) * Number(f), by + 34 * s));
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

  /** dòng chú thích nhỏ dưới phụ đề */
  private note(text: string): void {
    const g = this.g, s = this.s, W = this.out.width, H = this.out.height;
    g.save(); g.font = this.font(800, 34); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    const y = H - 34 * s;
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
    const lines = this.wrap(cur.replace(/。$/, ""), 1680 * s), lh = 78 * s;
    lines.forEach((l, i) => {
      const ly = H - (74 + lift) * s - (lines.length - 1 - i) * lh;
      g.strokeStyle = "rgba(10,12,16,0.95)"; g.lineWidth = 15 * s; g.strokeText(l, W / 2, ly);
      g.fillStyle = "#ffffff"; g.fillText(l, W / 2, ly);
    });
    g.restore();
  }

  private caption(text: string, lt: number): void {
    const g = this.g, s = this.s, a = easeOut(lt / 0.6);
    g.save(); g.globalAlpha = a; g.font = this.font(900, 104); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    const y = (190 - 18 * (1 - a)) * s; // phía trên khung, tránh che mặt nhân vật
    g.strokeStyle = "rgba(0,0,0,0.85)"; g.lineWidth = 18 * s; g.strokeText(text, this.out.width / 2, y);
    g.fillStyle = "#ffd25a"; g.fillText(text, this.out.width / 2, y);
    g.restore();
  }

  /** chữ to cho thumbnail */
  thumbnailText(text: string): void {
    const g = this.g, s = this.s, W = this.out.width;
    g.save(); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, 0, W, this.out.height);
    g.font = this.font(900, 150); g.textAlign = "left"; g.textBaseline = "middle"; g.lineJoin = "round";
    const lines = this.wrap(text, 1700 * s), lh = 172 * s, y0 = this.out.height / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => {
      const y = y0 + i * lh; g.strokeStyle = "#000"; g.lineWidth = 30 * s; g.strokeText(l, 90 * s, y);
      g.fillStyle = i === lines.length - 1 ? "#ffd25a" : "#ffffff"; g.fillText(l, 90 * s, y);
    });
    g.restore();
  }
}
