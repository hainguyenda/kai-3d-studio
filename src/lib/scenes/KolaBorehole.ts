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
  /** hiện các mốc phát hiện trên mặt cắt (mặc định bật) */
  milestones?: boolean;
  /** nhãn tuỳ ý gắn vào chấm vị trí (mặt cắt) hoặc nắp giếng (hiện trường) */
  label?: string;
  /** mặt cắt: so sánh với Everest (8.849 m) và rãnh Mariana (10.920 m) */
  compare?: boolean;
}

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
    const conc = reg(new THREE.MeshStandardMaterial({ color: "#8d8a84", roughness: 0.95 }));
    const dark = reg(new THREE.MeshStandardMaterial({ color: "#1e1f22", roughness: 1 }));
    const box = reg(new THREE.BoxGeometry(1, 1, 1));
    const bld = (x: number, z: number, w: number, h: number, d: number) => {
      const b = new THREE.Mesh(box, conc); b.scale.set(w, h, d); b.position.set(x, h / 2, z); b.castShadow = true; this.root.add(b);
      for (let i = 0; i < Math.floor(w / 2.2); i++) for (let j = 0; j < Math.floor(h / 2.6); j++) {
        const wnd = new THREE.Mesh(box, dark); wnd.scale.set(1, 1.2, 0.1); wnd.position.set(x - w / 2 + 1.4 + i * 2.2, 1.6 + j * 2.6, z + d / 2 + 0.02); this.root.add(wnd);
      }
    };
    bld(-14, -16, 14, 7, 8); bld(4, -20, 9, 11, 7); bld(14, -14, 6, 4, 6);
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
    this.cap.add(pad, flange, top);
    const boltGeo = reg(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, b = new THREE.Mesh(boltGeo, rust); b.position.set(Math.cos(a) * 0.34, 0.14, Math.sin(a) * 0.34); this.cap.add(b); }
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

  apply(scene: THREE.Scene): void { scene.background = this.sky; scene.fog = this.fog; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const o: KolaOptions = ctx.beat.kola ?? {};
    const capped = o.capped !== false, pr = ctx.beat.cameraPreset as string;
    const section = pr === "kola_section" || pr === "kola_deep";
    this.rig.visible = !capped; this.cap.visible = true;
    (this.cap.children[1] as THREE.Mesh).visible = (this.cap.children[2] as THREE.Mesh).visible = capped;
    const d = clamp(ctx.hud.depthKm, 0, DEPTH);
    this.marker.group.position.set(0, -d, 0.75); this.marker.update(ctx.t);
    this.ms.visible = o.milestones !== false; this.cmp.visible = !!o.compare;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.15 * Math.sin(ctx.t * 2);

    if (section) character.root.visible = false;
    character.root.position.set(0, 0, 0); character.root.rotation.set(0, -0.3, 0);

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
