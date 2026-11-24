import * as THREE from "three";
import type { CameraPreset, CharacterLike, FrameCtx, ScenePrefab, SceneLabel } from "../types";
import { clamp, lerp, rng } from "../math";
import { createEarthTexture, fbm3 } from "../textures";
import { earthAssets } from "../earthAssets";
import { applyCameraPreset } from "./cameraPresets";
import { PulseMarker } from "./markers";
import { createTokyoScenes } from "./TokyoScenes";
import { createSkyScenes } from "./SkyScenes";
import { createPlanScenes } from "./PlanScenes";
import { GravityTrain } from "./GravityTrain";
import { KolaBorehole } from "./KolaBorehole";
import { GravityRoom } from "./GravityRoom";

/* =====================================================================
   3 BỐI CẢNH MỚI (bản ví dụ – chưa gắn vào app)
   - moon_surface      : đứng trên Mặt Trăng, Trái Đất treo trên trời đen
   - earth_moon_space  : Trái Đất ↔ Mặt Trăng ĐÚNG TỈ LỆ khoảng cách, chấm đi dọc đường
   - deep_sea          : lặn xuống biển sâu, màu nước & ánh sáng đổi theo độ sâu, cá voi xanh
   Mọi chuyển động chỉ phụ thuộc thời gian (t / lt / lp) → xuất MP4 ổn định như các cảnh cũ.
   Cách gắn vào app: xem README trong cùng thư mục.
   ===================================================================== */

import { type NewBeatFields, type NewCameraPreset, type NewSceneId } from "./newScenesData";
export type { NewBeatFields, NewCameraPreset, NewSceneId } from "./newScenesData";

const opts = <K extends keyof NewBeatFields>(ctx: FrameCtx, k: K): NonNullable<NewBeatFields[K]> =>
  ((ctx.beat as unknown as NewBeatFields)[k] ?? {}) as NonNullable<NewBeatFields[K]>;

/* ---------- tiện ích dùng chung ---------- */

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); if (!g) throw new Error("Canvas 2D không khả dụng");
  draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** bầu trời sao cố định (seed) */
export function starField(count: number, r0: number, r1: number, seed: number, size = 0.5): THREE.Points {
  const R = rng(seed), pos: number[] = [], col: number[] = [];
  for (let i = 0; i < count; i++) {
    const th = R() * Math.PI * 2, ph = Math.acos(2 * R() - 1), r = lerp(r0, r1, R());
    pos.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
    const b = 0.55 + R() * 0.45, warm = R() < 0.2;
    col.push(b, b * (warm ? 0.9 : 1), b * (warm ? 0.75 : 1));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size, sizeAttenuation: true, vertexColors: true, toneMapped: false, depthWrite: false }));
}

/** quả cầu Trái Đất dùng ảnh vệ tinh của app (nếu tải được), không thì bản đồ tự sinh */
export function makeEarth(radius: number, disposables: { dispose(): void }[]): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: "#2a5d93", roughness: 0.8 });
  const geo = new THREE.SphereGeometry(radius, 96, 64);
  g.add(new THREE.Mesh(geo, mat));
  const cloudMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.55, depthWrite: false, visible: false });
  const cloudGeo = new THREE.SphereGeometry(radius * 1.01, 64, 48);
  g.add(new THREE.Mesh(cloudGeo, cloudMat));
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color("#6fb6ff") } },
    vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 color; varying vec3 vN; varying vec3 vV; void main(){ float i = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), 4.0) * 0.9; gl_FragColor = vec4(color * i, 1.0); }",
    side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  const atmoGeo = new THREE.SphereGeometry(radius * 1.025, 48, 32);
  g.add(new THREE.Mesh(atmoGeo, atmoMat));
  disposables.push(mat, geo, cloudMat, cloudGeo, atmoMat, atmoGeo);
  const assets = earthAssets();
  assets.onLoad(() => {
    if (assets.day) { mat.map = assets.day; mat.emissiveMap = assets.day; mat.emissive.set("#ffffff"); mat.emissiveIntensity = 0.18; mat.color.set("#ffffff"); if (assets.normal) mat.normalMap = assets.normal; }
    else { const t = createEarthTexture(7); mat.map = t.map; mat.emissiveMap = t.map; mat.emissive.set("#ffffff"); mat.emissiveIntensity = 0.18; mat.color.set("#ffffff"); disposables.push(t.map, t.bump, t.rough); }
    if (assets.clouds) { cloudMat.map = assets.clouds; cloudMat.visible = true; cloudMat.needsUpdate = true; }
    mat.needsUpdate = true;
  });
  return g;
}

