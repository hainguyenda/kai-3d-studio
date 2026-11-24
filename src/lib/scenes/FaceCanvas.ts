import * as THREE from "three";
import type { Emotion } from "../types";
import { clamp, lerp } from "../math";

/**
 * Khuôn mặt vẽ bằng canvas 512×512, dán lên nửa trước quả cầu đầu.
 * Ảnh phủ một dải góc ngang PHI_LEN và dọc THETA_START..THETA_END của quả cầu,
 * nên 1 px ngang dài hơn 1 px dọc K lần → vẽ hình tròn thì chia bán kính ngang cho K.
 */
export const FACE_PHI_LEN = Math.PI * 0.95;
export const FACE_THETA_START = Math.PI * 0.28;
export const FACE_THETA_END = Math.PI * 0.82;
const SIZE = 512;
const K = FACE_PHI_LEN / (FACE_THETA_END - FACE_THETA_START);

/** đổi góc trên quả cầu (a: lệch ngang so với chính diện, e: lệch dọc so với xích đạo, dương = thấp hơn) sang toạ độ canvas */
const toPx = (a: number, e: number): [number, number] => [
  (0.5 + a / FACE_PHI_LEN) * SIZE,
  ((Math.PI / 2 + e - FACE_THETA_START) / (FACE_THETA_END - FACE_THETA_START)) * SIZE,
];

export interface FaceState {
  t: number;
  /** 0 mở … 1 nhắm */
  blink: number;
  /** 0 ngậm … 1 há to */
  mouth: number;
  emotion: Emotion;
}

export class FaceCanvas {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  private g: CanvasRenderingContext2D;
  private last = "";

