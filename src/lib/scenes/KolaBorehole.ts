import * as THREE from "three";
import type { CharacterLike, FrameCtx, ScenePrefab, SceneLabel } from "../types";
import { clamp, rng } from "../math";
import { createSkyTexture } from "../textures";
import { applyCameraPreset } from "./cameraPresets";
import { PulseMarker } from "./markers";

/*
  kola_borehole – giếng khoan siêu sâu Kola (Nga, 1970–1994, sâu 12.262 m, đường kính ~23 cm).
  Hai phần trong cùng một cảnh:
  - Hiện trường (gốc toạ độ): lãnh nguyên tuyết, nhà khoan đổ nát, tháp khoan, nắp sắt hàn kín miệng giếng. Kai đứng cạnh nắp.
  - Mặt cắt (x = 40): cột đá cao 12,262 đơn vị (1 đơn vị = 1 km), đường khoan mảnh ở giữa,
    chấm vị trí ở độ sâu hud.depthKm, các mốc phát hiện, màu nóng dần về đáy (180°C).
*/

const SEC_X = 40, DEPTH = 12.262, COL_W = 3.2;
const MILESTONES: [number, string][] = [
  [0, "地表"],
  [2, "鉱物を含む岩"],
  [6, "微化石 24種類"],
  [9, "岩のすき間に水"],
  [DEPTH, "12,262m・約180℃"],
];

export interface KolaOptions {
  /** true = miệng giếng đã hàn nắp (hiện nay); false = tháp khoan đang hoạt động (thời Liên Xô) */
  capped?: boolean;
  /** mở nắp: nắp trượt ra, lộ miệng hố tối (dùng với characterAction "jump_in" để Kai nhảy xuống) */
  open?: boolean;
  /** hiện các mốc phát hiện trên mặt cắt (mặc định bật) */
  milestones?: boolean;
  /** nhãn tuỳ ý gắn vào chấm vị trí (mặt cắt) hoặc nắp giếng (hiện trường) */
  label?: string;
  /** mặt cắt: so sánh với Everest (8.849 m) và rãnh Mariana (10.920 m) */
  compare?: boolean;
}

