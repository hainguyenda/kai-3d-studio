import * as THREE from "three";
import { clamp, lerp, rng } from "./math";

/* ---------- tiện ích ---------- */
const canvas = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("Canvas 2D không khả dụng");
  return [c, g];
};
const toTexture = (c: HTMLCanvasElement, repeat = false, srgb = true): THREE.CanvasTexture => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
};
const hex = (c: string): [number, number, number] => {
  const n = new THREE.Color(c);
  return [Math.round(n.r * 255), Math.round(n.g * 255), Math.round(n.b * 255)];
};
const shadeHex = (c: string, f: number): string => {
  const [r, g, b] = hex(c);
  const k = (v: number) => Math.round(clamp(v * f, 0, 255));
  return `rgb(${k(r)},${k(g)},${k(b)})`;
};
/** nhiễu hạt mịn phủ lên canvas */
const grain = (g: CanvasRenderingContext2D, w: number, h: number, amount: number, seed = 1): void => {
  const img = g.getImageData(0, 0, w, h), R = rng(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (R() - 0.5) * amount;
    img.data[i] = clamp(img.data[i] + n, 0, 255);
    img.data[i + 1] = clamp(img.data[i + 1] + n, 0, 255);
    img.data[i + 2] = clamp(img.data[i + 2] + n, 0, 255);
  }
  g.putImageData(img, 0, 0);
};

/* ---------- nhiễu 3D (cho bản đồ Trái Đất) ---------- */
const hash3 = (x: number, y: number, z: number, s: number): number => {
  const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.19) * 43758.5453;
  return v - Math.floor(v);
};
const vnoise3 = (x: number, y: number, z: number, s: number): number => {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (a: number, b: number, d: number) => hash3(xi + a, yi + b, zi + d, s);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w);
};
export const fbm3 = (x: number, y: number, z: number, seed: number, oct = 5): number => {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let o = 0; o < oct; o++) { s += a * vnoise3(x * f, y * f, z * f, seed + o * 7); n += a; a *= 0.5; f *= 2.02; }
  return s / n;
};
/** vị trí trên mặt cầu khớp với UV của THREE.SphereGeometry */
export const latLonToVec = (lat: number, lon: number, r = 1): THREE.Vector3 => {
  const phi = ((lon + 180) / 360) * Math.PI * 2, th = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th));
};

/* =========================================================
   1. Tường ván ốp kiểu nhà Nhật
   ========================================================= */
export function createHouseSidingTexture(baseColor = "#e9e2d3"): THREE.CanvasTexture {
  const W = 512, H = 512, [c, g] = canvas(W, H), board = 28, R = rng(baseColor.length * 13 + 7);
  g.fillStyle = baseColor; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += board) {
    const tone = 0.96 + R() * 0.06;
    g.fillStyle = shadeHex(baseColor, tone); g.fillRect(0, y, W, board);
    const gr = g.createLinearGradient(0, y, 0, y + board);
    gr.addColorStop(0, "rgba(255,255,255,0.18)"); gr.addColorStop(0.75, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.28)");
    g.fillStyle = gr; g.fillRect(0, y, W, board);
    g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(0, y + board - 2, W, 2); // khe ván
    for (let j = 0; j < 2; j++) { const x = R() * W; g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(x, y, 2, board); }
  }
  grain(g, W, H, 10, 3);
  return toTexture(c, true);
}

export function createRoofTileTexture(color = "#4a4f57"): THREE.CanvasTexture {
  const W = 512, H = 512, [c, g] = canvas(W, H), R = rng(91);
  g.fillStyle = color; g.fillRect(0, 0, W, H);
  const row = 32, col = 40;
  for (let y = 0, r = 0; y < H; y += row, r++) {
    for (let x = -col; x < W + col; x += col) {
      const ox = (r % 2) * col / 2, t = 0.85 + R() * 0.25;
      g.fillStyle = shadeHex(color, t); g.beginPath(); g.roundRect(x + ox + 1, y + 1, col - 2, row - 1, 6); g.fill();
      const gr = g.createLinearGradient(0, y, 0, y + row); gr.addColorStop(0, "rgba(255,255,255,0.12)"); gr.addColorStop(1, "rgba(0,0,0,0.35)");
      g.fillStyle = gr; g.fill();
    }
  }
  grain(g, W, H, 12, 5);
  return toTexture(c, true);
}

