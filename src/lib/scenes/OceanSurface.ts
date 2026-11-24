import * as THREE from "three";
import type { CharacterLike, FrameCtx, ScenePrefab } from "../types";
import { rng } from "../math";
import { applyCameraPreset } from "./cameraPresets";
import { createGlowSpriteTexture } from "../textures";

/** sóng: [hướng (độ), bước sóng, biên độ, pha] */
const WAVES: [number, number, number, number][] = [
  [20, 19, 0.16, 0.0], [-35, 12, 0.1, 1.7], [75, 7.5, 0.06, 4.1], [-80, 5.2, 0.04, 2.3], [140, 3.9, 0.025, 5.2],
];
const WK = WAVES.map(([deg, L, A, ph]) => {
  const a = (deg * Math.PI) / 180, k = (2 * Math.PI) / L;
  return { dx: Math.cos(a) * k, dz: Math.sin(a) * k, w: Math.sqrt(9.8 * k) * 0.55, A, ph };
});
const heightAt = (x: number, z: number, t: number): number => {
  let h = 0; for (const s of WK) h += s.A * Math.sin(s.dx * x + s.dz * z - s.w * t + s.ph); return h;
};

const PALETTE = {
  night: { top: "#1a2335", horizon: "#4b5874", water: "#1c3352", light: "#e3ebff", lightI: 4.2, hemiSky: "#7d8fb6", hemiI: 1.0, glow: "#dfe8ff", fillI: 2.2, glowWater: "#13284a" },
  day: { top: "#3f86d8", horizon: "#cfe2f2", water: "#17588a", light: "#fff3df", lightI: 3.6, hemiSky: "#bcd8ff", hemiI: 1.2, glow: "#fff6d8", fillI: 2.0, glowWater: "#14466e" },
};