/** ảnh bề mặt Mặt Trăng tự sinh (biển tối + hố sáng) cho quả cầu nhìn từ xa */
function moonGlobeTexture(): THREE.CanvasTexture {
  const W = 1024, H = 512;
  return canvasTex(W, H, g => {
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const lon = (x / W) * Math.PI * 2, lat = (y / H) * Math.PI;
      const px = Math.sin(lat) * Math.cos(lon), py = Math.cos(lat), pz = Math.sin(lat) * Math.sin(lon);
      const maria = fbm3(px * 1.6, py * 1.6, pz * 1.6, 31, 4);
      const fine = fbm3(px * 9, py * 9, pz * 9, 77, 4);
      let v = 175 + (fine - 0.5) * 60 - (maria > 0.56 ? (maria - 0.56) * 420 : 0);
      v = clamp(v, 60, 225);
      const i = (y * W + x) * 4; img.data[i] = v; img.data[i + 1] = v * 0.98; img.data[i + 2] = v * 0.95; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const R = rng(5);
    for (let k = 0; k < 220; k++) {
      const x = R() * W, y = H * 0.1 + R() * H * 0.8, r = 2 + Math.pow(R(), 3) * 26;
      g.strokeStyle = `rgba(235,235,230,${0.25 + R() * 0.35})`; g.lineWidth = Math.max(1, r * 0.18);
      g.beginPath(); g.ellipse(x, y, r, r * 0.9, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "rgba(40,40,40,0.18)"; g.beginPath(); g.ellipse(x + r * 0.15, y + r * 0.1, r * 0.75, r * 0.65, 0, 0, Math.PI * 2); g.fill();
    }
  });
}

/* =====================================================================
   1. MẶT TRĂNG – mặt đất xám nhiều hố, bóng đổ dài, Trái Đất trên trời
   ===================================================================== */
export class MoonSurface implements ScenePrefab {
  id = "moon_surface" as const;
  root = new THREE.Group();
  private anchor = new THREE.Vector3(0, 0, 0);
  private sun = new THREE.DirectionalLight("#fffaf0", 4.2);
  private earthLight = new THREE.DirectionalLight("#8fb8ff", 0.25);
  private hemi = new THREE.HemisphereLight("#9aa4b8", "#202024", 0.18);
  private earth: THREE.Group;
  private prints = new THREE.Group();
  private dust: THREE.Points;
  private dustBase: Float32Array;
  private bg = new THREE.Color("#000000");
  private labelList: SceneLabel[] = [];
  private disposables: { dispose(): void }[] = [];

  constructor() {
    // mặt đất: lưới 140×140 m, hố thiên thạch + gợn nhỏ, phẳng quanh chỗ Kai đứng
    const size = 140, seg = 220, geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const R = rng(42);
    const craters: [number, number, number, number][] = [];
    for (let i = 0; i < 70; i++) {
      const r = 0.8 + Math.pow(R(), 2.2) * 11, x = (R() - 0.5) * size, z = -R() * size * 0.5 + 8;
      if (Math.hypot(x, z) < r + 3) continue;
      craters.push([x, z, r, r * (0.16 + R() * 0.1)]);
    }
    craters.push([-7, -9, 5.5, 1.1], [9, -22, 9, 1.8], [4, 3.5, 1.4, 0.25]);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      let h = (fbm3(x * 0.06, 0, z * 0.06, 3, 4) - 0.5) * 2.4 + (fbm3(x * 0.6, 1, z * 0.6, 9, 3) - 0.5) * 0.18;
      for (const [cx, cz, r, d] of craters) {
        const q = Math.hypot(x - cx, z - cz) / r;
        if (q < 1) h -= d * (1 - q * q);
        h += d * 0.45 * Math.exp(-Math.pow((q - 1) / 0.18, 2));
      }
      const flat = clamp((Math.hypot(x, z) - 2.2) / 5);   // 0 ở chỗ Kai đứng → không lún / không lơ lửng
      p.setY(i, h * flat);
    }
    geo.computeVertexNormals();
    const regolith = canvasTex(512, 512, g => {
      const img = g.createImageData(512, 512), Rr = rng(11);
      for (let i = 0; i < img.data.length; i += 4) { const v = 120 + (Rr() - 0.5) * 70; img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v * 0.97; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0);
      for (let k = 0; k < 260; k++) { g.fillStyle = `rgba(${Rr() < 0.5 ? "40,40,40" : "210,210,205"},${0.15 + Rr() * 0.3})`; g.beginPath(); g.arc(Rr() * 512, Rr() * 512, 0.6 + Rr() * 2.4, 0, Math.PI * 2); g.fill(); }
    }, true);
    regolith.repeat.set(40, 40);
    const groundMat = new THREE.MeshStandardMaterial({ color: "#b7b4ae", map: regolith, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(geo, groundMat); ground.receiveShadow = true;
    this.root.add(ground);
    this.disposables.push(geo, groundMat, regolith);

    // đá rải rác
    const rockGeo = new THREE.DodecahedronGeometry(1, 1), rockMat = new THREE.MeshStandardMaterial({ color: "#8d8a85", roughness: 1, flatShading: true });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 90), m = new THREE.Matrix4(), qq = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3();
    for (let i = 0; i < 90; i++) {
      const x = (R() - 0.5) * 60, z = -R() * 45 + 6; if (Math.hypot(x, z) < 2.5) { m.makeScale(0, 0, 0); rocks.setMatrixAt(i, m); continue; }
      const sc = 0.08 + Math.pow(R(), 3) * 0.9; s.set(sc * (0.8 + R() * 0.6), sc * (0.5 + R() * 0.4), sc * (0.8 + R() * 0.6));
      qq.setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)); pos.set(x, sc * 0.2, z);
      m.compose(pos, qq, s); rocks.setMatrixAt(i, m);
    }
    rocks.castShadow = rocks.receiveShadow = true;
    this.root.add(rocks); this.disposables.push(rockGeo, rockMat);

    // dấu chân: 2 hàng xen kẽ chạy ra sau lưng Kai
    const printTex = canvasTex(64, 128, g => {
      g.fillStyle = "rgba(30,30,30,0.75)";
      g.beginPath(); g.ellipse(32, 40, 22, 34, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(32, 100, 18, 22, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(200,200,195,0.5)"; g.lineWidth = 3;
      for (let y = 14; y < 118; y += 10) { g.beginPath(); g.moveTo(14, y); g.lineTo(50, y); g.stroke(); }
    });
    const printMat = new THREE.MeshStandardMaterial({ map: printTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
    const printGeo = new THREE.PlaneGeometry(0.16, 0.32); printGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 26; i++) {
      const f = new THREE.Mesh(printGeo, printMat);
      f.position.set(0.5 + i * 0.05 + (i % 2 ? 0.14 : -0.14), 0.012, -0.7 - i * 0.62); f.rotation.y = -0.08;
      this.prints.add(f);
    }
    this.root.add(this.prints); this.disposables.push(printTex, printMat, printGeo);

    // trời: sao + Trái Đất (phóng to ~4 lần so với thật cho dễ nhìn)
    const stars = starField(1600, 300, 420, 17, 0.9);
    this.root.add(stars); this.disposables.push(stars.geometry, stars.material as THREE.Material);
    this.earth = makeEarth(9, this.disposables);
    this.earth.position.set(-38, 34, -120); this.earth.rotation.set(0.35, 2.4, 0);
    this.root.add(this.earth);

    // bụi mịn bay lên chậm quanh chân (không có không khí → rơi theo đường parabol)
    const n = 160, dpos = new Float32Array(n * 3), Rd = rng(8);
    for (let i = 0; i < n; i++) { dpos[i * 3] = (Rd() - 0.5) * 3; dpos[i * 3 + 1] = Rd(); dpos[i * 3 + 2] = (Rd() - 0.5) * 3; }
    this.dustBase = dpos.slice();
    const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
    this.dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: "#d9d6cf", size: 0.025, transparent: true, opacity: 0.6, depthWrite: false }));
    this.root.add(this.dust); this.disposables.push(dgeo, this.dust.material as THREE.Material);

    // ánh sáng: Mặt Trời thấp → bóng đổ dài, không có trời xanh tán sáng
    this.sun.position.set(-22, 9, 14); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 });
    this.sun.shadow.bias = -0.0004;
    this.earthLight.position.set(-38, 34, -120);
    this.root.add(this.sun, this.sun.target, this.earthLight, this.hemi);
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = null; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const o = opts(ctx, "moon");
    character.setSpacesuit(true);                       // trên Mặt Trăng luôn mặc đồ phi hành gia
    character.root.position.copy(this.anchor); character.root.rotation.set(0, 0.35, 0);
    this.sun.intensity = o.night ? 0 : 4.2;
    this.hemi.intensity = o.night ? 0.05 : 0.18;
    this.earthLight.intensity = o.night ? 0.9 : 0.25;
    this.prints.visible = o.footprints !== false;
    this.earth.visible = !o.hideEarth;
    this.earth.rotation.y = 2.4 + ctx.t * 0.01;
    const a = (this.dust.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < a.length; i += 3) {
      const ph = ((ctx.t * 0.35 + this.dustBase[i + 1] * 3) % 3) / 3;   // 0..1 chu kỳ 1 hạt
      a[i] = this.dustBase[i] * (0.6 + ph * 0.8); a[i + 2] = this.dustBase[i + 2] * (0.6 + ph * 0.8);
      a[i + 1] = 0.02 + 0.5 * 4 * ph * (1 - ph) * this.dustBase[i + 1];
    }
    this.dust.geometry.attributes.position.needsUpdate = true;
    this.labelList = this.earth.visible ? [{ pos: this.earth.position.clone().add(new THREE.Vector3(0, -11, 0)), text: "地球" }] : [];
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return ctx0(this.labelList); }

  dispose(): void { this.disposables.forEach(d => d.dispose()); }
}

