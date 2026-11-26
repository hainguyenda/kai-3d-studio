import * as THREE from "three";
import type { CharacterLike, FrameCtx, ScenePrefab, SceneLabel } from "../types";
import { clamp, rng } from "../math";
import { createSkyTexture } from "../textures";
import { applyCameraPreset } from "./cameraPresets";

/*
  onsen_bath – bồn suối nóng lộ thiên (露天風呂) buổi tối, nước 黒湯 nâu sẫm của Tokyo.
  Kai ngâm mình tới cằm, khăn trắng trên đầu, hơi nước bốc lên, chậu gỗ + vịt cao su trôi.
  Tuỳ chọn beat.onsen: sign (chữ trên bảng gỗ), towel, label (chữ trên đầu Kai),
  boil (gag "アツッ": nước sủi bọt, hơi nước dày, Kai nhảy bật khỏi nước).
  Không đụng tới các cảnh khác.
*/

export interface OnsenBathOptions {
  /** chữ trên bảng gỗ, mặc định "♨ 地下1500mの湯" */
  sign?: string;
  /** khăn trên đầu Kai (mặc định true) */
  towel?: boolean;
  /** nhãn chữ trên đầu Kai */
  label?: string;
  /** nước sôi sục + Kai bật lên khỏi nước (gag nóng quá) */
  boil?: boolean;
}