/** bản đồ pháp tuyến lặp liền (gợn sóng nhỏ, tạo vệt lấp lánh dưới ánh trăng) */
function rippleNormalMap(size = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"); if (!g) throw new Error("Canvas 2D không khả dụng");
  const R = rng(9), comps: [number, number, number, number][] = [];
  for (let i = 0; i < 28; i++) {
    const kx = Math.round((R() - 0.5) * 18), ky = Math.round((R() - 0.5) * 18);
    if (kx || ky) comps.push([kx, ky, 1 / Math.hypot(kx, ky), R() * Math.PI * 2]);
  }
  const h = (u: number, v: number) => { let s = 0; for (const [kx, ky, a, p] of comps) s += a * Math.sin(2 * Math.PI * (kx * u + ky * v) + p); return s; };
  const img = g.createImageData(size, size), e = 1 / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, hx = (h(u + e, v) - h(u - e, v)) * 0.9, hy = (h(u, v + e) - h(u, v - e)) * 0.9;
    const n = new THREE.Vector3(-hx, -hy, 1).normalize(), i = (y * size + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(36, 36); t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

/** Mặt biển (đêm/ngày) + phao cứu sinh hình tròn, nhân vật ngồi trong phao */
export class OceanSurface implements ScenePrefab {
  id = "ocean_surface" as const;
  root = new THREE.Group();
  private water: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private base: Float32Array;
  private boat = new THREE.Group();
  private moon = new THREE.DirectionalLight("#ffffff", 4);
  private hemi = new THREE.HemisphereLight("#ffffff", "#05070c", 0.6);
  /** đèn phụ phía trước để phao & nhân vật không bị tối */
  private fill = new THREE.DirectionalLight("#b9c6e6", 1.4);
  private glow: THREE.Sprite;
  private skies: Record<"night" | "day", THREE.CanvasTexture>;
  private fog = new THREE.Fog("#4b5874", 25, 120);
  private mode: "night" | "day" | "" = "";
  private normal: THREE.CanvasTexture;
  private disposables: { dispose(): void }[] = [];

  constructor() {
    const sky = (top: string, horizon: string) => {
      const c = document.createElement("canvas"); c.width = 16; c.height = 512;
      const g = c.getContext("2d"); if (!g) throw new Error("Canvas 2D không khả dụng");
      const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, top); gr.addColorStop(0.5, horizon); gr.addColorStop(1, horizon);
      g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; return t;
    };
    this.skies = { night: sky(PALETTE.night.top, PALETTE.night.horizon), day: sky(PALETTE.day.top, PALETTE.day.horizon) };
    this.disposables.push(this.skies.night, this.skies.day);

    // mặt nước: lưới dày, sóng tính mỗi khung hình
    this.normal = rippleNormalMap();
    const geo = new THREE.PlaneGeometry(170, 170, 230, 230); geo.rotateX(-Math.PI / 2);
    this.base = Float32Array.from(geo.attributes.position.array as Float32Array);
    // nước phản chiếu bầu trời (envMap) → không bị đen, có vệt sáng dưới trăng
    const mat = new THREE.MeshStandardMaterial({ color: PALETTE.night.water, roughness: 0.2, metalness: 0.35, envMap: this.skies.night, envMapIntensity: 1.1, normalMap: this.normal, normalScale: new THREE.Vector2(0.55, 0.55) });
    this.water = new THREE.Mesh(geo, mat); this.water.position.z = -40;
    this.root.add(this.water); this.disposables.push(geo, mat, this.normal);

    // quầng sáng trên trời (trăng/mặt trời sau mây)
    const glowTex = createGlowSpriteTexture();
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: PALETTE.night.glow, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
    this.glow = new THREE.Sprite(glowMat); this.glow.position.set(30, 30, -110); this.glow.scale.setScalar(70);
    this.root.add(this.glow); this.disposables.push(glowTex, glowMat);

    // phao tròn: ống phao cam + thành cabin + viền tối + dây trắng + cột ăng-ten
    const std = (color: string, roughness = 0.6) => { const m = new THREE.MeshStandardMaterial({ color, roughness }); this.disposables.push(m); return m; };
    const add = (geo2: THREE.BufferGeometry, m: THREE.Material, f?: (o: THREE.Mesh) => void) => { const o = new THREE.Mesh(geo2, m); f?.(o); this.boat.add(o); this.disposables.push(geo2); return o; };
    add(new THREE.TorusGeometry(1.32, 0.34, 24, 96), std("#c25f38", 0.55), o => { o.rotation.x = Math.PI / 2; o.position.y = 0.05; });
    add(new THREE.TorusGeometry(1.67, 0.022, 8, 120), std("#e9e4dc", 0.8), o => { o.rotation.x = Math.PI / 2; o.position.y = 0.04; });
    add(new THREE.CylinderGeometry(1.04, 1.1, 0.5, 64, 1, true), std("#b4583a", 0.6), o => { o.position.y = 0.3; (o.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; });
    add(new THREE.TorusGeometry(1.04, 0.065, 12, 96), std("#2b3036", 0.4), o => { o.rotation.x = Math.PI / 2; o.position.y = 0.56; });
    add(new THREE.CircleGeometry(1.05, 48), std("#7d4434", 0.8), o => { o.rotation.x = -Math.PI / 2; o.position.y = 0.12; });
    add(new THREE.CylinderGeometry(0.022, 0.022, 1.25, 8), std("#9aa0a8", 0.4), o => { o.position.set(0.95, 0.95, -0.55); });
    add(new THREE.BoxGeometry(0.12, 0.12, 0.08), std("#d9c49c", 0.7), o => { o.position.set(0.95, 1.62, -0.55); });
    this.root.add(this.boat);

    this.moon.position.set(10, 7, -40); this.moon.target.position.set(0, 0, 0);
    this.fill.position.set(3, 5, 12);
    this.root.add(this.moon, this.moon.target, this.hemi, this.fill);
  }

  private setMode(mode: "night" | "day"): void {
    if (mode === this.mode) return;
    this.mode = mode;
    const P = PALETTE[mode];
    this.water.material.color.set(P.water);
    this.water.material.envMap = this.skies[mode]; this.water.material.needsUpdate = true;
    this.fill.intensity = P.fillI;
    this.water.material.emissive.set(P.glowWater); // độ sáng tối thiểu của nước (không bị đen)
    this.moon.color.set(P.light); this.moon.intensity = P.lightI;
    this.hemi.color.set(P.hemiSky); this.hemi.intensity = P.hemiI;
    (this.glow.material as THREE.SpriteMaterial).color.set(P.glow);
    this.fog.color.set(P.horizon);
  }

  apply(scene: THREE.Scene): void { scene.background = this.skies[this.mode || "night"]; scene.fog = this.fog; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const mode = ctx.beat.ocean?.time === "day" ? "day" : "night";
    this.setMode(mode);
    const t = ctx.t;
    // sóng
    const pos = this.water.geometry.attributes.position as THREE.BufferAttribute, arr = pos.array as Float32Array, oz = this.water.position.z;
    for (let i = 0; i < arr.length; i += 3) arr[i + 1] = heightAt(this.base[i], this.base[i + 2] + oz, t);
    pos.needsUpdate = true; this.water.geometry.computeVertexNormals();
    this.normal.offset.set(t * 0.004, t * 0.0025);

    // phao nhấp nhô theo sóng
    const h = heightAt(0, 0, t), e = 0.6;
    const sx = (heightAt(e, 0, t) - heightAt(-e, 0, t)) / (2 * e), sz = (heightAt(0, e, t) - heightAt(0, -e, t)) / (2 * e);
    this.boat.position.set(0, h * 0.85 - 0.02, 0);
    this.boat.rotation.set(sz * 0.6, 0, -sx * 0.6);
    // nhân vật ngồi trong phao (thấy từ ngực trở lên)
    character.root.visible = true;
    character.root.position.set(-0.08, this.boat.position.y - 0.6, 0.05);
    character.root.rotation.set(this.boat.rotation.x, Math.sin(t * 0.3) * 0.08, this.boat.rotation.z);

    applyCameraPreset(camera, ctx.beat.cameraPreset, new THREE.Vector3(0, h * 0.5, 0), ctx.lp);
  }

  dispose(): void { this.disposables.forEach(d => d.dispose()); }
}
