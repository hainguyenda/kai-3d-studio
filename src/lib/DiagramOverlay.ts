import { BeatVisual, ImageOverlayMode } from './visualTypes';

const FONT = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif';

function easeOutCubic(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return 1 - Math.pow(1 - c, 3);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---- chữ tự xuống dòng / tự thu nhỏ để luôn nằm trong ô ---- */
// không để các ký tự này đứng đầu dòng (、。）」…, chữ nhỏ っゃゅょ, dấu kéo dài ー)
const NO_LINE_START = /^[、。，．・ー）」』】〕！？!?…ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ℃%]/;
function tokens(text: string): string[] {
  // số / chữ Latin đi liền (1,670 · km/h · 100℃) không bị cắt giữa chừng
  return text.match(/[A-Za-z0-9.,%℃°+\-/:~#]+|[\s\S]/gu) ?? [];
}
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const tk of tokens(text)) {
    if (cur && ctx.measureText(cur + tk).width > maxW && !NO_LINE_START.test(tk)) { lines.push(cur); cur = tk.trimStart(); }
    else cur += tk;
  }
  if (cur) lines.push(cur);
  return lines;
}
interface Fit { lines: string[]; px: number; lh: number }
/** chọn cỡ chữ lớn nhất (≤ px) sao cho tối đa maxLines dòng và mỗi dòng ≤ maxW */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, weight: number, maxLines: number, minPx = 22): Fit {
  let lines: string[] = [];
  for (; ; px -= 2) {
    ctx.font = `${weight} ${px}px ${FONT}`;
    lines = wrapLines(ctx, text, maxW);
    const tooWide = lines.some(l => ctx.measureText(l).width > maxW);
    if ((lines.length <= maxLines && !tooWide) || px <= minPx) break;
  }
  return { lines, px, lh: Math.round(px * 1.25) };
}
/** vẽ các dòng, căn giữa theo chiều dọc quanh centerY (textAlign giữ nguyên như ctx đang đặt) */
function drawFit(ctx: CanvasRenderingContext2D, f: Fit, x: number, centerY: number) {
  const prev = ctx.textBaseline;
  ctx.textBaseline = 'middle';
  const top = centerY - ((f.lines.length - 1) * f.lh) / 2;
  f.lines.forEach((l, i) => ctx.fillText(l, x, top + i * f.lh));
  ctx.textBaseline = prev;
}

/** Vẽ ảnh AI đính kèm trên beat (Ken Burns Zoom chậm) */
export function drawBeatImageOverlay(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  mode: ImageOverlayMode,
  beatProgress: number, // 0 -> 1
  canvasW = 1920,
  canvasH = 1080
) {
  if (!img.complete || img.naturalWidth === 0) return;
  const zoom = 1 + 0.08 * beatProgress; // Zoom mượt 8%

  const drawCover = (dx: number, dy: number, dw: number, dh: number) => {
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = dw / dh;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    let sx = 0;
    let sy = 0;
    if (imgRatio > boxRatio) {
      sw = sh * boxRatio;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = sw / boxRatio;
      sy = (img.naturalHeight - sh) / 2;
    }
    const zw = sw / zoom;
    const zh = sh / zoom;
    const zx = sx + (sw - zw) / 2;
    const zy = sy + (sh - zh) / 2;
    ctx.drawImage(img, zx, zy, zw, zh, dx, dy, dw, dh);
  };

  ctx.save();
  if (mode === 'fullscreen_kenburns') {
    drawCover(0, 0, canvasW, canvasH);
    // Lớp phủ tối nhẹ dưới đáy để phụ đề luôn dễ đọc
    const grad = ctx.createLinearGradient(0, canvasH * 0.72, 0, canvasH);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, canvasH * 0.72, canvasW, canvasH * 0.28);
  } else {
    // Picture-in-Picture bo góc bên phải (khớp bố cục Hình mẫu 1)
    const pw = 960;
    const ph = 560;
    const px = canvasW - pw - 90;
    const py = 210;
    const alpha = easeOutCubic(beatProgress * 3.5);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 32;
    drawRoundedRect(ctx, px, py, pw, ph, 26);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    drawCover(px, py, pw, ph);
    ctx.strokeStyle = 'rgba(230, 126, 34, 0.85)';
    ctx.lineWidth = 4;
    drawRoundedRect(ctx, px + 2, py + 2, pw - 4, ph - 4, 24);
    ctx.stroke();
  }
  ctx.restore();
}