const ctx0 = (l: SceneLabel[]): SceneLabel[] => l.map(x => ({ pos: x.pos.clone(), text: x.text }));

/* =====================================================================
   2. TRÁI ĐẤT ↔ MẶT TRĂNG ĐÚNG TỈ LỆ (1 đơn vị = 1 bán kính Trái Đất = 6.371 km)
   Mặt Trăng cách 60,3 đơn vị, bán kính 0,273. Chấm cam đi dọc đường theo progress.
   ===================================================================== */
const EM_DIST = 384400 / 6371;          // ≈ 60,3
const MOON_R = 1737 / 6371;             // ≈ 0,273

export class EarthMoonSpace implements ScenePrefab {
  id = "earth_moon_space" as const;
  root = new THREE.Group();
  private earth: THREE.Group;
  private moon: THREE.Mesh;
  private moonPos = new THREE.Vector3(EM_DIST, 0, 0);
  private center = new THREE.Vector3(EM_DIST / 2, 0, 0);
  private marker = new PulseMarker(0.9, "#ff7a3d", true);
  private done: THREE.Mesh;
  private tide: THREE.Mesh;
  private bg = new THREE.Color("#02030a");
  private anchor = new THREE.Vector3();
  private labelList: SceneLabel[] = [];
  private disposables: { dispose(): void }[] = [];