/* =========================================================
   2. Mặt đường nhựa (vạch trắng hai mép)
   ========================================================= */
export function createAsphaltTexture(): THREE.CanvasTexture {
  const W = 512, H = 1024, [c, g] = canvas(W, H), R = rng(17);
  g.fillStyle = "#5b5e63"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { const v = 60 + R() * 70; g.fillStyle = `rgba(${v},${v},${v + 4},${0.35 + R() * 0.4})`; g.fillRect(R() * W, R() * H, 1 + R() * 2.5, 1 + R() * 2.5); }
  for (let i = 0; i < 14; i++) { // vết mòn, vá đường
    g.fillStyle = `rgba(30,30,34,${0.08 + R() * 0.1})`; g.beginPath(); g.ellipse(R() * W, R() * H, 30 + R() * 90, 10 + R() * 40, R() * 3, 0, 7); g.fill();
  }
  g.strokeStyle = "rgba(35,35,38,0.45)"; g.lineWidth = 1.2;
  for (let i = 0; i < 10; i++) { let x = R() * W, y = R() * H; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 8; s++) { x += (R() - 0.5) * 30; y += R() * 25; g.lineTo(x, y); } g.stroke(); }
  for (const x of [22, W - 36]) { g.fillStyle = "rgba(240,240,232,0.92)"; g.fillRect(x, 0, 14, H); }
  grain(g, W, H, 14, 9);
  return toTexture(c, true);
}

export function createGutterTexture(): THREE.CanvasTexture {
  const W = 128, H = 512, [c, g] = canvas(W, H);
  g.fillStyle = "#a3a29c"; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 64) {
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, y, W, 3);
    for (let s = 0; s < 6; s++) { g.fillStyle = "#2b2b2b"; g.fillRect(20 + s * 15, y + 20, 7, 26); }
  }
  grain(g, W, H, 18, 4);
  return toTexture(c, true);
}

export function createManholeTexture(): THREE.CanvasTexture {
  const S = 256, [c, g] = canvas(S, S);
  g.fillStyle = "#3a3a3c"; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.fill();
  g.strokeStyle = "#555"; g.lineWidth = 8; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 8, 0, 7); g.stroke();
  g.lineWidth = 3; g.strokeStyle = "#505052";
  for (let r = 20; r < S / 2 - 16; r += 16) { g.beginPath(); g.arc(S / 2, S / 2, r, 0, 7); g.stroke(); }
  for (let a = 0; a < 12; a++) { g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 + Math.cos(a * Math.PI / 6) * (S / 2 - 16), S / 2 + Math.sin(a * Math.PI / 6) * (S / 2 - 16)); g.stroke(); }
  grain(g, S, S, 16, 2);
  return toTexture(c);
}

export function createBlockWallTexture(): THREE.CanvasTexture {
  const W = 512, H = 256, [c, g] = canvas(W, H), R = rng(33);
  g.fillStyle = "#b8b5ad"; g.fillRect(0, 0, W, H);
  const bw = 128, bh = 64;
  for (let y = 0, r = 0; y < H; y += bh, r++) for (let x = -bw; x < W + bw; x += bw) {
    const ox = (r % 2) * bw / 2;
    g.fillStyle = shadeHex("#b8b5ad", 0.92 + R() * 0.12); g.fillRect(x + ox + 2, y + 2, bw - 4, bh - 4);
  }
  grain(g, W, H, 22, 8);
  return toTexture(c, true);
}

/* =========================================================
   3. Viền sọc cảnh báo vàng–đen
   ========================================================= */
export function createHazardRimTexture(): THREE.CanvasTexture {
  const W = 1024, H = 64, [c, g] = canvas(W, H);
  g.fillStyle = "#1e272e"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#f1c40f";
  for (let x = -H; x < W + H; x += 64) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + 32, H); g.lineTo(x + 32 + H, 0); g.lineTo(x + H, 0); g.closePath(); g.fill(); }
  grain(g, W, H, 14, 6);
  return toTexture(c, true);
}