/** bê tông bạc màu, vệt gỉ chảy, mảng loang */
function concreteTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d")!, r = rng(5);
  g.fillStyle = "#9a958c"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "70,60,50" : "200,195,185"},${0.08 + r() * 0.12})`; g.beginPath(); g.arc(r() * 256, r() * 256, 6 + r() * 30, 0, 7); g.fill(); }
  for (let i = 0; i < 14; i++) { const x = r() * 256, y = r() * 200; const gr = g.createLinearGradient(0, y, 0, y + 60); gr.addColorStop(0, "rgba(120,60,25,0.45)"); gr.addColorStop(1, "rgba(120,60,25,0)"); g.fillStyle = gr; g.fillRect(x, y, 2 + r() * 4, 60); }
  for (let y = 0; y < 256; y += 32) { g.fillStyle = "rgba(50,45,40,0.25)"; g.fillRect(0, y, 256, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const steel0 = (reg: <T extends { dispose(): void }>(x: T) => T) => reg(new THREE.MeshStandardMaterial({ color: "#6e3b22", roughness: 0.75, metalness: 0.5 }));

function rockTexture(): THREE.CanvasTexture {
  const w = 256, h = 2048, c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, "#9a8f86"); gr.addColorStop(0.18, "#b07f6c"); gr.addColorStop(0.5, "#8c6a62");
  gr.addColorStop(0.8, "#a0563c"); gr.addColorStop(1, "#d9682a");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const r = rng(31);
  for (let i = 0; i < 2600; i++) { // hạt khoáng
    g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "20,10,5"},${0.05 + r() * 0.12})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 4, 1 + r() * 3);
  }
  for (let i = 0; i < 40; i++) { // vân lớp đá nghiêng
    const y = r() * h; g.strokeStyle = `rgba(60,30,20,${0.12 + r() * 0.15})`; g.lineWidth = 1 + r() * 3;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 30, w * 0.7, y + (r() - 0.5) * 30, w, y + (r() - 0.5) * 20); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class KolaBorehole implements ScenePrefab {
  id = "kola_borehole" as const;
  root = new THREE.Group();
  private sky: THREE.Texture;
  private fog = new THREE.Fog("#c9d3dc", 25, 120);
  private rig = new THREE.Group();
  private cap = new THREE.Group();
  private lid = new THREE.Group();
  private hole: THREE.Group;
  private marker: PulseMarker;
  private glow: THREE.Mesh;
  private cmp = new THREE.Group();
  private ms = new THREE.Group();
  private labelList: SceneLabel[] = [];
  private disposables: { dispose(): void }[] = [];
  private anchor = new THREE.Vector3();

  constructor() {
    this.sky = createSkyTexture("#8fa3b8", "#e6ebef"); this.disposables.push(this.sky);
    const reg = <T extends { dispose(): void }>(x: T) => { this.disposables.push(x); return x; };

    // ---------- hiện trường ----------
    const snowMat = reg(new THREE.MeshStandardMaterial({ color: "#e9eef2", roughness: 0.95 }));
    const ground = new THREE.Mesh(reg(new THREE.PlaneGeometry(240, 240)), snowMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.root.add(ground);
    const r = rng(7), rockMat = reg(new THREE.MeshStandardMaterial({ color: "#6d6a66", roughness: 1, flatShading: true }));
    const rockGeo = reg(new THREE.DodecahedronGeometry(1, 0));
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(rockGeo, rockMat), s = 0.2 + r() * 0.9, a = r() * Math.PI * 2, d = 6 + r() * 26;
      m.position.set(Math.cos(a) * d, s * 0.3, Math.sin(a) * d - 6); m.scale.set(s, s * 0.6, s); m.rotation.y = r() * 3; this.root.add(m);
    }
    // nhà khoan bê tông đổ nát
    const conc = reg(new THREE.MeshStandardMaterial({ map: reg(concreteTexture()), roughness: 0.95 }));
    const dark = reg(new THREE.MeshStandardMaterial({ color: "#1e1f22", roughness: 1 }));
    const box = reg(new THREE.BoxGeometry(1, 1, 1));
    const bld = (x: number, z: number, w: number, h: number, d: number) => {
      const b = new THREE.Mesh(box, conc); b.scale.set(w, h, d); b.position.set(x, h / 2, z); b.castShadow = true; this.root.add(b);
      for (let i = 0; i < Math.floor(w / 2.2); i++) for (let j = 0; j < Math.floor(h / 2.6); j++) {
        const wnd = new THREE.Mesh(box, dark); wnd.scale.set(1, 1.2, 0.1); wnd.position.set(x - w / 2 + 1.4 + i * 2.2, 1.6 + j * 2.6, z + d / 2 + 0.02); this.root.add(wnd);
      }
    };
    bld(-14, -16, 14, 7, 8); bld(4, -20, 9, 11, 7); bld(14, -14, 6, 4, 6); bld(-26, -24, 10, 5, 8); bld(22, -26, 12, 8, 8);
    this.addDecor(reg, box, conc, steel0(reg));
    // tháp khoan (khung lưới)
    const steel = reg(new THREE.MeshStandardMaterial({ color: "#7a4a32", roughness: 0.7, metalness: 0.5 }));
    const H = 22, B = 3.2, T = 0.7, legGeo = reg(new THREE.CylinderGeometry(0.12, 0.12, 1, 6)), barGeo = reg(new THREE.CylinderGeometry(0.05, 0.05, 1, 5));
    const beam = (a: THREE.Vector3, b: THREE.Vector3, geo: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(geo, steel), d = b.clone().sub(a); m.scale.y = d.length();
      m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true; this.rig.add(m);
    };
    const corner = (i: number, y: number) => { const s = B + (T - B) * (y / H), a = Math.PI / 4 + i * Math.PI / 2; return new THREE.Vector3(Math.cos(a) * s, y, Math.sin(a) * s); };
    for (let i = 0; i < 4; i++) beam(corner(i, 0), corner(i, H), legGeo);
    for (let y = 0; y < H; y += 2.2) for (let i = 0; i < 4; i++) { beam(corner(i, y), corner((i + 1) % 4, y), barGeo); beam(corner(i, y), corner((i + 1) % 4, y + 2.2), barGeo); }
    this.rig.position.set(-6, 0, -7); this.root.add(this.rig);
    // nắp hàn kín miệng giếng: mặt bích tròn gỉ sét + bu lông + chữ số
    const rust = reg(new THREE.MeshStandardMaterial({ color: "#7b3f1f", roughness: 0.85, metalness: 0.6 }));
    const flange = new THREE.Mesh(reg(new THREE.CylinderGeometry(0.42, 0.46, 0.12, 40)), rust); flange.position.y = 0.06;
    const top = new THREE.Mesh(reg(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 32)), rust); top.position.y = 0.16;
    const pad = new THREE.Mesh(reg(new THREE.CylinderGeometry(1.1, 1.2, 0.08, 40)), conc); pad.position.y = 0.02;
    this.lid.add(flange, top);
    const boltGeo = reg(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, b = new THREE.Mesh(boltGeo, rust); b.position.set(Math.cos(a) * 0.34, 0.14, Math.sin(a) * 0.34); this.lid.add(b); }
    // miệng hố tối (hiện khi nắp mở) + viền
    this.hole = new THREE.Group();
    const holeDisc = new THREE.Mesh(reg(new THREE.CircleGeometry(0.4, 40)), reg(new THREE.MeshBasicMaterial({ color: "#050403" })));
    holeDisc.rotation.x = -Math.PI / 2; holeDisc.position.y = 0.065;
    const rim = new THREE.Mesh(reg(new THREE.TorusGeometry(0.42, 0.04, 8, 40)), rust); rim.rotation.x = Math.PI / 2; rim.position.y = 0.07;
    this.hole.add(holeDisc, rim);
    this.cap.add(pad, this.hole, this.lid);
    this.cap.position.set(1.1, 0, 0.2); this.root.add(this.cap);

    // ---------- mặt cắt ----------
    const sec = new THREE.Group(); sec.position.x = SEC_X; this.root.add(sec);
    const tex = reg(rockTexture());
    const col = new THREE.Mesh(reg(new THREE.BoxGeometry(COL_W, DEPTH + 0.4, 1.2)), reg(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
    col.position.y = -(DEPTH + 0.4) / 2 + 0.2; sec.add(col);
    // nền tối phía sau (lòng đất) để mặt cắt không lơ lửng giữa trời
    const back = new THREE.Mesh(reg(new THREE.PlaneGeometry(120, DEPTH + 30)), reg(new THREE.MeshBasicMaterial({ color: "#3a2a22", toneMapped: false })));
    back.position.set(0, -(DEPTH + 30) / 2, -1.5); sec.add(back);
    // lớp tuyết trên cùng
    const snowCap = new THREE.Mesh(box, snowMat); snowCap.scale.set(COL_W + 0.2, 0.18, 1.3); snowCap.position.y = 0.09; sec.add(snowCap);
    // đường khoan: dải sáng mảnh
    const bore = new THREE.Mesh(reg(new THREE.PlaneGeometry(0.07, DEPTH)), reg(new THREE.MeshBasicMaterial({ color: "#1a0e08", toneMapped: false })));
    bore.position.set(0, -DEPTH / 2, 0.62); sec.add(bore);
    // ánh nóng ở đáy
    this.glow = new THREE.Mesh(reg(new THREE.PlaneGeometry(COL_W, 3)), reg(new THREE.MeshBasicMaterial({ color: "#ff7a2a", transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
    this.glow.position.set(0, -DEPTH + 1.3, 0.63); sec.add(this.glow);
    // vạch mốc
    const tickMat = reg(new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }));
    for (const [d] of MILESTONES) { const t = new THREE.Mesh(box, tickMat); t.scale.set(COL_W * 0.5, 0.025, 0.02); t.position.set(COL_W * 0.25, -d, 0.63); this.ms.add(t); }
    sec.add(this.ms);
    // cột so sánh: Everest (cao 8,849) & Mariana (sâu 10,92)
    const evMat = reg(new THREE.MeshBasicMaterial({ color: "#7fb6e6", transparent: true, opacity: 0.85, toneMapped: false }));
    const ev = new THREE.Mesh(box, evMat); ev.scale.set(0.9, 8.849, 0.3); ev.position.set(-COL_W / 2 - 1.4, -8.849 / 2, 0.4);
    const mrMat = reg(new THREE.MeshBasicMaterial({ color: "#1f5fa8", transparent: true, opacity: 0.85, toneMapped: false }));
    const mr = new THREE.Mesh(box, mrMat); mr.scale.set(0.9, 10.92, 0.3); mr.position.set(-COL_W / 2 - 2.6, -10.92 / 2, 0.4);
    this.cmp.add(ev, mr); sec.add(this.cmp);

    this.marker = new PulseMarker(0.5, "#ff7a3d", true); sec.add(this.marker.group); this.disposables.push(this.marker);

    const sun = new THREE.DirectionalLight("#ffffff", 2.2); sun.position.set(12, 18, 10); sun.castShadow = true;
    const hemi = new THREE.HemisphereLight("#dfe8f2", "#5a5650", 1.0);
    this.root.add(sun, hemi);
  }

  private snow!: THREE.Points;

  /** xe tải cũ, thùng phuy, đường ống, hàng rào, cột điện, rừng thông, đồi tuyết, tuyết rơi */
  private addDecor(reg: <T extends { dispose(): void }>(x: T) => T, box: THREE.BoxGeometry, conc: THREE.Material, rust: THREE.Material): void {
    const r = rng(19), add = (m: THREE.Object3D) => { this.root.add(m); return m; };
    const mat = (color: string, rough = 0.8, metal = 0.2) => reg(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
    const snowM = mat("#f3f6f8", 0.9, 0), tire = mat("#1b1b1b", 0.9, 0), glass = mat("#2a3540", 0.2, 0.6);
    const cyl = reg(new THREE.CylinderGeometry(1, 1, 1, 16));
    const part = (g: THREE.Group, geo: THREE.BufferGeometry, m: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
      const o = new THREE.Mesh(geo, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o;
    };
    // xe tải kiểu cũ (đầu xe + thùng), có tuyết phủ nóc
    const truck = (x: number, z: number, ry: number, color: string, tank = false) => {
      const g = new THREE.Group(), body = mat(color, 0.7, 0.3);
      part(g, box, body, 2.3, 1.7, 1.9, 0, 1.45, 2.4);          // cabin
      part(g, box, glass, 2.1, 0.7, 0.05, 0, 1.85, 3.36);      // kính
      part(g, box, body, 2.3, 0.6, 0.7, 0, 0.95, 3.6);         // mũi xe
      part(g, box, mat("#2b2b2b", 0.9, 0.3), 2.0, 0.3, 6.4, 0, 0.6, 0.6); // khung gầm
      if (tank) { const t = part(g, cyl, body, 1.0, 4.0, 1.0, 0, 1.75, -0.4); t.rotation.x = Math.PI / 2; }
      else { part(g, box, body, 2.4, 1.1, 4.0, 0, 1.3, -0.4); part(g, box, snowM, 2.3, 0.12, 3.9, 0, 1.9, -0.4); }
      part(g, box, snowM, 2.2, 0.12, 1.8, 0, 2.36, 2.4);
      for (const [wx, wz] of [[-1.05, 2.5], [1.05, 2.5], [-1.05, -0.6], [1.05, -0.6], [-1.05, -1.8], [1.05, -1.8]]) { const w = part(g, cyl, tire, 0.5, 0.35, 0.5, wx, 0.5, wz); w.rotation.z = Math.PI / 2; }
      g.position.set(x, 0, z); g.rotation.y = ry; add(g);
    };
    truck(-4.2, -2.6, 0.5, "#b0602f"); truck(6.5, -6.5, -0.9, "#4f6b4a", true); truck(-10, -6, 1.6, "#5d7a8c"); truck(11, -2, -2.2, "#9c8a3a");
    // thùng phuy gỉ
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(cyl, mat(["#8a3a22", "#2f5b7a", "#6d6a2a"][i % 3], 0.7, 0.4)); b.scale.set(0.3, 0.9, 0.3);
      const tip = i % 4 === 3; b.position.set(2.6 + (i % 3) * 0.65, tip ? 0.3 : 0.45, -2.2 - Math.floor(i / 3) * 0.65);
      if (tip) { b.rotation.z = Math.PI / 2; } b.castShadow = true; add(b);
    }
    // đường ống thép trên giá đỡ, chạy từ nhà khoan ra
    for (const [z, y, rad] of [[-9.5, 1.4, 0.35], [-10.4, 1.0, 0.22]] as const) {
      const p = new THREE.Mesh(cyl, rust); p.scale.set(rad, 34, rad); p.rotation.z = Math.PI / 2; p.position.set(-4, y, z); p.castShadow = true; add(p);
      for (let x = -20; x <= 12; x += 4) { const s = new THREE.Mesh(box, conc); s.scale.set(0.3, y, 0.3); s.position.set(x, y / 2, z); add(s); }
    }
    // hàng rào
    const post = mat("#4a4a4a", 0.6, 0.6);
    for (let x = -34; x <= 34; x += 2.5) { const p = new THREE.Mesh(box, post); p.scale.set(0.1, 2.2, 0.1); p.position.set(x, 1.1, -30); add(p); }
    for (const y of [0.6, 1.4, 2.1]) { const rl = new THREE.Mesh(box, post); rl.scale.set(68, 0.05, 0.05); rl.position.set(0, y, -30); add(rl); }
    // cột điện gỗ + dây
    const wood = mat("#4b3a2a", 0.9, 0), pts: THREE.Vector3[] = [];
    for (let i = 0; i < 9; i++) {
      const x = -40 + i * 10, z = -38 - i * 1.5, p = new THREE.Mesh(cyl, wood); p.scale.set(0.15, 8, 0.15); p.position.set(x, 4, z); add(p);
      const arm = new THREE.Mesh(box, wood); arm.scale.set(0.12, 0.12, 2.2); arm.position.set(x, 7.6, z); arm.rotation.y = 0; add(arm);
      pts.push(new THREE.Vector3(x, 7.6, z));
    }
    const lineM = reg(new THREE.LineBasicMaterial({ color: "#222" }));
    for (const dz of [-0.9, 0.9]) for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i].clone().setZ(pts[i].z + dz), b = pts[i + 1].clone().setZ(pts[i + 1].z + dz), seg: THREE.Vector3[] = [];
      for (let k = 0; k <= 8; k++) { const t = k / 8, v = a.clone().lerp(b, t); v.y -= Math.sin(Math.PI * t) * 0.6; seg.push(v); }
      add(new THREE.Line(reg(new THREE.BufferGeometry().setFromPoints(seg)), lineM));
    }
    // rừng thông phủ tuyết (InstancedMesh)
    const N = 160, coneG = reg(new THREE.ConeGeometry(1, 1, 7)), trunkG = reg(new THREE.CylinderGeometry(0.15, 0.2, 1, 5));
    const leaves = new THREE.InstancedMesh(coneG, mat("#2f4a3a", 0.9, 0), N * 2), caps = new THREE.InstancedMesh(coneG, snowM, N), trunks = new THREE.InstancedMesh(trunkG, wood, N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const a = -Math.PI * 0.95 + r() * Math.PI * 1.1, d = 36 + r() * 40, x = Math.cos(a) * d, z = Math.sin(a) * d - 6, h = 4 + r() * 5;
      m4.compose(v.set(x, 0.6, z), q, sc.set(1, 1.2, 1)); trunks.setMatrixAt(i, m4);
      m4.compose(v.set(x, h * 0.45, z), q, sc.set(h * 0.32, h * 0.6, h * 0.32)); leaves.setMatrixAt(i * 2, m4);
      m4.compose(v.set(x, h * 0.78, z), q, sc.set(h * 0.2, h * 0.4, h * 0.2)); leaves.setMatrixAt(i * 2 + 1, m4);
      m4.compose(v.set(x, h * 0.92, z), q, sc.set(h * 0.12, h * 0.22, h * 0.12)); caps.setMatrixAt(i, m4);
    }
    add(leaves); add(caps); add(trunks);
    // đồi tuyết xa
    const hillG = reg(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2));
    for (let i = 0; i < 9; i++) { const a = -Math.PI * 0.95 + i * 0.14 * Math.PI, d = 85 + r() * 20, h = new THREE.Mesh(hillG, snowM); h.scale.set(25 + r() * 20, 8 + r() * 10, 18); h.position.set(Math.cos(a) * d, -1, Math.sin(a) * d - 6); add(h); }
    // ống khói sọc đỏ trắng
    const red = mat("#b23a2a", 0.8, 0), wht = mat("#e4e2dc", 0.8, 0);
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(cyl, i % 2 ? wht : red); c.scale.set(1.1 - i * 0.06, 4, 1.1 - i * 0.06); c.position.set(16, 2 + i * 4, -30); add(c); }
    // đường đất xám dẫn vào trạm
    const road = new THREE.Mesh(reg(new THREE.PlaneGeometry(4.5, 60)), mat("#7d7a74", 1, 0)); road.rotation.x = -Math.PI / 2; road.rotation.z = 0.35; road.position.set(5, 0.01, 6); road.receiveShadow = true; add(road);
    // tuyết rơi
    const flakes = 900, pos = new Float32Array(flakes * 3);
    for (let i = 0; i < flakes; i++) { pos[i * 3] = (r() - 0.5) * 40; pos[i * 3 + 1] = r() * 18; pos[i * 3 + 2] = (r() - 0.5) * 40; }
    const sg = reg(new THREE.BufferGeometry()); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(sg, reg(new THREE.PointsMaterial({ color: "#ffffff", size: 0.07, transparent: true, opacity: 0.85, depthWrite: false })));
    add(this.snow);
  }

  apply(scene: THREE.Scene): void { scene.background = this.sky; scene.fog = this.fog; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const o: KolaOptions = ctx.beat.kola ?? {};
    const capped = o.capped !== false, pr = ctx.beat.cameraPreset as string;
    const section = pr === "kola_section" || pr === "kola_deep";
    this.rig.visible = !capped; this.cap.visible = true;
    // nắp mở: trượt ra sau trong ~0,9 s đầu beat; Kai nhảy xuống sau 1 s
    const opening = !!o.open, k = opening ? clamp(ctx.lt / 0.9) : 0;
    this.lid.visible = capped || opening;
    this.hole.visible = opening;
    this.lid.position.set(0, 0.28 * Math.sin(Math.PI * Math.min(k, 1)) , -0.95 * k);
    this.lid.rotation.x = -0.35 * Math.sin(Math.PI * k);
    const d = clamp(ctx.hud.depthKm, 0, DEPTH);
    this.snow.visible = !section; this.snow.position.y = -((ctx.t * 0.9) % 6); this.snow.position.x = Math.sin(ctx.t * 0.3) * 0.5;
    this.marker.group.position.set(0, -d, 0.75); this.marker.update(ctx.t);
    this.ms.visible = o.milestones !== false; this.cmp.visible = !!o.compare;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.15 * Math.sin(ctx.t * 2);

    if (section) character.root.visible = false;
    character.root.position.set(0, 0, 0); character.root.rotation.set(0, -0.3, 0);
    if (ctx.beat.characterAction === "jump_in" && !section) {
      // đứng cách miệng hố đúng 1 bước nhảy (jump_in tiến 1,1 theo hướng mặt), quay mặt về hố, chờ nắp mở rồi mới nhảy
      const c = this.cap.position, dir = new THREE.Vector3(c.x, 0, c.z).normalize();
      character.root.position.set(c.x - dir.x * 1.1, 0, c.z - dir.z * 1.1);
      character.root.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
      character.setAction("jump_in", opening ? Math.max(0, ctx.lt - 1.0) : ctx.lt, ctx.lp, ctx.t);
    }

    this.labelList = [];
    if (section) {
      const deep = pr === "kola_deep";
      if (o.milestones !== false) for (const [md, text] of MILESTONES) if (md > 0 && !(deep && o.label && Math.abs(md - d) < 0.6))
        this.labelList.push({ pos: new THREE.Vector3(SEC_X + (deep ? 0.6 : COL_W / 2 + 0.2), -md - (deep ? 0.3 : 0), 0.7), text });
      if (o.compare) {
        this.labelList.push({ pos: new THREE.Vector3(SEC_X - COL_W / 2 - 1.4, -8.849, 0.5), text: "エベレスト 8,849m" });
        this.labelList.push({ pos: new THREE.Vector3(SEC_X - COL_W / 2 - 2.6, -10.92, 0.5), text: "マリアナ海溝 10,920m" });
      }
      if (o.label) this.labelList.push({ pos: new THREE.Vector3(SEC_X, -d + (deep ? 0.75 : 0.5), 0.8), text: o.label });
      this.anchor.set(SEC_X, pr === "kola_deep" ? -d : -DEPTH / 2, 0);
    } else {
      if (o.label) this.labelList.push({ pos: this.cap.position.clone().add(new THREE.Vector3(0, 0.6, 0)), text: o.label });
      this.anchor.set(0, 0, 0);
    }
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return this.labelList; }

  dispose(): void { this.disposables.forEach(d => d.dispose()); }
}