  constructor() {
    const stars = starField(2400, 500, 700, 23, 1.4);
    this.root.add(stars); this.disposables.push(stars.geometry, stars.material as THREE.Material);
    this.earth = makeEarth(1, this.disposables); this.earth.rotation.set(0.41, 0, 0);
    const moonTex = moonGlobeTexture();
    const moonMat = new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1 });
    const moonGeo = new THREE.SphereGeometry(MOON_R, 64, 48);
    moonMat.transparent = true;
    this.moon = new THREE.Mesh(moonGeo, moonMat); this.moon.position.copy(this.moonPos);
    this.root.add(this.earth, this.moon);
    // lớp nước thuỷ triều (phóng đại): phồng về phía Mặt Trăng và phía đối diện
    const tideGeo = new THREE.SphereGeometry(1.0, 64, 48);
    const tideMat = new THREE.MeshStandardMaterial({ color: "#7cc4ff", emissive: "#2a78c8", emissiveIntensity: 0.6, transparent: true, opacity: 0.35, roughness: 0.2, depthWrite: false });
    this.tide = new THREE.Mesh(tideGeo, tideMat); this.tide.visible = false; this.root.add(this.tide);
    this.disposables.push(tideGeo, tideMat);
    this.disposables.push(moonTex, moonMat, moonGeo, this.marker);

    // quỹ đạo Mặt Trăng (vòng mờ) + đường đi nét đứt
    const orbitPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 256; i++) { const a = (i / 256) * Math.PI * 2; orbitPts.push(new THREE.Vector3(Math.cos(a) * EM_DIST, 0, Math.sin(a) * EM_DIST)); }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPts);
    const orbitMat = new THREE.LineBasicMaterial({ color: "#6b7fa8", transparent: true, opacity: 0.25 });
    this.root.add(new THREE.Line(orbitGeo, orbitMat));
    const dashGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(1.05, 0, 0), new THREE.Vector3(EM_DIST - MOON_R - 0.05, 0, 0)]);
    const dashMat = new THREE.LineDashedMaterial({ color: "#ffffff", dashSize: 0.6, gapSize: 0.45, transparent: true, opacity: 0.55 });
    const dash = new THREE.Line(dashGeo, dashMat); dash.computeLineDistances(); this.root.add(dash);
    // phần đã đi: thanh cam đặc
    const doneGeo = new THREE.CylinderGeometry(0.09, 0.09, 1, 10); doneGeo.translate(0, 0.5, 0); doneGeo.rotateZ(-Math.PI / 2);
    const doneMat = new THREE.MeshBasicMaterial({ color: "#ff9a52", toneMapped: false });
    this.done = new THREE.Mesh(doneGeo, doneMat); this.done.position.set(1.0, 0, 0);
    this.root.add(this.done, this.marker.group);
    this.disposables.push(orbitGeo, orbitMat, dashGeo, dashMat, doneGeo, doneMat);

    const sun = new THREE.DirectionalLight("#ffffff", 3.2); sun.position.set(-40, 18, 60);
    this.root.add(sun, new THREE.AmbientLight("#2a3550", 0.35));
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = null; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    character.root.visible = false;
    const o = opts(ctx, "route");
    const p = clamp(o.progress ?? ctx.hud.progress);
    this.earth.rotation.y = ctx.t * 0.05;
    this.moon.rotation.y = 2.2 + ctx.t * 0.004;
    const mo = clamp(o.moonOpacity ?? (o.moonGone ? 1 - ctx.lp * 1.15 : 1));
    const mm = this.moon.material as THREE.MeshStandardMaterial;
    mm.opacity = mo; mm.depthWrite = mo > 0.99; this.moon.visible = mo > 0.01;
    // thuỷ triều: Mặt Trăng tạo ~2/3, Mặt Trời ~1/3 → mất Mặt Trăng còn ~1/3
    this.tide.visible = !!o.tide;
    const bulge = 0.2 * (0.33 + 0.67 * mo) * (1 + Math.sin(ctx.t * 1.2) * 0.04);
    this.tide.scale.set(1.01 + bulge, 1.01 - bulge * 0.35, 1.01 - bulge * 0.35);
    const x = lerp(1.0, EM_DIST - MOON_R, p);
    this.marker.group.position.set(x, 0, 0); this.marker.update(ctx.t);
    const noRoute = !!(o.tide || o.moonGone || o.moonOpacity !== undefined);
    this.marker.group.visible = !noRoute;
    this.done.visible = p > 0.002 && !noRoute; this.done.scale.set(Math.max(0.0001, x - 1.0), 1, 1);
    // góc máy chọn điểm neo
    const preset = ctx.beat.cameraPreset as CameraPreset | NewCameraPreset;
    this.anchor.copy(preset === "em_earth" ? new THREE.Vector3() : preset === "em_moon" ? this.moonPos : preset === "em_follow" ? this.marker.group.position : this.center);
    // em_follow: chấm nhỏ lại để không che khung hình
    this.marker.group.scale.setScalar(preset === "em_follow" ? 0.35 : preset === "em_wide" ? 1 : 0.25);
    this.labelList = [];
    if (o.showNames !== false) {
      this.labelList.push({ pos: new THREE.Vector3(0, -1.3, 0), text: "地球" });
      if (mo > 0.3) this.labelList.push({ pos: this.moonPos.clone().add(new THREE.Vector3(0, -0.6, 0)), text: "月" });
      if (preset === "em_wide") this.labelList.push({ pos: this.center.clone().add(new THREE.Vector3(0, 2.5, 0)), text: "約38万km" });
    }
    if (o.label) this.labelList.push({ pos: this.marker.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)), text: o.label });
    applyCameraPreset(camera, preset as CameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return ctx0(this.labelList); }

  dispose(): void { this.disposables.forEach(d => d.dispose()); }
}