/* =========================================================
   4. Bản đồ Trái Đất (map + bump + roughness)
   ========================================================= */
export interface EarthTextures { map: THREE.CanvasTexture; bump: THREE.CanvasTexture; rough: THREE.CanvasTexture }
export function createEarthTexture(seed = 7, w = 1024, h = 512): EarthTextures {
  const [c, g] = canvas(w, h), [cb, gb] = canvas(w, h), [cr, gr] = canvas(w, h);
  const img = g.createImageData(w, h), bimg = gb.createImageData(w, h), rimg = gr.createImageData(w, h);
  const deep = hex("#0b2c5a"), shallow = hex("#2a6fb0"), green = hex("#4d8a3c"), dark = hex("#2f5e2a"), tan = hex("#c9ab6f"), mount = hex("#8a7356");
  for (let py = 0; py < h; py++) {
    const lat = 90 - ((py + 0.5) / h) * 180;
    for (let px = 0; px < w; px++) {
      const lon = ((px + 0.5) / w) * 360 - 180, p = latLonToVec(lat, lon, 1.6);
      const n = fbm3(p.x + 9, p.y + 9, p.z + 9, seed, 6), d = fbm3(p.x * 3 + 2, p.y * 3, p.z * 3, seed + 40, 3);
      const sea = 0.52, i = (py * w + px) * 4;
      let col: [number, number, number], height: number, rough: number;
      const ice = Math.abs(lat) > 68 + (n - 0.5) * 30;
      if (ice) { col = [238, 244, 250]; height = 0.6; rough = 0.7; }
      else if (n < sea) {
        const k = clamp((sea - n) * 6);
        col = [lerp(shallow[0], deep[0], k), lerp(shallow[1], deep[1], k), lerp(shallow[2], deep[2], k)]; height = 0.1; rough = 0.35;
      } else {
        const m = clamp((n - sea) * 7), desert = clamp(1 - Math.abs(Math.abs(lat) - 24) / 14) * clamp((d - 0.4) * 3);
        const base: [number, number, number] = [lerp(green[0], dark[0], d), lerp(green[1], dark[1], d), lerp(green[2], dark[2], d)];
        const withDesert: [number, number, number] = [lerp(base[0], tan[0], desert), lerp(base[1], tan[1], desert), lerp(base[2], tan[2], desert)];
        col = [lerp(withDesert[0], mount[0], m * 0.7), lerp(withDesert[1], mount[1], m * 0.7), lerp(withDesert[2], mount[2], m * 0.7)];
        height = 0.3 + m * 0.7; rough = 0.92;
      }
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
      const hb = Math.round(height * 255); bimg.data[i] = bimg.data[i + 1] = bimg.data[i + 2] = hb; bimg.data[i + 3] = 255;
      const rb = Math.round(rough * 255); rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rb; rimg.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0); gb.putImageData(bimg, 0, 0); gr.putImageData(rimg, 0, 0);
  return { map: toTexture(c), bump: toTexture(cb, false, false), rough: toTexture(cr, false, false) };
}

export function createCloudTexture(seed = 57, w = 512, h = 256): THREE.CanvasTexture {
  const [c, g] = canvas(w, h), img = g.createImageData(w, h);
  for (let py = 0; py < h; py++) {
    const lat = 90 - ((py + 0.5) / h) * 180;
    for (let px = 0; px < w; px++) {
      const lon = ((px + 0.5) / w) * 360 - 180, p = latLonToVec(lat, lon, 2.6), n = fbm3(p.x, p.y, p.z, seed, 5), i = (py * w + px) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(clamp((n - 0.53) * 4) * 220);
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(c);
}

/* =========================================================
   5. Vách dung nham (manti) + đá vỏ + lõi kim loại nóng chảy
   ========================================================= */
export interface GlowTextures { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture }
function crackedWall(base: string, crackCols: string[], seed: number, cracks: number, glowBg: string): GlowTextures {
  const W = 512, H = 1024, [c, g] = canvas(W, H), [ce, ge] = canvas(W, H), R = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.25})`; g.beginPath(); g.arc(R() * W, R() * H, 2 + R() * 16, 0, 7); g.fill(); }
  for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(255,255,255,${R() * 0.06})`; g.beginPath(); g.arc(R() * W, R() * H, 2 + R() * 10, 0, 7); g.fill(); }
  ge.fillStyle = glowBg; ge.fillRect(0, 0, W, H);
  for (const ctx of [g, ge]) { ctx.lineCap = "round"; ctx.lineJoin = "round"; }
  const R2 = rng(seed + 1);
  for (let i = 0; i < cracks; i++) {
    let x = R2() * W, y = R2() * H; const pts: [number, number][] = [[x, y]];
    for (let s = 0; s < 14; s++) { x += (R2() - 0.5) * 60; y += 20 + R2() * 40; pts.push([x, y]); }
    const col = crackCols[i % crackCols.length], wdt = 2 + R2() * 5;
    for (const [ctx, blur] of [[g, 18], [ge, 24]] as [CanvasRenderingContext2D, number][]) {
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.strokeStyle = col; ctx.lineWidth = wdt;
      ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      // vẽ lặp theo chiều dọc để texture lặp liền mạch
      ctx.stroke(); ctx.translate(0, -H); ctx.stroke(); ctx.translate(0, 2 * H); ctx.stroke(); ctx.restore();
    }
  }
  grain(g, W, H, 16, seed + 3);
  const map = toTexture(c, true), emissive = toTexture(ce, true);
  return { map, emissive };
}
export function createMagmaWallTexture(): GlowTextures {
  return crackedWall("#2a1d1a", ["#ff4500", "#ffae00", "#ff6a1a"], 71, 26, "#120403");
}
export function createCrustTexture(): GlowTextures {
  const t = crackedWall("#6e6256", ["#4a4037"], 21, 10, "#000000");
  // vân lớp đất đá nằm ngang
  const img = t.map.image as HTMLCanvasElement, g = img.getContext("2d");
  if (g) {
    const R = rng(5);
    for (let y = 0; y < img.height; y += 18 + R() * 30) { g.fillStyle = `rgba(${R() < 0.5 ? "40,30,22" : "160,140,118"},${0.12 + R() * 0.15})`; g.fillRect(0, y, img.width, 6 + R() * 14); }
    t.map.needsUpdate = true;
  }
  return t;
}
export function createMoltenIronTexture(): GlowTextures {
  const W = 512, H = 1024, [c, g] = canvas(W, H), img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W * Math.PI * 2, v = y / H * Math.PI * 2;
    const n = fbm3(Math.cos(u) * 1.5 + Math.sin(v) * 0.6, Math.sin(u) * 1.5, Math.cos(v) * 2.2, 13, 5);
    const swirl = 0.5 + 0.5 * Math.sin(n * 18 + y * 0.02), i = (y * W + x) * 4;
    img.data[i] = 255; img.data[i + 1] = Math.round(lerp(70, 210, swirl)); img.data[i + 2] = Math.round(lerp(0, 60, swirl * swirl)); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const map = toTexture(c, true);
  return { map, emissive: map };
}

/* ---------- vũ trụ ---------- */
export function createNebulaTexture(): THREE.CanvasTexture {
  const W = 1024, H = 512, [c, g] = canvas(W, H), R = rng(77);
  g.fillStyle = "#02030a"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) {
    const x = R() * W, y = H * (0.25 + R() * 0.5), r = 80 + R() * 220, col = R() < 0.5 ? "60,40,120" : "20,70,120";
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${0.12 + R() * 0.12})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 2600; i++) { const a = R(); g.fillStyle = `rgba(255,255,255,${a * a})`; g.fillRect(R() * W, R() * H, a > 0.9 ? 2 : 1, a > 0.9 ? 2 : 1); }
  return toTexture(c);
}

export function createGlowSpriteTexture(): THREE.CanvasTexture {
  const S = 128, [c, g] = canvas(S, S), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return toTexture(c);
}

export function createSkyTexture(top = "#86bde9", bottom = "#eaf1f5"): THREE.CanvasTexture {
  const [c, g] = canvas(4, 512), gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, top); gr.addColorStop(0.65, bottom); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  return toTexture(c);
}