const WATER_Y = 0.9;
const POOL_R = 2.6;

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class OnsenBath implements ScenePrefab {
  id = "onsen_bath" as const;
  root = new THREE.Group();
  private sky: THREE.Texture;
  private disposables: { dispose(): void }[] = [];
  private anchor = new THREE.Vector3();
  private water: THREE.Mesh;
  private steam: THREE.Points;
  private bubbles = new THREE.Group();
  private towel: THREE.Mesh;
  private tub = new THREE.Group();
  private duck = new THREE.Group();
  private signCanvas = document.createElement("canvas");
  private signTex: THREE.CanvasTexture;
  private signShown = "";
  private labelList: SceneLabel[] = [];

  constructor() {
    const reg = <T extends { dispose(): void }>(x: T) => { this.disposables.push(x); return x; };
    this.sky = reg(createSkyTexture("#1d2347", "#6b5476"));
    const mat = (o: THREE.MeshStandardMaterialParameters) => reg(new THREE.MeshStandardMaterial({ roughness: 0.85, ...o }));
    const box = reg(new THREE.BoxGeometry(1, 1, 1)), cyl = reg(new THREE.CylinderGeometry(1, 1, 1, 24));
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, s: [number, number, number], p: [number, number, number], parent: THREE.Object3D = this.root) => {
      const o = new THREE.Mesh(geo, m); o.scale.set(...s); o.position.set(...p); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
    };
    const r = rng(15);

    // sàn đá quanh bồn
    const floorTex = reg(canvasTex(512, 512, g => {
      g.fillStyle = "#4a4640"; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 70; i++) { g.fillStyle = `hsl(30,6%,${26 + r() * 16}%)`; const x = r() * 512, y = r() * 512, w = 50 + r() * 60; g.beginPath(); g.ellipse(x, y, w, w * (0.6 + r() * 0.3), r() * 3, 0, 7); g.fill(); }
    }));
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 3);
    // lỗ bồn: tường trong + đáy (sàn đá phủ lên mép nên che bằng vòng đá)
    const inner = new THREE.Mesh(reg(new THREE.CylinderGeometry(POOL_R, POOL_R, 1.2, 40, 1, true)), mat({ color: "#2b2622", side: THREE.BackSide }));
    inner.position.y = WATER_Y - 0.55; this.root.add(inner);
    const bottom = new THREE.Mesh(reg(new THREE.CircleGeometry(POOL_R, 40)), mat({ color: "#231e1a" }));
    bottom.rotation.x = -Math.PI / 2; bottom.position.y = -0.1; this.root.add(bottom);
    // sàn đá = vành khuyên bao quanh miệng bồn
    const ring = new THREE.Mesh(reg(new THREE.RingGeometry(POOL_R, 8, 48)), mat({ map: floorTex }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = WATER_Y + 0.05; ring.receiveShadow = true; this.root.add(ring);
    // vòng đá tảng quanh mép
    const rockG = reg(new THREE.DodecahedronGeometry(0.45, 0));
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2, rr = POOL_R + 0.1 + r() * 0.15;
      const rock = add(rockG, mat({ color: new THREE.Color().setHSL(0.08, 0.06, 0.28 + r() * 0.14), flatShading: true }), [0.9 + r() * 0.6, 0.55 + r() * 0.35, 0.9 + r() * 0.5], [Math.cos(a) * rr, WATER_Y + 0.1, Math.sin(a) * rr]);
      rock.rotation.set(r() * 3, r() * 3, r() * 3);
    }
    // nước 黒湯 (nâu hổ phách, đục)
    const waterTex = reg(canvasTex(256, 256, g => {
      const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, "#8a5a2c"); gr.addColorStop(1, "#4a2e16"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = "rgba(255,220,170,0.18)"; g.lineWidth = 2; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(128, 128, 14 + i * 13, 0, 7); g.stroke(); }
    }));
    this.water = new THREE.Mesh(reg(new THREE.CircleGeometry(POOL_R, 48)), reg(new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9, depthWrite: false })));
    this.water.rotation.x = -Math.PI / 2; this.water.position.y = WATER_Y; this.water.renderOrder = 3; this.root.add(this.water);

    // hàng rào tre phía sau + tre
    const fenceM = mat({ color: "#6f5a3a" });
    for (let i = -16; i <= 16; i++) add(cyl, fenceM, [0.09, 2.6 + (i % 2) * 0.15, 0.09], [i * 0.2, WATER_Y + 1.3, -4.2]);
    add(box, mat({ color: "#3d2f1e" }), [6.8, 0.08, 0.08], [0, WATER_Y + 1.9, -4.08]);
    add(box, mat({ color: "#3d2f1e" }), [6.8, 0.08, 0.08], [0, WATER_Y + 0.7, -4.08]);
    const bambooM = mat({ color: "#5f8f4a" }), leafM = mat({ color: "#3f7a3a" }), leafG = reg(new THREE.SphereGeometry(0.5, 10, 8));
    for (const [x, z] of [[-3.8, -3.6], [-4.3, -2.9], [3.9, -3.5], [4.4, -2.7]]) {
      add(cyl, bambooM, [0.06, 4.5, 0.06], [x, WATER_Y + 2.2, z]);
      for (let k = 0; k < 4; k++) add(leafG, leafM, [1.2, 0.35, 0.7], [x + (r() - 0.5) * 0.8, WATER_Y + 3.4 + k * 0.4, z + (r() - 0.5) * 0.6]);
    }
    // đèn lồng đá + ánh vàng
    const stoneM = mat({ color: "#8d877c" });
    const lan = new THREE.Group();
    add(cyl, stoneM, [0.18, 0.9, 0.18], [0, 0.45, 0], lan); add(box, stoneM, [0.6, 0.1, 0.6], [0, 0.95, 0], lan);
    add(box, reg(new THREE.MeshBasicMaterial({ color: "#ffcf7a", toneMapped: false })), [0.36, 0.3, 0.36], [0, 1.15, 0], lan);
    add(reg(new THREE.ConeGeometry(0.5, 0.35, 4)), stoneM, [1, 1, 1], [0, 1.45, 0], lan);
    const lanLight = new THREE.PointLight("#ffbf66", 6, 9); lanLight.position.set(0, 1.15, 0); lan.add(lanLight);
    lan.position.set(-3.3, WATER_Y + 0.05, -1.4); this.root.add(lan);
    // bảng gỗ "♨ 地下1500mの湯"
    this.signCanvas.width = 512; this.signCanvas.height = 160;
    this.signTex = reg(new THREE.CanvasTexture(this.signCanvas)); this.signTex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(reg(new THREE.PlaneGeometry(2.4, 0.75)), reg(new THREE.MeshStandardMaterial({ map: this.signTex, roughness: 0.9 })));
    sign.position.set(1.6, WATER_Y + 2.35, -4.0); this.root.add(sign);
    add(cyl, mat({ color: "#4a3824" }), [0.05, 1.6, 0.05], [0.55, WATER_Y + 1.6, -4.05]); add(cyl, mat({ color: "#4a3824" }), [0.05, 1.6, 0.05], [2.65, WATER_Y + 1.6, -4.05]);

    // chậu gỗ (桶) + vịt cao su trôi
    const okeM = mat({ color: "#c79a5e" });
    add(reg(new THREE.CylinderGeometry(0.28, 0.24, 0.26, 20)), okeM, [1, 1, 1], [0, 0, 0], this.tub);
    add(reg(new THREE.TorusGeometry(0.27, 0.02, 6, 20)), mat({ color: "#3a3a3a" }), [1, 1, 1], [0, 0.05, 0], this.tub).rotation.x = Math.PI / 2;
    this.root.add(this.tub);
    const duckM = mat({ color: "#ffd21f", roughness: 0.4 });
    add(reg(new THREE.SphereGeometry(0.16, 16, 12)), duckM, [1.2, 0.8, 1], [0, 0, 0], this.duck);
    add(reg(new THREE.SphereGeometry(0.1, 16, 12)), duckM, [1, 1, 1], [0.12, 0.13, 0], this.duck);
    add(reg(new THREE.ConeGeometry(0.04, 0.09, 10)), mat({ color: "#ff7a1a" }), [1, 1, 1], [0.24, 0.12, 0], this.duck).rotation.z = -Math.PI / 2;
    this.root.add(this.duck);

    // khăn trắng gấp trên đầu Kai
    this.towel = new THREE.Mesh(reg(new THREE.BoxGeometry(0.46, 0.07, 0.3)), mat({ color: "#f7f7f2", roughness: 1 }));
    this.towel.castShadow = true; this.root.add(this.towel);

    // hơi nước
    const N = 160, sp = new Float32Array(N * 3);
    const sg = reg(new THREE.BufferGeometry()); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const steamTex = reg(canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }));
    this.steam = new THREE.Points(sg, reg(new THREE.PointsMaterial({ map: steamTex, color: "#ffffff", size: 0.9, transparent: true, opacity: 0.35, depthWrite: false })));
    this.steam.renderOrder = 4; this.root.add(this.steam);
    // bong bóng (khi boil)
    const bubG = reg(new THREE.SphereGeometry(0.07, 10, 8)), bubM = reg(new THREE.MeshStandardMaterial({ color: "#c89060", roughness: 0.2, transparent: true, opacity: 0.85 }));
    for (let i = 0; i < 40; i++) this.bubbles.add(new THREE.Mesh(bubG, bubM));
    this.root.add(this.bubbles);

    const moon = new THREE.Mesh(reg(new THREE.SphereGeometry(0.6, 20, 14)), reg(new THREE.MeshBasicMaterial({ color: "#fff4cf", toneMapped: false })));
    moon.position.set(-6, 9, -14); this.root.add(moon);
    const key = new THREE.DirectionalLight("#cdd6ff", 1.3); key.position.set(4, 8, 6); key.castShadow = true;
    const hemi = new THREE.HemisphereLight("#a8a6d8", "#4a3a2e", 1.0);
    const warm = new THREE.PointLight("#ffb070", 3, 7); warm.position.set(1.5, WATER_Y + 1.2, 2.2);
    this.root.add(key, hemi, warm);
  }

  private drawSign(text: string): void {
    const g = this.signCanvas.getContext("2d")!;
    g.fillStyle = "#7a5530"; g.fillRect(0, 0, 512, 160);
    g.strokeStyle = "rgba(40,25,10,0.35)"; for (let i = 0; i < 30; i++) { g.beginPath(); g.moveTo(0, i * 6); g.lineTo(512, i * 6 + Math.sin(i) * 3); g.stroke(); }
    g.strokeStyle = "#3b2612"; g.lineWidth = 10; g.strokeRect(5, 5, 502, 150);
    g.fillStyle = "#fff6e6"; g.textAlign = "center"; g.textBaseline = "middle";
    let size = 78; g.font = `bold ${size}px sans-serif`;
    while (g.measureText(text).width > 470 && size > 30) { size -= 4; g.font = `bold ${size}px sans-serif`; }
    g.fillText(text, 256, 84);
    this.signTex.needsUpdate = true;
  }

  apply(scene: THREE.Scene): void { scene.background = this.sky; scene.fog = null; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const o: OnsenBathOptions = ctx.beat.onsen ?? {};
    const sign = o.sign ?? "♨ 地下1500mの湯";
    if (sign !== this.signShown) { this.drawSign(sign); this.signShown = sign; }
    const t = ctx.t, boil = !!o.boil;

    // Kai ngâm tới cằm; boil → bật lên khỏi nước rồi rơi lại
    const jumpK = boil ? Math.max(0, Math.sin(Math.PI * clamp((ctx.lt - 0.4) / 0.9))) : 0;
    const bob = Math.sin(t * 1.4) * 0.025;
    const y = -0.47 + bob + jumpK * 1.25;
    character.root.visible = true;
    character.root.position.set(0, y, 0.3);
    character.root.rotation.set(0, 0, 0);
    this.towel.visible = o.towel !== false;
    this.towel.position.set(0.02, y + 2.08, 0.3 - 0.02);
    this.towel.rotation.set(0.05, 0, Math.sin(t * 1.4) * 0.04 - jumpK * 0.4);

    // nước gợn, sủi khi boil
    const wm = this.water.material as THREE.MeshStandardMaterial;
    wm.color.setRGB(1, boil ? 0.78 : 1, boil ? 0.7 : 1);
    this.water.position.y = WATER_Y + Math.sin(t * 2) * 0.008;
    this.tub.position.set(1.35 + Math.sin(t * 0.5) * 0.3, WATER_Y + 0.03 + Math.sin(t * 2.2) * 0.02, 0.9 + Math.cos(t * 0.4) * 0.2);
    this.tub.rotation.y = t * 0.3;
    this.duck.position.set(-1.1 + Math.sin(t * 0.6 + 1) * 0.35, WATER_Y + 0.07 + Math.sin(t * 2.6) * 0.02 + (boil ? Math.abs(Math.sin(t * 9)) * 0.08 : 0), 1.0 + Math.sin(t * 0.45) * 0.25);
    this.duck.rotation.y = Math.sin(t * 0.7) * 0.8;
    this.bubbles.visible = boil;
    if (boil) this.bubbles.children.forEach((b, i) => {
      const ph = (t * 1.6 + i * 0.137) % 1, a = i * 2.39, rr = 0.5 + ((i * 0.618) % 1) * 1.9;
      b.position.set(Math.cos(a) * rr, WATER_Y + 0.02 + ph * 0.06, Math.sin(a) * rr); b.scale.setScalar(0.4 + Math.sin(Math.PI * ph) * 0.9);
    });

    // hơi nước bốc lên (dày hơn khi boil)
    const arr = (this.steam.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const N = arr.length / 3, speed = boil ? 0.55 : 0.22;
    for (let i = 0; i < N; i++) {
      const ph = (t * speed + i / N) % 1, a = i * 2.39996, rr = ((i * 0.618) % 1) * (POOL_R - 0.2);
      arr[i * 3] = Math.cos(a) * rr + Math.sin(i * 1.7 + t * 0.8) * 0.3 * ph;
      arr[i * 3 + 1] = WATER_Y + 0.1 + ph * (boil ? 3.2 : 2.2);
      arr[i * 3 + 2] = Math.sin(a) * rr;
    }
    this.steam.geometry.attributes.position.needsUpdate = true;
    (this.steam.material as THREE.PointsMaterial).opacity = boil ? 0.55 : 0.32;

    this.labelList = [];
    if (o.label) this.labelList.push({ pos: new THREE.Vector3(0, y + 2.45, 0.3), text: o.label });
    this.anchor.set(0, 0, 0.3);
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return this.labelList; }

  dispose(): void { this.disposables.forEach(d => d.dispose()); }
}