  constructor(private skin = "#f2cbb0") {
    this.canvas = document.createElement("canvas");
    this.canvas.width = SIZE; this.canvas.height = SIZE;
    const g = this.canvas.getContext("2d");
    if (!g) throw new Error("Canvas 2D không khả dụng");
    this.g = g;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  /** elip đúng tỉ lệ trên mặt cầu (rx, ry theo px dọc) */
  private ell(cx: number, cy: number, rx: number, ry: number, rot = 0): void {
    this.g.beginPath(); this.g.ellipse(cx, cy, Math.max(0.5, rx / K), Math.max(0.5, ry), rot, 0, Math.PI * 2);
  }

  draw(s: FaceState): void {
    // chỉ vẽ lại khi có thay đổi nhìn thấy được
    const key = `${s.blink.toFixed(2)}|${s.mouth.toFixed(2)}|${s.emotion}|${s.emotion === "sweating" ? (s.t % 1.6).toFixed(2) : ""}`;
    if (key === this.last) return;
    this.last = key;
    const g = this.g;
    g.clearRect(0, 0, SIZE, SIZE);
    const shocked = s.emotion === "shocked", excited = s.emotion === "excited", sweating = s.emotion === "sweating";

    /* ---------- má hồng ---------- */
    for (const side of [-1, 1]) {
      const [cx, cy] = toPx(side * 0.56, 0.33);
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, 26);
      grad.addColorStop(0, "rgba(235,110,110,0.45)"); grad.addColorStop(1, "rgba(235,110,110,0)");
      g.fillStyle = grad; this.ell(cx, cy, 34, 20); g.fill();
    }

    /* ---------- mắt ---------- */
    const eyeScale = shocked ? 1.16 : 1;
    for (const side of [-1, 1]) {
      const [cx, cy] = toPx(side * 0.345, 0.035);
      const rx = 35 * eyeScale, ry = 42 * eyeScale;
      g.save();
      this.ell(cx, cy, rx, ry); g.clip();
      // lòng trắng
      g.fillStyle = "#fbf8f2"; g.fillRect(cx - 80, cy - 80, 160, 160);
      // mống mắt nâu hổ phách + đồng tử
      const ir = 28 * (shocked ? 0.9 : 1), icy = cy + 3;
      const ig = g.createRadialGradient(cx, icy - 6, 2, cx, icy, ir);
      ig.addColorStop(0, "#a8652b"); ig.addColorStop(0.6, "#6e3d1a"); ig.addColorStop(1, "#3a2010");
      g.fillStyle = ig; this.ell(cx, icy, ir, ir); g.fill();
      g.fillStyle = "#150b06"; this.ell(cx, icy, ir * (shocked ? 0.38 : 0.5), ir * (shocked ? 0.38 : 0.5)); g.fill();
      // 2 điểm sáng (lấp lánh)
      g.fillStyle = "#ffffff";
      this.ell(cx - 10, icy - 12, excited ? 11 : 9.5, excited ? 11 : 9.5); g.fill();
      this.ell(cx + 9, icy + 10, 4.5, 4.5); g.fill();
      // mi trên chớp mắt (màu da phủ từ trên xuống)
      const lid = clamp(s.blink) * ry * 2.1 + (sweating ? ry * 0.18 : 0);
      if (lid > 0.5) {
        g.fillStyle = this.skin; g.fillRect(cx - 80, cy - ry - 2, 160, lid);
        const ly = Math.min(cy - ry + lid, cy + ry * 0.75);
        g.strokeStyle = "#2c2623"; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 60, ly); g.lineTo(cx + 60, ly); g.stroke();
      }
      g.restore();
      // viền mi trên
      g.strokeStyle = "#2c2623"; g.lineWidth = 4.5; g.lineCap = "round";
      g.beginPath(); g.ellipse(cx, cy, rx / K, ry, 0, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
    }

    /* ---------- miệng ---------- */
    const [mx, my] = toPx(0, 0.47);
    const o = clamp(shocked ? Math.max(0.35, s.mouth * 0.7) : s.mouth);
    g.lineCap = "round"; g.lineJoin = "round";
    if (o < 0.08 && !shocked) {
      // closed_smile
      const w = excited ? 30 : 24;
      g.strokeStyle = "#7a3b2e"; g.lineWidth = 5;
      g.beginPath(); g.moveTo(mx - w / K, my - 3); g.quadraticCurveTo(mx, my + (excited ? 14 : 10), mx + w / K, my - 3); g.stroke();
    } else {
      // small_o → medium_open → wide_a
      const w = shocked ? lerp(11, 16, o) : lerp(14, 32, o), h = shocked ? lerp(13, 20, o) : lerp(5, 30, o);
      const cy = my + h * 0.25;
      g.fillStyle = "#5a1f1c"; this.ell(mx, cy, w, h); g.fill();
      if (o > 0.35) { // lưỡi
        g.save(); this.ell(mx, cy, w, h); g.clip();
        g.fillStyle = "#e0736b"; this.ell(mx, cy + h * 0.75, w * 0.8, h * 0.55); g.fill();
        g.restore();
      }
      g.strokeStyle = "#7a3b2e"; g.lineWidth = 3.5; this.ell(mx, cy, w, h); g.stroke();
    }

    /* ---------- giọt mồ hôi xanh trên thái dương ---------- */
    if (sweating) {
      const ph = (s.t % 1.6) / 1.6, [sx, sy0] = toPx(0.78, -0.22), sy = sy0 + ph * 40;
      g.globalAlpha = ph < 0.8 ? 1 : (1 - ph) / 0.2;
      g.fillStyle = "#6ec6ff"; g.strokeStyle = "#2b7fc1"; g.lineWidth = 3;
      g.beginPath();
      g.moveTo(sx, sy - 22);
      g.bezierCurveTo(sx + 14 / K, sy - 4, sx + 15 / K, sy + 14, sx, sy + 16);
      g.bezierCurveTo(sx - 15 / K, sy + 14, sx - 14 / K, sy - 4, sx, sy - 22);
      g.fill(); g.stroke();
      g.fillStyle = "rgba(255,255,255,0.85)"; this.ell(sx - 3, sy + 4, 4, 5); g.fill();
      g.globalAlpha = 1;
    }
    this.texture.needsUpdate = true;
  }

  dispose(): void { this.texture.dispose(); }
}
