import * as THREE from "three";
import type { CharacterLike, FrameCtx, ScenePrefab, SceneLabel } from "../types";
import { clamp, rng } from "../math";
import { createSkyTexture } from "../textures";
import { applyCameraPreset } from "./cameraPresets";

/*
  gravity_room – phòng khách kiểu Nhật để minh hoạ trọng lực thay đổi.
  Kai đứng trên cân sức khoẻ lớn; mặt cân hiện số kg = weightKg × g (g chạy gFrom → gTo trong beat).
  Tường có thước đo chiều cao nhảy; đèn treo, cây cảnh rủ xuống khi g > 1.
*/

export interface GravityRoomOptions {
  /** hệ số trọng lực (1 = Trái Đất). Có gFrom thì chạy gFrom → g trong beat */
  g?: number;
  gFrom?: number;
  /** khối lượng người trên cân (kg), mặc định 60 */
  weightKg?: number;
  /** nhãn chữ trên đầu Kai */
  label?: string;
  /** cân vỡ khi số ≥ 115 kg (gag "バキッ") */
  breakScale?: boolean;
  /** ẩn số trên cân */
  hideScale?: boolean;
}

const ease = (x: number) => x * x * (3 - 2 * x);

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class GravityRoom implements ScenePrefab {
  id = "gravity_room" as const;
  root = new THREE.Group();
  private sky: THREE.Texture;
  private dialCanvas = document.createElement("canvas");
  private dialTex: THREE.CanvasTexture;
  private needle = new THREE.Group();
  private lamp = new THREE.Group();
  private plant = new THREE.Group();
  private shown = -1;
  private labelList: SceneLabel[] = [];
  private disposables: { dispose(): void }[] = [];
  private anchor = new THREE.Vector3();

  constructor() {
    const reg = <T extends { dispose(): void }>(x: T) => { this.disposables.push(x); return x; };
    this.sky = reg(createSkyTexture("#7fb6e6", "#e8f2f8"));
    const mat = (o: THREE.MeshStandardMaterialParameters) => reg(new THREE.MeshStandardMaterial({ roughness: 0.8, ...o }));
    const box = reg(new THREE.BoxGeometry(1, 1, 1)), cyl = reg(new THREE.CylinderGeometry(1, 1, 1, 24));
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, s: [number, number, number], p: [number, number, number], parent: THREE.Object3D = this.root) => {
      const o = new THREE.Mesh(geo, m); o.scale.set(...s); o.position.set(...p); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
    };
    // sàn gỗ
    const floorTex = reg(canvasTex(512, 512, g => {
      const r = rng(3);
      for (let i = 0; i < 8; i++) { g.fillStyle = `hsl(30,${35 + r() * 10}%,${52 + r() * 8}%)`; g.fillRect(0, i * 64, 512, 64); g.fillStyle = "rgba(60,35,15,0.35)"; g.fillRect(0, i * 64, 512, 2); }
      for (let i = 0; i < 300; i++) { g.strokeStyle = `rgba(90,55,25,${0.05 + r() * 0.1})`; const y = r() * 512; g.beginPath(); g.moveTo(r() * 512, y); g.lineTo(r() * 512, y + (r() - 0.5) * 4); g.stroke(); }
    }));
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 3);
    const floor = new THREE.Mesh(reg(new THREE.PlaneGeometry(12, 12)), mat({ map: floorTex })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.root.add(floor);
    // tường
    const wallM = mat({ color: "#efe6d6", roughness: 0.95 });
    add(box, wallM, [12, 4, 0.2], [0, 2, -3.5]);
    add(box, wallM, [0.2, 4, 12], [-4.5, 2, 0]);
    add(box, mat({ color: "#8a6a4a" }), [12, 0.15, 0.05], [0, 0.08, -3.38]); // len chân tường
    // cửa sổ (trời + phố)
    const outside = new THREE.Mesh(reg(new THREE.PlaneGeometry(3.2, 1.9)), reg(new THREE.MeshBasicMaterial({ map: reg(canvasTex(512, 300, g => {
      const gr = g.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, "#6fb0e8"); gr.addColorStop(1, "#d8ecf7"); g.fillStyle = gr; g.fillRect(0, 0, 512, 300);
      const r = rng(9); for (let i = 0; i < 14; i++) { const w = 30 + r() * 50, h = 60 + r() * 150, x = i * 38 - 10; g.fillStyle = `hsl(210,10%,${55 + r() * 25}%)`; g.fillRect(x, 300 - h, w, h); }
      g.fillStyle = "rgba(255,255,255,0.8)"; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(60 + i * 100, 40 + (i % 2) * 25, 40, 12, 0, 0, 7); g.fill(); }
    })), toneMapped: false })));
    outside.position.set(1.2, 2.1, -3.39); this.root.add(outside);
    const frameM = mat({ color: "#6b4a2e" });
    add(box, frameM, [3.4, 0.1, 0.1], [1.2, 3.1, -3.35]); add(box, frameM, [3.4, 0.1, 0.1], [1.2, 1.1, -3.35]);
    for (const x of [-0.5, 1.2, 2.9]) add(box, frameM, [0.08, 2.0, 0.1], [x, 2.1, -3.35]);
    // thước đo chiều cao trên tường trái (để minh hoạ nhảy)
    const ruler = new THREE.Mesh(reg(new THREE.PlaneGeometry(0.5, 2.6)), reg(new THREE.MeshBasicMaterial({ map: reg(canvasTex(128, 664, g => {
      g.fillStyle = "#fff8e0"; g.fillRect(0, 0, 128, 664);
      for (let cm = 0; cm <= 260; cm += 5) { const y = 664 - cm * 2.55; g.fillStyle = "#333"; g.fillRect(0, y, cm % 50 === 0 ? 70 : cm % 10 === 0 ? 45 : 25, 2); if (cm % 50 === 0 && cm > 0) { g.font = "bold 26px sans-serif"; g.fillText(`${cm}`, 72, y + 9); } }
    })) })));
    ruler.rotation.y = Math.PI / 2; ruler.position.set(-4.38, 1.3, -0.6); this.root.add(ruler);
    // ghế sofa + bàn thấp + kệ sách
    const sofa = mat({ color: "#5d7a8c" });
    add(box, sofa, [2.4, 0.45, 0.9], [-2.6, 0.32, -2.7]); add(box, sofa, [2.4, 0.7, 0.25], [-2.6, 0.75, -3.15]);
    add(box, sofa, [0.25, 0.6, 0.9], [-3.7, 0.5, -2.7]); add(box, sofa, [0.25, 0.6, 0.9], [-1.5, 0.5, -2.7]);
    const wood = mat({ color: "#8b5e3c" });
    add(box, wood, [1.4, 0.06, 0.8], [-2.4, 0.4, -1.4]);
    for (const [x, z] of [[-3, -1.7], [-1.8, -1.7], [-3, -1.1], [-1.8, -1.1]]) add(box, wood, [0.06, 0.37, 0.06], [x, 0.19, z]);
    add(cyl, mat({ color: "#ffffff" }), [0.07, 0.12, 0.07], [-2.2, 0.49, -1.3]);
    add(box, wood, [1.2, 2.2, 0.4], [3.6, 1.1, -3.2]);
    const r = rng(4);
    for (let s = 0; s < 4; s++) { add(box, wood, [1.15, 0.04, 0.38], [3.6, 0.3 + s * 0.55, -3.15]); for (let b = 0; b < 7; b++) add(box, mat({ color: `hsl(${r() * 360},45%,45%)` }), [0.12, 0.38 + r() * 0.08, 0.3], [3.15 + b * 0.14, 0.52 + s * 0.55, -3.12]); }
    // đèn treo (dây dài ra khi g lớn)
    add(cyl, mat({ color: "#222" }), [0.01, 1, 0.01], [0, -0.5, 0], this.lamp);
    const shade = add(reg(new THREE.ConeGeometry(0.35, 0.3, 24, 1, true)), mat({ color: "#f3d9a0", side: THREE.DoubleSide, emissive: "#ffcc77", emissiveIntensity: 0.4 }), [1, 1, 1], [0, -1.1, 0], this.lamp);
    shade.castShadow = false;
    this.lamp.position.set(0.8, 4, -1.2); this.root.add(this.lamp);
    // cây cảnh (lá rủ xuống khi g lớn)
    add(cyl, mat({ color: "#b5643c" }), [0.25, 0.45, 0.25], [0, 0.22, 0], this.plant);
    const leafG = reg(new THREE.SphereGeometry(0.16, 10, 8)), leafM = mat({ color: "#3f8a4a" });
    for (let i = 0; i < 7; i++) { const pivot = new THREE.Group(); pivot.position.y = 0.45; pivot.rotation.y = (i / 7) * Math.PI * 2; const leaf = new THREE.Mesh(leafG, leafM); leaf.scale.set(0.8, 0.35, 2.2); leaf.position.set(0, 0.25, 0.32); leaf.castShadow = true; pivot.add(leaf); this.plant.add(pivot); }
    this.plant.position.set(2.6, 0, -2.4); this.root.add(this.plant);
    // cân sức khoẻ lớn
    add(box, mat({ color: "#f4f6f8", roughness: 0.4 }), [1.2, 0.1, 1.15], [0, 0.05, 0.05]);
    add(box, mat({ color: "#cfd6dc", roughness: 0.5 }), [0.8, 0.012, 0.42], [0, 0.106, -0.15]);
    this.dialCanvas.width = 512; this.dialCanvas.height = 256;
    this.dialTex = reg(new THREE.CanvasTexture(this.dialCanvas)); this.dialTex.colorSpace = THREE.SRGBColorSpace;
    const dial = new THREE.Mesh(reg(new THREE.PlaneGeometry(1.0, 0.45)), reg(new THREE.MeshBasicMaterial({ map: this.dialTex, toneMapped: false })));
    dial.rotation.x = -Math.PI / 2; dial.position.set(0, 0.104, 0.36); this.root.add(dial);
    // thảm
    const rug = new THREE.Mesh(reg(new THREE.CircleGeometry(2.2, 48)), mat({ color: "#c9b48a" })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.005, 0.1); rug.receiveShadow = true; this.root.add(rug);

    const sun = new THREE.DirectionalLight("#fff3e0", 2.0); sun.position.set(3, 6, 5); sun.castShadow = true;
    const hemi = new THREE.HemisphereLight("#fff8ee", "#7a6650", 1.1);
    const lampLight = new THREE.PointLight("#ffd28a", 4, 6); lampLight.position.set(0, -1.2, 0); this.lamp.add(lampLight);
    this.root.add(sun, hemi);
  }

  private drawDial(kg: number, broken = false): void {
    const g = this.dialCanvas.getContext("2d")!; const W = 512, H = 256;
    g.fillStyle = "#1d2a33"; g.fillRect(0, 0, W, H);
    g.fillStyle = kg > 90 ? "#ff6b4a" : "#7dffb0"; g.font = "bold 150px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(`${kg}`, W / 2 - 40, H / 2 + 8);
    g.font = "bold 70px sans-serif"; g.fillStyle = "#e8eef2"; g.fillText("kg", W - 70, H / 2 + 30);
    if (broken) {
      g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 4;
      const cx = 330, cy = 90; for (let i = 0; i < 9; i++) { let a = i * 0.7, x = cx, y = cy; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 5; j++) { a += Math.sin(i * 7 + j) * 0.5; x += Math.cos(a) * 34; y += Math.sin(a) * 34; g.lineTo(x, y); } g.stroke(); }
      g.fillStyle = "#ff3b3b"; g.font = "bold 46px sans-serif"; g.fillText("ERROR", 120, 40);
    }
    this.dialTex.needsUpdate = true;
  }

  apply(scene: THREE.Scene): void { scene.background = this.sky; scene.fog = null; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const o: GravityRoomOptions = ctx.beat.grav ?? {};
    const g1 = o.g ?? 1, g0 = o.gFrom ?? g1, g = g0 + (g1 - g0) * ease(clamp(ctx.lp * 1.6 - 0.1));
    const kg = Math.round((o.weightKg ?? 60) * g);
    const broken = !!o.breakScale && kg >= 115, key = kg + (broken ? 10000 : 0);
    if (key !== this.shown) { this.drawDial(kg, broken); this.shown = key; }
    // đèn: dây dài ra & đung đưa nhẹ; cây: lá rủ
    const k = clamp(g - 1, 0, 2);
    (this.lamp.children[0] as THREE.Mesh).scale.y = 1 + k * 0.25; (this.lamp.children[0] as THREE.Mesh).position.y = -0.5 - k * 0.125;
    (this.lamp.children[1] as THREE.Mesh).position.y = -1.1 - k * 0.25;
    this.lamp.rotation.z = Math.sin(ctx.t * 1.6) * 0.02;
    this.plant.children.slice(1).forEach(p => { (p as THREE.Group).children[0].rotation.x = 0.1 + k * 0.6; });

    character.root.position.set(0, 0.11, -0.3);
    character.root.rotation.set(0, 0, 0);
    if (ctx.beat.characterAction === "jump_low") character.root.position.set(-3.6, 0, -0.6), character.root.rotation.set(0, 0.6, 0);

    this.labelList = [];
    if (!o.hideScale && (ctx.beat.cameraPreset as string) === "grav_scale") this.labelList.push({ pos: new THREE.Vector3(0, 0.15, 0.62), text: `体重 ${kg}kg` });
    if (o.label) this.labelList.push({ pos: character.root.position.clone().add(new THREE.Vector3(0, 2.15, 0)), text: o.label });
    const pr = ctx.beat.cameraPreset as string;
    this.anchor.copy(pr === "grav_jump" ? new THREE.Vector3(-3.6, 0, -0.6) : new THREE.Vector3(0, 0, 0));
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return this.labelList; }

  dispose(): void { this.disposables.forEach(d => d.dispose()); }
}