/* =====================================================================
   3. BIỂN SÂU – màu nước, sương & ánh sáng đổi theo độ sâu; tuyết biển; sinh vật phát sáng;
      đáy biển; cá voi xanh 25 m bơi ngang (đúng tỉ lệ với Kai)
   ===================================================================== */
const SEA_STOPS: [number, string][] = [[0, "#2f86c4"], [50, "#1b5f98"], [200, "#0c3563"], [1000, "#03142b"], [4000, "#010612"], [11000, "#000206"]];
const seaColor = (d: number, out: THREE.Color): THREE.Color => {
  for (let i = 1; i < SEA_STOPS.length; i++) {
    if (d <= SEA_STOPS[i][0]) {
      const [d0, c0] = SEA_STOPS[i - 1], [d1, c1] = SEA_STOPS[i];
      return out.set(c0).lerp(new THREE.Color(c1), (d - d0) / (d1 - d0));
    }
  }
  return out.set(SEA_STOPS[SEA_STOPS.length - 1][1]);
};

/** cá voi xanh procedural: thân tiện tròn (lathe) + vây đuôi + vây ngực; dài ≈ 25 đơn vị */
function makeWhale(disposables: { dispose(): void }[]): { group: THREE.Group; tail: THREE.Group } {
  const group = new THREE.Group(), L = 25;
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;                                     // 0 = mõm, 1 = cuống đuôi
    const r = u < 0.25 ? Math.sin((u / 0.25) * Math.PI / 2) * 2.2 : lerp(2.2, 0.25, Math.pow((u - 0.25) / 0.75, 1.4));
    prof.push(new THREE.Vector2(Math.max(0.02, r), -u * L));
  }
  const bodyGeo = new THREE.LatheGeometry(prof, 40); bodyGeo.rotateX(Math.PI / 2); bodyGeo.scale(1, 0.78, 1);  // dọc trục +Z, dẹt
  const skin = canvasTex(256, 64, g => {
    const grd = g.createLinearGradient(0, 0, 0, 64); grd.addColorStop(0, "#5c7896"); grd.addColorStop(0.55, "#46627f"); grd.addColorStop(1, "#9db0c2");
    g.fillStyle = grd; g.fillRect(0, 0, 256, 64);
    const R = rng(3); for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(200,215,230,${R() * 0.25})`; g.fillRect(R() * 256, R() * 40, 1 + R() * 3, 1 + R() * 2); }
  });
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", map: skin, roughness: 0.55, metalness: 0.05 });
  const body = new THREE.Mesh(bodyGeo, mat); group.add(body);
  const finShape = new THREE.Shape(); finShape.moveTo(0, 0); finShape.quadraticCurveTo(1.8, -0.6, 4.2, -2.4); finShape.quadraticCurveTo(1.6, -0.2, 0, 0.8);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.12, bevelEnabled: false });
  [-1, 1].forEach(sd => { const f = new THREE.Mesh(finGeo, mat); f.position.set(sd * 1.6, -0.9, -6.5); f.rotation.set(Math.PI / 2, 0, sd > 0 ? 0 : Math.PI); f.scale.set(sd, 1, 1); group.add(f); });
  const tail = new THREE.Group(); tail.position.set(0, 0, -L);
  const flukeShape = new THREE.Shape(); flukeShape.moveTo(0, 0); flukeShape.quadraticCurveTo(2.5, 0.6, 4.2, -1.6); flukeShape.quadraticCurveTo(2.2, -0.8, 0, -0.6);
  flukeShape.quadraticCurveTo(-2.2, -0.8, -4.2, -1.6); flukeShape.quadraticCurveTo(-2.5, 0.6, 0, 0);
  const flukeGeo = new THREE.ExtrudeGeometry(flukeShape, { depth: 0.14, bevelEnabled: false }); flukeGeo.rotateX(-Math.PI / 2);
  tail.add(new THREE.Mesh(flukeGeo, mat)); group.add(tail);
  // mắt
  const eyeGeo = new THREE.SphereGeometry(0.12, 10, 8), eyeMat = new THREE.MeshStandardMaterial({ color: "#111" });
  [-1, 1].forEach(sd => { const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(sd * 1.55, -0.55, -3.2); group.add(e); });
  disposables.push(bodyGeo, skin, mat, finGeo, flukeGeo, eyeGeo, eyeMat);
  return { group, tail };
}

export class DeepSea implements ScenePrefab {
  id = "deep_sea" as const;
  root = new THREE.Group();
  private anchor = new THREE.Vector3(0, 0, 0);
  private bg = new THREE.Color();
  private fog = new THREE.FogExp2("#0c3563", 0.03);
  private sunDown = new THREE.DirectionalLight("#bfe6ff", 2.5);
  private hemi = new THREE.HemisphereLight("#7fc4ff", "#031020", 1.0);
  private lamp = new THREE.SpotLight("#fff2d6", 0, 26, 0.55, 0.6, 1.2);
  private lampFill = new THREE.PointLight("#ffe7c4", 0, 14, 1.2);
  private rays: THREE.Mesh[] = [];
  private rayMat: THREE.MeshBasicMaterial;
  private snow: THREE.Points;
  private snowBase: Float32Array;
  private glow: THREE.Points;
  private glowMat: THREE.PointsMaterial;
  private floor: THREE.Group;
  private whale: { group: THREE.Group; tail: THREE.Group };
  private trench = new THREE.Group();
  private aqua = new THREE.Group();
  private wreck = new THREE.Group();
  private floorY0 = 0;
  private labelList: SceneLabel[] = [];
  private disposables: { dispose(): void }[] = [];

  constructor() {
    // tia nắng xuyên mặt nước (chỉ thấy khi nông)
    const rayFade = canvasTex(4, 128, g => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "#fff"); gr.addColorStop(0.5, "#666"); gr.addColorStop(1, "#000"); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); });
    this.rayMat = new THREE.MeshBasicMaterial({ color: "#cfeeff", alphaMap: rayFade, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const rayGeo = new THREE.CylinderGeometry(0.25, 1.1, 40, 16, 1, true);
    this.disposables.push(rayFade);
    const R = rng(21);
    for (let i = 0; i < 9; i++) {
      const r = new THREE.Mesh(rayGeo, this.rayMat);
      r.position.set((R() - 0.5) * 30, 4, -6 - R() * 20); r.rotation.set(0.12, 0, (R() - 0.5) * 0.25);
      this.rays.push(r); this.root.add(r);
    }
    this.disposables.push(this.rayMat, rayGeo);

    // tuyết biển: hạt hữu cơ rơi chậm, lặp vô hạn trong hộp 30×20×30 quanh Kai
    const n = 1400, sp = new Float32Array(n * 3), Rs = rng(31);
    for (let i = 0; i < n; i++) { sp[i * 3] = (Rs() - 0.5) * 30; sp[i * 3 + 1] = (Rs() - 0.5) * 20; sp[i * 3 + 2] = (Rs() - 0.5) * 30; }
    this.snowBase = sp.slice();
    const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const smat = new THREE.PointsMaterial({ color: "#dfe9f2", size: 0.05, transparent: true, opacity: 0.7, depthWrite: false });
    this.snow = new THREE.Points(sgeo, smat); this.root.add(this.snow);
    this.disposables.push(sgeo, smat);

    // sinh vật phát sáng (xanh lam / xanh lục), chỉ hiện khi tối
    const gn = 160, gp = new Float32Array(gn * 3), gc = new Float32Array(gn * 3), Rg = rng(41);
    for (let i = 0; i < gn; i++) {
      gp[i * 3] = (Rg() - 0.5) * 34; gp[i * 3 + 1] = (Rg() - 0.3) * 14; gp[i * 3 + 2] = -2 - Rg() * 30;
      const green = Rg() < 0.4; gc[i * 3] = green ? 0.3 : 0.25; gc[i * 3 + 1] = green ? 1 : 0.8; gc[i * 3 + 2] = green ? 0.6 : 1;
    }
    const ggeo = new THREE.BufferGeometry();
    ggeo.setAttribute("position", new THREE.BufferAttribute(gp, 3)); ggeo.setAttribute("color", new THREE.BufferAttribute(gc, 3));
    const dot = canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.3, "rgba(255,255,255,0.5)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
    this.glowMat = new THREE.PointsMaterial({ map: dot, size: 0.35, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.glow = new THREE.Points(ggeo, this.glowMat); this.root.add(this.glow);
    this.disposables.push(ggeo, this.glowMat, dot);

    // đáy biển: cát lượn sóng + đá; nằm dưới chân Kai 3 m
    this.floor = new THREE.Group();
    const fgeo = new THREE.PlaneGeometry(120, 120, 160, 160); fgeo.rotateX(-Math.PI / 2);
    const fp = fgeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), z = fp.getZ(i); fp.setY(i, (fbm3(x * 0.05, 2, z * 0.05, 5, 4) - 0.5) * 4 + Math.sin(x * 0.9 + z * 0.3) * 0.06); }
    fgeo.computeVertexNormals();
    const fmat = new THREE.MeshStandardMaterial({ color: "#8f8a7a", roughness: 1 });
    const fl = new THREE.Mesh(fgeo, fmat); fl.receiveShadow = true; this.floor.add(fl);
    const rgeo = new THREE.DodecahedronGeometry(1, 1), rmat = new THREE.MeshStandardMaterial({ color: "#3e3d3a", roughness: 0.95, flatShading: true });
    const rocks = new THREE.InstancedMesh(rgeo, rmat, 50), m = new THREE.Matrix4(), Rr = rng(51);
    for (let i = 0; i < 50; i++) { const sc = 0.2 + Math.pow(Rr(), 2.5) * 2.2; m.compose(new THREE.Vector3((Rr() - 0.5) * 50, sc * 0.2, -Rr() * 40 + 5), new THREE.Quaternion().setFromEuler(new THREE.Euler(Rr() * 3, Rr() * 3, 0)), new THREE.Vector3(sc, sc * 0.6, sc)); rocks.setMatrixAt(i, m); }
    this.floor.add(rocks); this.floor.position.y = -3;
    this.root.add(this.floor);
    this.disposables.push(fgeo, fmat, rgeo, rmat);

    this.floorY0 = (fbm3(0, 2, 0, 5, 4) - 0.5) * 4 - 3;
    // vách rãnh Mariana: 2 vách đá cao 80 m, lởm chởm
    const wGeo = new THREE.PlaneGeometry(120, 90, 90, 70);
    const wp = wGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < wp.count; i++) { const x = wp.getX(i), y = wp.getY(i); wp.setZ(i, (fbm3(x * 0.06, y * 0.06, 1, 13, 5) - 0.5) * 9 + (y + 45) * 0.08); }
    wGeo.computeVertexNormals();
    const wMat = new THREE.MeshStandardMaterial({ color: "#4a4743", roughness: 1, flatShading: true, emissive: "#22303e", emissiveIntensity: 0.6 });
    [-1, 1].forEach(sd => { const w = new THREE.Mesh(wGeo, wMat); w.rotation.y = sd * Math.PI / 2 * -1; w.position.set(sd * 13, 38, -20); this.trench.add(w); });
    this.trench.visible = false; this.root.add(this.trench);
    this.disposables.push(wGeo, wMat);

    // đường hầm Aqua-Line (đường kính ≈ 14 m) nằm lộ trên đáy vịnh, chạy ngang phía sau
    const aGeo = new THREE.CylinderGeometry(7, 7, 140, 48, 1, true); aGeo.rotateZ(Math.PI / 2);
    const aMat = new THREE.MeshStandardMaterial({ color: "#9a9a92", roughness: 0.85, side: THREE.DoubleSide });
    const aRingGeo = new THREE.TorusGeometry(7.05, 0.18, 6, 48); aRingGeo.rotateY(Math.PI / 2);
    const aRingMat = new THREE.MeshStandardMaterial({ color: "#6f6f68", roughness: 0.9 });
    const tube = new THREE.Mesh(aGeo, aMat); this.aqua.add(tube);
    for (let x = -68; x <= 68; x += 4) { const r = new THREE.Mesh(aRingGeo, aRingMat); r.position.x = x; this.aqua.add(r); }
    this.aqua.position.set(0, this.floorY0 - 2.5, -34); this.aqua.visible = false; this.root.add(this.aqua);
    this.disposables.push(aGeo, aMat, aRingGeo, aRingMat);
    // xác tàu đắm dài ≈ 22 m, nghiêng, rỉ sét
    const hull = new THREE.Shape(); hull.moveTo(-11, 0); hull.lineTo(9, 0); hull.quadraticCurveTo(12.5, 0.5, 12, 4.5); hull.lineTo(-11, 4.5); hull.lineTo(-11, 0);
    const hGeo = new THREE.ExtrudeGeometry(hull, { depth: 5, bevelEnabled: false }); hGeo.translate(0, 0, -2.5);
    const rust = canvasTex(128, 128, g => { g.fillStyle = "#6b4a36"; g.fillRect(0, 0, 128, 128); const Rr2 = rng(4); for (let i = 0; i < 300; i++) { g.fillStyle = Rr2() < 0.5 ? "rgba(160,90,40,0.35)" : "rgba(30,20,15,0.3)"; g.fillRect(Rr2() * 128, Rr2() * 128, 2 + Rr2() * 8, 2 + Rr2() * 8); } });
    const hMat = new THREE.MeshStandardMaterial({ map: rust, roughness: 0.95, side: THREE.DoubleSide });
    const ship = new THREE.Mesh(hGeo, hMat); this.wreck.add(ship);
    const cabGeo = new THREE.BoxGeometry(5, 3, 4); const cab = new THREE.Mesh(cabGeo, hMat); cab.position.set(-4, 6, 0); this.wreck.add(cab);
    this.wreck.position.set(16, this.floorY0 - 1.2, -14); this.wreck.rotation.set(0.25, -0.6, 0.18); this.wreck.visible = false; this.root.add(this.wreck);
    this.disposables.push(hGeo, rust, hMat, cabGeo);

    this.whale = makeWhale(this.disposables);
    this.root.add(this.whale.group);

    // ánh sáng: nắng từ trên (yếu dần theo độ sâu) + đèn pin trên mũ Kai (mạnh dần)
    this.sunDown.position.set(3, 30, 6);
    this.lamp.position.set(0.4, 2.2, 1.2); this.lamp.target.position.set(0, -3, -2.5);
    this.lampFill.position.set(2.5, 3, 5);
    this.root.add(this.sunDown, this.hemi, this.lamp, this.lamp.target, this.lampFill);
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = this.fog; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const o = opts(ctx, "sea");
    const d = Math.max(0, o.depthM ?? ctx.hud.depthKm * 1000);
    const dry = !!o.drained;
    this.trench.visible = !!o.trench && !dry;
    this.aqua.visible = dry && !!o.aqualine;
    this.wreck.visible = dry && !!o.wreck;
    if (dry) {
      // biển rút cạn: trời sáng, Kai đứng trên đáy khô
      this.bg.set("#9cc8ec"); this.fog.color.set("#b9d6ee"); this.fog.density = 0.006;
      this.sunDown.intensity = 2.8; this.hemi.intensity = 1.1; this.lamp.intensity = 0; this.lampFill.intensity = 0;
      this.rays.forEach(r => { r.visible = false; }); this.snow.visible = false; this.glow.visible = false;
      this.floor.visible = true; this.whale.group.visible = false;
      ((this.floor.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set("#b8a585");
      character.setSpacesuit(false);
      character.root.position.set(0, this.floorY0, 0); character.root.rotation.set(0, 0.3, 0);
      this.anchor.set(0, this.floorY0, 0);
      this.labelList = [];
      if (this.aqua.visible) this.labelList.push({ pos: new THREE.Vector3(-10, this.floorY0 + 6.5, -34), text: "東京湾アクアライン" });
      if (this.wreck.visible) this.labelList.push({ pos: new THREE.Vector3(16, this.floorY0 + 9, -14), text: "沈没船" });
      applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
      return;
    }
    this.snow.visible = true; this.anchor.set(0, 0, 0);
    ((this.floor.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set("#8f8a7a");
    character.setSpacesuit(true);                       // đồ lặn
    character.root.position.set(0, Math.sin(ctx.t * 0.8) * 0.08, 0);   // lơ lửng nhấp nhô
    character.root.rotation.set(0, 0.3, Math.sin(ctx.t * 0.5) * 0.04);

    seaColor(d, this.bg); this.fog.color.copy(this.bg);
    const dark = clamp(Math.log10(1 + d) / Math.log10(1001));          // 0 ở mặt nước → 1 ở 1.000 m
    this.fog.density = lerp(0.028, 0.055, dark);
    this.sunDown.intensity = lerp(2.5, 0, clamp(d / 300));
    this.hemi.intensity = lerp(1.0, 0.04, dark);
    this.rayMat.opacity = 0.08 * (1 - clamp(d / 150));
    this.rays.forEach((r, i) => { r.visible = d < 150; r.rotation.z = Math.sin(ctx.t * 0.25 + i) * 0.06; });
    this.lamp.intensity = lerp(0, 60, clamp((d - 80) / 300));
    this.lampFill.intensity = lerp(0, 3, clamp((d - 80) / 300));

    // tuyết biển rơi + trôi ngang (thuần theo thời gian)
    const a = (this.snow.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array, b = this.snowBase;
    for (let i = 0; i < a.length; i += 3) {
      a[i] = b[i] + Math.sin(ctx.t * 0.3 + i) * 0.15;
      a[i + 1] = ((((b[i + 1] - ctx.t * 0.12) % 20) + 30) % 20) - 10;
      a[i + 2] = b[i + 2];
    }
    this.snow.geometry.attributes.position.needsUpdate = true;
    (this.snow.material as THREE.PointsMaterial).opacity = lerp(0.25, 0.8, clamp(d / 400));

    this.glow.visible = d > 400;
    this.glowMat.opacity = clamp((d - 400) / 600) * (0.6 + 0.4 * Math.sin(ctx.t * 2.1));

    this.floor.visible = o.floor ?? d >= 3000;

    const w = this.whale;
    w.group.visible = !!o.whale;
    if (w.group.visible) {
      // bơi ngang từ phải sang trái phía sau Kai, hết beat thì ra khỏi khung
      const x = lerp(30, -34, ctx.lp);
      w.group.position.set(x, 1.5 + Math.sin(ctx.t * 0.4) * 0.6, -16);
      w.group.rotation.set(0, -Math.PI / 2 + Math.sin(ctx.t * 0.5) * 0.05, 0);
      w.tail.rotation.x = Math.sin(ctx.t * 1.4) * 0.35;
    }

    this.labelList = [];
    if (w.group.visible && o.whaleLabel) this.labelList.push({ pos: w.group.position.clone().add(new THREE.Vector3(0, 3.5, 0)), text: o.whaleLabel });

    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return ctx0(this.labelList); }

  dispose(): void { this.disposables.forEach(d => d.dispose()); }
}

/** tạo cả 3 cảnh – dùng trong engine.ts: ...createNewScenes() */
export const createNewScenes = (): Record<NewSceneId, ScenePrefab> => ({
  ...createTokyoScenes(),
  ...createSkyScenes(),
  ...createPlanScenes(),
  gravity_train: new GravityTrain(),
  kola_borehole: new KolaBorehole(),
  gravity_room: new GravityRoom(),
  moon_surface: new MoonSurface(),
  earth_moon_space: new EarthMoonSpace(),
  deep_sea: new DeepSea(),
});