/** Vẽ thẻ Biểu đồ / Infographic động */
export function drawVisualDiagram(
  ctx: CanvasRenderingContext2D,
  visual: BeatVisual,
  beatElapsedSec: number,
  canvasW = 1920,
  canvasH = 1080
) {
  const anim = easeOutCubic(Math.min(1, beatElapsedSec / 1.1));
  const isFull = visual.position === 'full';
  const cardW = isFull ? 1460 : 940;
  const cardH = isFull ? 600 : 560;
  const cardX = isFull ? (canvasW - cardW) / 2 : canvasW - cardW - 95;
  const cardY = isFull ? 220 : 210 + (1 - anim) * 24;

  ctx.save();
  ctx.globalAlpha = Math.min(1, anim * 1.4);

  // Nền kính mờ xanh đậm + viền cam trên cùng (khớp Hình mẫu 1)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 22);
  ctx.fillStyle = 'rgba(18, 25, 38, 0.88)';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Thanh nhấn cam phát sáng trên mép đỉnh card
  ctx.fillStyle = '#e67e22';
  drawRoundedRect(ctx, cardX + 2, cardY, cardW - 4, 8, 4);
  ctx.fill();

  // Tiêu đề card
  const title = visual.title ?? '';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  drawFit(ctx, fitText(ctx, title, cardW - 90, 44, 700, 1, 26), cardX + cardW / 2, cardY + 70);

  // Đường kẻ phân cách mờ dưới tiêu đề
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.moveTo(cardX + 44, cardY + 114);
  ctx.lineTo(cardX + cardW - 44, cardY + 114);
  ctx.stroke();

  const bodyX = cardX + 60;
  const bodyY = cardY + 150;
  const bodyW = cardW - 120;
  const bodyH = cardH - 190;

  // --- 1. BAR COMPARE ---
  if (visual.type === 'bar_compare' || visual.type === 'depth_scale') {
    const items = visual.items ?? [];
    const maxVal = Math.max(1, ...items.map(i => i.value));
    const rowH = Math.min(130, bodyH / Math.max(1, items.length));

    items.forEach((item, idx) => {
      const y = bodyY + idx * rowH;
      const curVal = Math.round(item.value * anim);
      const barRatio = (item.value / maxVal) * anim;
      const barColor = item.color ?? (idx === items.length - 1 ? '#e67e22' : '#4ea8de');

      ctx.textAlign = 'left';
      ctx.fillStyle = '#f1f5f9';
      const lbl = fitText(ctx, `${item.label}   ${curVal.toLocaleString("en-US")} ${item.unit ?? ''}`, bodyW, 32, 700, 1, 20);
      ctx.fillText(lbl.lines.join(''), bodyX, y + 32);

      // Thanh nền tối
      drawRoundedRect(ctx, bodyX, y + 50, bodyW, 38, 19);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();

      // Thanh giá trị chạy mượt
      const fillW = Math.max(38, bodyW * barRatio);
      drawRoundedRect(ctx, bodyX, y + 50, fillW, 38, 19);
      ctx.fillStyle = barColor;
      ctx.fill();
    });
  }

  // --- 2. GAUGE (Chạy số từ fromValue -> toValue) ---
  else if (visual.type === 'gauge') {
    const from = visual.fromValue ?? 0;
    const to = visual.toValue ?? 100;
    const cur = from + (to - from) * anim;
    const unit = visual.unit ?? '';

    const cx = cardX + cardW / 2;
    const cy = bodyY + bodyH * 0.72;
    const r = Math.min(bodyW * 0.36, bodyH * 0.65);

    // Cung nền
    ctx.lineWidth = 30;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.stroke();

    // Cung cam chạy theo tiến độ
    ctx.strokeStyle = '#e67e22';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * anim);
    ctx.stroke();

    // Số lớn ở giữa
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 78px ${FONT}`;
    ctx.fillText(`${Math.round(cur).toLocaleString("en-US")}${unit}`, cx, cy - 18);

    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 28px ${FONT}`;
    ctx.fillText(`${from.toLocaleString("en-US")}${unit}  →  ${to.toLocaleString("en-US")}${unit}`, cx, cy + 44);
  }

  // --- 3. SPLIT COMPARE (So sánh 2 nửa Trái / Phải) ---
  else if (visual.type === 'split_compare') {
    const halfW = (bodyW - 36) / 2;
    // Trái (Nóng / Cam)
    drawRoundedRect(ctx, bodyX, bodyY + 10, halfW, bodyH - 20, 18);
    ctx.fillStyle = 'rgba(230, 126, 34, 0.22)';
    ctx.fill();
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    const inner = halfW - 44, titleY = bodyY + 82, subY = bodyY + 82 + (bodyH - 112) / 2 + 20;
    ctx.fillStyle = '#ffbe76';
    drawFit(ctx, fitText(ctx, visual.leftTitle ?? '', inner, 38, 700, 1, 24), bodyX + halfW / 2, titleY);
    ctx.fillStyle = '#ffffff';
    drawFit(ctx, fitText(ctx, visual.leftSub ?? '', inner, 44, 700, 4, 26), bodyX + halfW / 2, subY);

    // Phải (Lạnh / Xanh)
    const rx = bodyX + halfW + 36;
    drawRoundedRect(ctx, rx, bodyY + 10, halfW, bodyH - 20, 18);
    ctx.fillStyle = 'rgba(78, 168, 222, 0.22)';
    ctx.fill();
    ctx.strokeStyle = '#4ea8de';
    ctx.stroke();

    ctx.fillStyle = '#74b9ff';
    drawFit(ctx, fitText(ctx, visual.rightTitle ?? '', inner, 38, 700, 1, 24), rx + halfW / 2, titleY);
    ctx.fillStyle = '#ffffff';
    drawFit(ctx, fitText(ctx, visual.rightSub ?? '', inner, 44, 700, 4, 26), rx + halfW / 2, subY);
  }

  // --- 4. JUMP RULER (So sánh chiều cao cột đứng) ---
  else if (visual.type === 'jump_ruler') {
    const items = visual.items ?? [
      { label: '通常 (1G)', value: 50, unit: 'cm', color: '#4ea8de' },
      { label: '重力2倍 (2G)', value: 25, unit: 'cm', color: '#e67e22' },
    ];
    const maxVal = Math.max(1, ...items.map(i => i.value));
    const colW = 140;
    const gap = 140;
    const startX = cardX + cardW / 2 - ((items.length * colW + (items.length - 1) * gap) / 2);
    const baseY = bodyY + bodyH - 60;

    items.forEach((item, idx) => {
      const h = (item.value / maxVal) * (bodyH - 130) * anim;
      const x = startX + idx * (colW + gap);
      drawRoundedRect(ctx, x, baseY - h, colW, Math.max(16, h), 14);
      ctx.fillStyle = item.color ?? '#e67e22';
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 36px ${FONT}`;
      ctx.fillText(`${Math.round(item.value * anim)}${item.unit ?? ''}`, x + colW / 2, baseY - h - 18);

      ctx.fillStyle = '#cbd5e1';
      drawFit(ctx, fitText(ctx, item.label, colW + gap - 16, 28, 600, 2, 18), x + colW / 2, baseY + 46);
    });
  }

  // --- 5. FACT CARD (Thẻ nhấn mạnh 1 con số/sự thật) ---
  else {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff9f43';
    drawFit(ctx, fitText(ctx, visual.highlightText ?? `${visual.toValue ?? ''}${visual.unit ?? ''}`, bodyW, 76, 800, 2, 40), cardX + cardW / 2, bodyY + 110);

    ctx.fillStyle = '#e2e8f0';
    drawFit(ctx, fitText(ctx, visual.subText ?? '', bodyW, 34, 600, 3, 24), cardX + cardW / 2, bodyY + 265);
  }

  ctx.restore();
}
