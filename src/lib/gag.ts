import * as THREE from "three";
/*
  Gag hài cho Kai (dùng ở mọi cảnh):
  - Động tác: "slam_land" (rơi từ trên cao xuống "ドーン", ngồi bệt choáng váng),
              "faceplant" (đổ sấp mặt xuống đất "ベチャッ"), "struggle_up" (cố đứng dậy mà không nổi).
  - ImpactFx: vết nứt mặt đất + bụi + rung máy lúc va chạm.
  - drawSfx: chữ hiệu ứng kiểu manga (beat.sfx) bật lên giữa màn hình.
*/
export const GAG_ACTIONS = ["slam_land", "faceplant", "struggle_up"] as const;
export type GagAction = typeof GAG_ACTIONS[number];
export const isGag = (a: string): a is GagAction => (GAG_ACTIONS as readonly string[]).includes(a);

/** giây chạm đất của slam_land / faceplant */
export const SLAM_T = 0.9, FACE_T = 0.85;
const SLAM_H = 14;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const easeIn = (x: number) => Math.pow(clamp(x), 2);

export interface GagRig { body: THREE.Object3D; head: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D; legL: THREE.Object3D; legR: THREE.Object3D }

export function applyGagAction(r: GagRig, action: GagAction, lt: number, t: number): void {
  const { body: b, head: h, armL, armR, legL, legR } = r;
  if (action === "slam_land") {
    if (lt < SLAM_T) {
      const k = lt / SLAM_T;
      b.position.y = SLAM_H * (1 - k * k);
      b.rotation.z = Math.sin(t * 14) * 0.18; h.rotation.x = -0.4;
      armL.rotation.set(Math.sin(t * 22) * 0.4, 0, -2.6); armR.rotation.set(Math.sin(t * 22 + 1) * 0.4, 0, 2.6);
      legL.rotation.x = -0.5 + Math.sin(t * 20) * 0.4; legR.rotation.x = 0.4 - Math.sin(t * 20) * 0.4;
      return;
    }
    const u = lt - SLAM_T;
    // bẹp người khi chạm đất rồi bật lại
    const sq = Math.exp(-u * 7) * Math.cos(u * 22);
    b.scale.set(1 + 0.35 * sq, 1 - 0.4 * sq, 1 + 0.35 * sq);
    // ngồi bệt, chân duỗi ra trước, đầu lắc choáng
    const k = easeOut(u / 0.25);
    b.position.y = -0.62 * k;
    legL.rotation.set(-1.45 * k, 0, -0.15 * k); legR.rotation.set(-1.45 * k, 0, 0.15 * k);
    armL.rotation.set(0.6 * k, 0, -0.5 * k); armR.rotation.set(0.6 * k, 0, 0.5 * k);
    const dz = Math.max(0.25, Math.exp(-u * 0.6));
    h.rotation.z = Math.sin(t * 7) * 0.22 * dz; h.rotation.x = 0.1 + Math.sin(t * 5) * 0.1 * dz;
    b.rotation.z = Math.sin(t * 7 + 1) * 0.06 * dz;
    return;
  }
  if (action === "faceplant") {
    const k = easeIn((lt - 0.25) / (FACE_T - 0.25));
    b.rotation.x = (Math.PI / 2 - 0.12) * k;
    const flail = lt < FACE_T ? Math.sin(t * 26) * 0.5 : 0;
    armL.rotation.set(0, 0, -0.12 - 2.6 * k + flail); armR.rotation.set(0, 0, 0.12 + 2.6 * k - flail);
    if (lt >= FACE_T) {
      const u = lt - FACE_T, sq = Math.exp(-u * 8) * Math.cos(u * 26);
      b.scale.set(1 + 0.12 * sq, 1, 1 - 0.25 * sq);
      // chân giật giật
      legL.rotation.x = 0.35 + Math.max(0, Math.sin(t * 11)) * 0.35 * Math.exp(-u * 0.4);
      legR.rotation.x = 0.2 + Math.max(0, Math.sin(t * 11 + 2)) * 0.35 * Math.exp(-u * 0.4);
      h.rotation.y = Math.sin(u * 3) * 0.1;
    }
    return;
  }
  // struggle_up: chu kỳ 1,8 s – nhổm dậy run rẩy rồi sụp xuống
  const c = (lt % 2.0) / 2.0, up = c < 0.75 ? 0.6 * easeIn(c / 0.75) : 0.6 * (1 - easeOut((c - 0.75) / 0.1));
  const k = 1 - Math.max(0, up);
  b.position.y = -0.55 * k + Math.sin(t * 40) * 0.01 * (1 - k);
  b.rotation.x = 0.45 * k + 0.15;
  legL.rotation.x = -1.2 * k; legR.rotation.x = -1.2 * k;
  armL.rotation.set(-0.9 * k - 0.3, 0, -0.25); armR.rotation.set(-0.9 * k - 0.3, 0, 0.25);
  h.rotation.x = 0.2 + Math.sin(t * 40) * 0.02;
}

function crackTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d")!;
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const grad = g.createRadialGradient(256, 256, 10, 256, 256, 150); grad.addColorStop(0, "rgba(20,15,10,0.75)"); grad.addColorStop(1, "rgba(20,15,10,0)");
  g.fillStyle = grad; g.beginPath(); g.arc(256, 256, 150, 0, 7); g.fill();
  g.strokeStyle = "rgba(15,10,5,0.95)"; g.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    let a = (i / 14) * Math.PI * 2 + rnd() * 0.3, x = 256, y = 256, w = 9;
    g.beginPath(); g.moveTo(x, y);
    for (let j = 0; j < 7; j++) { a += (rnd() - 0.5) * 0.7; const l = 18 + rnd() * 22; x += Math.cos(a) * l; y += Math.sin(a) * l; g.lineWidth = w; g.lineTo(x, y); w *= 0.78; }
    g.stroke();
  }
  g.lineWidth = 3; for (let r = 70; r < 200; r += 55) { g.beginPath(); for (let a = 0; a < 6.3; a += 0.25) { const rr = r + (rnd() - 0.5) * 14; g.lineTo(256 + Math.cos(a) * rr, 256 + Math.sin(a) * rr); } g.globalAlpha = 0.45; g.stroke(); g.globalAlpha = 1; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** vết nứt + bụi + rung máy khi chạm đất */
export class ImpactFx {
  group = new THREE.Group();
  private crack: THREE.Mesh;
  private dust: THREE.Sprite[] = [];
  private dustTex: THREE.CanvasTexture;
  constructor() {
    this.crack = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    this.crack.rotation.x = -Math.PI / 2; this.crack.renderOrder = 5; this.group.add(this.crack);
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, "rgba(235,225,210,0.9)"); gr.addColorStop(1, "rgba(235,225,210,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.dustTex = new THREE.CanvasTexture(c);
    for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dustTex, transparent: true, depthWrite: false })); this.dust.push(s); this.group.add(s); }
    this.group.visible = false;
  }
  update(action: string, lt: number, root: THREE.Object3D, camera: THREE.PerspectiveCamera): void {
    const hitT = action === "slam_land" ? SLAM_T : action === "faceplant" ? FACE_T : -1;
    if (hitT < 0 || lt < hitT) { this.group.visible = false; return; }
    const u = lt - hitT, big = action === "slam_land";
    this.group.visible = true;
    const fwd = new THREE.Vector3(0, 0, big ? 0 : 0.9).applyQuaternion(root.quaternion);
    this.group.position.copy(root.position).add(fwd); this.group.position.y = root.position.y + 0.02;
    this.crack.visible = big;
    const cs = (big ? 3.4 : 1.2) * easeOut(u / 0.12); this.crack.scale.set(cs, cs, 1);
    this.dust.forEach((s, i) => {
      const a = (i / this.dust.length) * Math.PI * 2, d = (big ? 2.2 : 0.9) * easeOut(u / 0.9), k = clamp(1 - u / 1.1);
      s.position.set(Math.cos(a) * d, 0.15 + (i % 3) * 0.12 + u * 0.3, Math.sin(a) * d);
      const sc = (big ? 0.9 : 0.45) * (0.6 + u); s.scale.set(sc, sc, 1); (s.material as THREE.SpriteMaterial).opacity = k * 0.85;
    });
    // rung máy
    const amp = (big ? 0.16 : 0.05) * Math.exp(-u * 5);
    if (amp > 0.002) camera.position.add(new THREE.Vector3(Math.sin(lt * 91) * amp, Math.sin(lt * 77 + 1) * amp, Math.sin(lt * 63 + 2) * amp * 0.5));
  }
}

export interface BeatSfx {
  /** chữ hiệu ứng, vd "ドーン!!", "バキッ!", "ベチャッ" */
  text: string;
  /** giây trong beat bắt đầu hiện (mặc định 0.9 – lúc chạm đất của slam_land) */
  at?: number;
  /** vị trí theo tỉ lệ màn hình 0..1 (mặc định giữa, hơi cao) */
  x?: number; y?: number;
  /** màu chữ (mặc định vàng) */
  color?: string;
  /** cỡ chữ theo khung 1080 (mặc định 170) */
  size?: number;
}

const FONT = '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", system-ui, sans-serif';
export function drawSfx(g: CanvasRenderingContext2D, list: BeatSfx[], lt: number, W: number, H: number): void {
  const base = Math.min(W, H) / 1080;
  list.forEach((s, i) => {
    const u = lt - (s.at ?? SLAM_T); if (u < 0 || u > 1.6) return;
    const pop = u < 0.18 ? 0.3 + 1.0 * (u / 0.18) * 1.15 : 1 + 0.15 * Math.exp(-(u - 0.18) * 9) * Math.cos((u - 0.18) * 30);
    const fade = u > 1.25 ? 1 - (u - 1.25) / 0.35 : 1;
    const x = (s.x ?? 0.5) * W + Math.sin(u * 60) * 6 * Math.exp(-u * 6) * base, y = (s.y ?? (H > W ? 0.4 : 0.36)) * H;
    g.save(); g.globalAlpha = clamp(fade); g.translate(x, y); g.rotate((i % 2 ? 1 : -1) * 0.12); g.scale(pop, pop);
    g.font = `900 ${(s.size ?? 170) * base}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = 26 * base; g.strokeStyle = "#1a1a1a"; g.strokeText(s.text, 0, 0);
    g.lineWidth = 10 * base; g.strokeStyle = "#ffffff"; g.strokeText(s.text, 0, 0);
    g.fillStyle = s.color ?? "#ffd23a"; g.fillText(s.text, 0, 0);
    g.restore();
  });
}
