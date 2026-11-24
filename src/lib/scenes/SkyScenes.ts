import * as THREE from "three";
import type { CameraPreset, CharacterLike, FrameCtx, ScenePrefab, SceneLabel } from "../types";
import { clamp, lerp, rng } from "../math";
import { fbm3 } from "../textures";
import { applyCameraPreset } from "./cameraPresets";
import { canvasTex, makeEarth, starField } from "./NewScenes";
import type { NewBeatFields } from "./newScenesData";

/* =====================================================================
   4 BỐI CẢNH CHO PHẦN CÒN LẠI CỦA PLAN (tháng 12 – tháng 1)
   - space_elevator : thang máy vũ trụ, cáp từ xích đạo lên quỹ đạo địa tĩnh 35.786 km (1 đơn vị = 1.000 km)
   - solar_system   : Mặt Trời + Thuỷ/Kim/Trái Đất/Hoả, vùng sống được; Trái Đất dời quỹ đạo được (AU)
   - sky_mountain   : núi Phú Sĩ / Everest, biển mây, màu trời đổi theo độ cao; tuỳ chọn phố Tokyo + Skytree dưới chân núi
   - typhoon_eye    : mắt bão nhìn từ vũ trụ và từ bên trong (trời xanh, vách mây xoáy)
   ===================================================================== */

type D = { dispose(): void };
const opt = <K extends keyof NewBeatFields>(ctx: FrameCtx, k: K): NonNullable<NewBeatFields[K]> =>
  ((ctx.beat as unknown as NewBeatFields)[k] ?? {}) as NonNullable<NewBeatFields[K]>;
const lbl = (p: THREE.Vector3, text: string): SceneLabel => ({ pos: p.clone(), text });
const preset = (ctx: FrameCtx) => ctx.beat.cameraPreset as CameraPreset | string;

/* ---------- 1. THANG MÁY VŨ TRỤ ---------- */
const ER = 6.371;      // bán kính Trái Đất (1 đơn vị = 1.000 km)
const GEO = 35.786;

export class SpaceElevator implements ScenePrefab {
  id = "space_elevator" as const;
  root = new THREE.Group();
  private bg = new THREE.Color("#02030a");
  private earth: THREE.Group;
  private cabin = new THREE.Group();
  private anchor = new THREE.Vector3();
  private labelList: SceneLabel[] = [];
  private ds: D[] = [];

  constructor() {
    const ds = this.ds;
    const stars = starField(2200, 400, 600, 61, 1.2); this.root.add(stars); ds.push(stars.geometry, stars.material as THREE.Material);
    // Trái Đất: tâm ở (0, -ER, 0) → chân cáp ở gốc toạ độ (xích đạo)
    this.earth = makeEarth(ER, ds); this.earth.position.set(0, -ER, 0); this.earth.rotation.set(0, 0, 0);
    this.root.add(this.earth);
    // cáp: từ 0 lên tới đối trọng 50.000 km
    const cableGeo = new THREE.CylinderGeometry(0.03, 0.03, 50, 8); cableGeo.translate(0, 25, 0);
    const cableMat = new THREE.MeshBasicMaterial({ color: "#d9e6ff", toneMapped: false });
    this.root.add(new THREE.Mesh(cableGeo, cableMat)); ds.push(cableGeo, cableMat);
    // trạm địa tĩnh (vòng + khối) và đối trọng
    const steel = new THREE.MeshStandardMaterial({ color: "#cfd6df", metalness: 0.6, roughness: 0.35, emissive: "#334", emissiveIntensity: 0.4 }); ds.push(steel);
    const ringGeo = new THREE.TorusGeometry(0.9, 0.12, 12, 40); ds.push(ringGeo);
    const ring = new THREE.Mesh(ringGeo, steel); ring.position.y = GEO; ring.rotation.x = Math.PI / 2; this.root.add(ring);
    const hubGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7); ds.push(hubGeo);
    const hub = new THREE.Mesh(hubGeo, steel); hub.position.y = GEO; this.root.add(hub);
    const cwGeo = new THREE.BoxGeometry(1.4, 1.0, 1.4); ds.push(cwGeo);
    const cw = new THREE.Mesh(cwGeo, steel); cw.position.y = 50; this.root.add(cw);
    // trạm mặt đất trên biển
    const baseGeo = new THREE.CylinderGeometry(0.5, 0.7, 0.15, 24); ds.push(baseGeo);
    const base = new THREE.Mesh(baseGeo, steel); base.position.y = 0.05; this.root.add(base);
    // vạch độ cao: ISS 400 km, 100 km (ranh giới vũ trụ)
    const markMat = new THREE.MeshBasicMaterial({ color: "#ffd25a", toneMapped: false, transparent: true, opacity: 0.8 }); ds.push(markMat);
    for (const h of [0.1, 0.4]) { const g = new THREE.TorusGeometry(0.25, 0.015, 6, 32); ds.push(g); const m = new THREE.Mesh(g, markMat); m.position.y = h; m.rotation.x = Math.PI / 2; this.root.add(m); }
    // cabin: khung + cửa sổ phát sáng (phóng to để nhìn thấy)
    const cabMat = new THREE.MeshStandardMaterial({ color: "#f2f4f7", metalness: 0.3, roughness: 0.4 }); ds.push(cabMat);
    const winTex = canvasTex(64, 64, g => { g.fillStyle = "#f2f4f7"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#ffe9a8"; g.fillRect(10, 14, 44, 30); });
    const winMat = new THREE.MeshStandardMaterial({ map: winTex, emissive: "#ffffff", emissiveMap: winTex, emissiveIntensity: 0.6 }); ds.push(winTex, winMat);
    const cabGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.34, 6); ds.push(cabGeo);
    this.cabin.add(new THREE.Mesh(cabGeo, [winMat, cabMat, cabMat]));
    const light = new THREE.PointLight("#ffe7b0", 2, 2); this.cabin.add(light);
    this.root.add(this.cabin);
    const sun = new THREE.DirectionalLight("#ffffff", 3); sun.position.set(-30, 20, 40);
    this.root.add(sun, new THREE.AmbientLight("#334466", 0.5));
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = null; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    character.root.visible = false;
    const o = opt(ctx, "elevator");
    const from = o.altKmFrom ?? 0, to = o.altKmTo ?? from;
    const alt = lerp(from, to, ctx.lp) / 1000;
    this.cabin.position.y = Math.max(0.2, alt);
    this.earth.rotation.y = ctx.t * 0.03;
    const p = preset(ctx);
    if (p === "elev_cabin" || p === "elev_down") this.anchor.copy(this.cabin.position);
    else if (p === "elev_ground") this.anchor.set(0, 0, 0);
    else this.anchor.set(0, 14, 0);
    this.labelList = [lbl(new THREE.Vector3(0.4, GEO, 0), "静止軌道 35,786km"), lbl(new THREE.Vector3(0.6, 0.4, 0), "ISS 400km")];
    if (o.label) this.labelList.push(lbl(this.cabin.position.clone().add(new THREE.Vector3(0.5, 0.2, 0)), o.label));
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return this.labelList.map(l => lbl(l.pos, l.text)); }
  dispose(): void { this.ds.forEach(d => d.dispose()); }
}

/* ---------- 2. HỆ MẶT TRỜI (1 AU = 20 đơn vị; cỡ hành tinh phóng to) ---------- */
const AU = 20;
const PLANETS: { key: "mercury" | "venus" | "earth" | "mars"; name: string; au: number; r: number; color: string; days: number }[] = [
  { key: "mercury", name: "水星", au: 0.39, r: 0.45, color: "#9c9286", days: 88 },
  { key: "venus", name: "金星", au: 0.72, r: 0.9, color: "#e8c67a", days: 225 },
  { key: "earth", name: "地球", au: 1.0, r: 1.0, color: "#2a5d93", days: 365 },
  { key: "mars", name: "火星", au: 1.52, r: 0.6, color: "#c1502e", days: 687 },
];

export class SolarSystem implements ScenePrefab {
  id = "solar_system" as const;
  root = new THREE.Group();
  private bg = new THREE.Color("#020308");
  private bodies: Record<string, THREE.Object3D> = {};
  private earthOrbit: THREE.Mesh;
  private zone: THREE.Mesh;
  private anchor = new THREE.Vector3();
  private labelList: SceneLabel[] = [];
  private ds: D[] = [];

  constructor() {
    const ds = this.ds;
    const stars = starField(2600, 500, 700, 71, 1.4); this.root.add(stars); ds.push(stars.geometry, stars.material as THREE.Material);
    // Mặt Trời: lõi phát sáng + quầng
    const sunTex = canvasTex(256, 128, g => { const R = rng(3); g.fillStyle = "#ffb52e"; g.fillRect(0, 0, 256, 128); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,${200 + R() * 55},${80 + R() * 80},${R() * 0.5})`; g.beginPath(); g.arc(R() * 256, R() * 128, 1 + R() * 4, 0, 7); g.fill(); } });
    const sunMat = new THREE.MeshBasicMaterial({ map: sunTex, toneMapped: false }); const sunGeo = new THREE.SphereGeometry(3, 48, 32);
    const sun = new THREE.Mesh(sunGeo, sunMat); this.root.add(sun); this.bodies.sun = sun; ds.push(sunTex, sunMat, sunGeo);
    const glowTex = canvasTex(128, 128, g => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(255,220,140,1)"); r.addColorStop(0.35, "rgba(255,170,60,0.45)"); r.addColorStop(1, "rgba(255,120,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const glow = new THREE.Sprite(glowMat); glow.scale.setScalar(16); this.root.add(glow); ds.push(glowTex, glowMat);
    // vùng sống được (0,95–1,37 AU) – vành xanh mờ
    const zGeo = new THREE.RingGeometry(0.95 * AU, 1.37 * AU, 128); zGeo.rotateX(-Math.PI / 2);
    const zMat = new THREE.MeshBasicMaterial({ color: "#3ddc84", transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
    this.zone = new THREE.Mesh(zGeo, zMat); this.root.add(this.zone); ds.push(zGeo, zMat);
    // quỹ đạo + hành tinh
    const orbitMat = new THREE.MeshBasicMaterial({ color: "#8090b0", transparent: true, opacity: 0.35, side: THREE.DoubleSide }); ds.push(orbitMat);
    const venusTex = canvasTex(256, 128, g => { for (let y = 0; y < 128; y++) { const v = 200 + Math.sin(y * 0.3) * 20 + Math.sin(y * 0.07) * 15; g.fillStyle = `rgb(${v + 30},${v},${v * 0.6})`; g.fillRect(0, y, 256, 1); } }); ds.push(venusTex);
    for (const pl of PLANETS) {
      const oGeo = new THREE.RingGeometry(pl.au * AU - 0.04, pl.au * AU + 0.04, 160); oGeo.rotateX(-Math.PI / 2); ds.push(oGeo);
      const orbit = new THREE.Mesh(oGeo, orbitMat); this.root.add(orbit);
      if (pl.key === "earth") { this.earthOrbit = orbit; }
      let body: THREE.Object3D;
      if (pl.key === "earth") body = makeEarth(pl.r, ds);
      else {
        const geo = new THREE.SphereGeometry(pl.r, 40, 28), mat = new THREE.MeshStandardMaterial({ color: pl.key === "venus" ? "#ffffff" : pl.color, map: pl.key === "venus" ? venusTex : null, roughness: 0.9 });
        body = new THREE.Mesh(geo, mat); ds.push(geo, mat);
      }
      this.bodies[pl.key] = body; this.root.add(body);
    }
    this.earthOrbit ??= new THREE.Mesh();
    const light = new THREE.PointLight("#fff4e0", 900, 0, 1.6); this.root.add(light, new THREE.AmbientLight("#202838", 0.5));
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = null; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    character.root.visible = false;
    const o = opt(ctx, "solar");
    const earthAU = lerp(o.earthAUFrom ?? 1, o.earthAU ?? o.earthAUFrom ?? 1, ctx.lp);
    this.zone.visible = !!o.zone;
    this.labelList = [];
    for (const pl of PLANETS) {
      const au = pl.key === "earth" ? earthAU : pl.au;
      const ang = 0.6 + ctx.t * (365 / pl.days) * 0.04 + PLANETS.indexOf(pl) * 1.3;
      const b = this.bodies[pl.key]; b.position.set(Math.cos(ang) * au * AU, 0, Math.sin(ang) * au * AU); b.rotation.y = ctx.t * 0.3;
      this.labelList.push(lbl(b.position.clone().add(new THREE.Vector3(0, pl.r + 1.2, 0)), pl.name));
    }
    this.earthOrbit.scale.setScalar(earthAU);
    if (o.label) this.labelList.push(lbl(this.bodies.earth.position.clone().add(new THREE.Vector3(0, -2.2, 0)), o.label));
    this.labelList.push(lbl(new THREE.Vector3(0, 4.5, 0), "太陽"));
    const p = preset(ctx);
    if (p === "solar_earth") this.anchor.copy(this.bodies.earth.position);
    else if (p === "solar_venus") this.anchor.copy(this.bodies.venus.position);
    else this.anchor.set(0, 0, 0);
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return this.labelList.map(l => lbl(l.pos, l.text)); }
  dispose(): void { this.ds.forEach(d => d.dispose()); }
}

/* ---------- 3. NÚI + BIỂN MÂY + ĐỘ CAO (1 đơn vị = 10 m) ---------- */
export const skyColorAt = (m: number, out: THREE.Color): THREE.Color => {
  const stops: [number, string][] = [[0, "#8ec5f0"], [3000, "#5aa2e6"], [9000, "#2f6fc9"], [20000, "#123d8a"], [50000, "#061433"], [100000, "#000006"]];
  for (let i = 1; i < stops.length; i++) if (m <= stops[i][0]) return out.set(stops[i - 1][1]).lerp(new THREE.Color(stops[i][1]), (m - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  return out.set("#000006");
};

function mountain(kind: "fuji" | "everest", ds: D[]): THREE.Mesh {
  const H = kind === "fuji" ? 377.6 : 884.9, size = kind === "fuji" ? 2600 : 2200, seg = 200;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position as THREE.BufferAttribute, col: number[] = [];
  const snow = new THREE.Color("#f4f7fb"), rock = new THREE.Color(kind === "fuji" ? "#7a6660" : "#6a6560"), green = new THREE.Color("#4f6b3a"), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z) / (size / 2);
    let h: number;
    if (kind === "fuji") {
      h = H * Math.pow(clamp(1 - r * 1.35), 1.9) + (fbm3(x * 0.01, 0, z * 0.01, 4, 4) - 0.5) * 8;
      if (r < 0.02) h -= 6 * (1 - r / 0.02);            // miệng núi lửa
    } else {
      const ridge = Math.abs(fbm3(x * 0.004, 1, z * 0.004, 8, 5) - 0.5) * 2;
      h = H * Math.pow(clamp(1 - r * 1.25), 1.5) * (0.75 + ridge * 0.45) + (fbm3(x * 0.02, 2, z * 0.02, 9, 4) - 0.5) * 30;
    }
    h = Math.max(0, h); p.setY(i, h);
    const sn = clamp((h - H * (kind === "fuji" ? 0.72 : 0.55)) / (H * 0.08));
    c.copy(h < H * 0.25 ? green : rock).lerp(rock, clamp(h / (H * 0.25))).lerp(snow, sn);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: kind === "everest" });
  ds.push(geo, mat);
  const m = new THREE.Mesh(geo, mat); m.userData.H = H; return m;
}

export class SkyMountain implements ScenePrefab {
  id = "sky_mountain" as const;
  root = new THREE.Group();
  private bg = new THREE.Color();
  private fog = new THREE.Fog("#8ec5f0", 600, 1900);
  private mts: Record<"fuji" | "everest", THREE.Mesh>;
  private clouds: THREE.Mesh;
  private cloudTex: THREE.CanvasTexture;
  private city = new THREE.Group();
  private stars: THREE.Points;
  private anchor = new THREE.Vector3();
  private labelList: SceneLabel[] = [];
  private ds: D[] = [];

  constructor() {
    const ds = this.ds;
    this.mts = { fuji: mountain("fuji", ds), everest: mountain("everest", ds) };
    this.root.add(this.mts.fuji, this.mts.everest);
    // biển mây (ở 2.000 m = 200 đơn vị)
    this.cloudTex = canvasTex(512, 512, g => {
      g.clearRect(0, 0, 512, 512); const R = rng(14);
      for (let i = 0; i < 520; i++) { const x = R() * 512, y = R() * 512, r = 10 + R() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    }, true);
    this.cloudTex.repeat.set(10, 10);
    const cGeo = new THREE.PlaneGeometry(9000, 9000); cGeo.rotateX(-Math.PI / 2);
    const cMat = new THREE.MeshStandardMaterial({ map: this.cloudTex, transparent: true, depthWrite: false, roughness: 1, color: "#ffffff" });
    this.clouds = new THREE.Mesh(cGeo, cMat); this.clouds.position.y = 200; this.root.add(this.clouds); ds.push(this.cloudTex, cGeo, cMat);
    // mặt đất xa
    const gGeo = new THREE.PlaneGeometry(12000, 12000); gGeo.rotateX(-Math.PI / 2);
    const gMat = new THREE.MeshStandardMaterial({ color: "#56704a", roughness: 1 }); const ground = new THREE.Mesh(gGeo, gMat); ground.position.y = -0.5; this.root.add(ground); ds.push(gGeo, gMat);
    // phố Tokyo + Skytree (634 m) quanh chân núi
    const R = rng(33), bMat = new THREE.MeshStandardMaterial({ color: "#c9ccd2", roughness: 0.8 }); ds.push(bMat);
    const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0); ds.push(bGeo);
    const blocks = new THREE.InstancedMesh(bGeo, bMat, 900), m4 = new THREE.Matrix4();
    for (let i = 0; i < 900; i++) {
      const a = R() * Math.PI * 2, d = 900 + R() * 1400, h = 2 + Math.pow(R(), 3) * 22;
      m4.compose(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d), new THREE.Quaternion(), new THREE.Vector3(3 + R() * 4, h, 3 + R() * 4)); blocks.setMatrixAt(i, m4);
    }
    this.city.add(blocks);
    const skyGeo = new THREE.CylinderGeometry(0.8, 3.5, 63.4, 3); skyGeo.translate(0, 31.7, 0); ds.push(skyGeo);
    const skyMat = new THREE.MeshStandardMaterial({ color: "#eef3f8", metalness: 0.4, roughness: 0.3 }); ds.push(skyMat);
    const sky = new THREE.Mesh(skyGeo, skyMat); sky.position.set(700, 0, 520); this.city.add(sky);
    this.root.add(this.city);
    this.stars = starField(1500, 1700, 1900, 5, 4); this.root.add(this.stars); ds.push(this.stars.geometry, this.stars.material as THREE.Material);
    const sun = new THREE.DirectionalLight("#fff3df", 3); sun.position.set(-800, 1200, 900); sun.target.position.set(0, 0, 0);
    this.root.add(sun, sun.target, new THREE.HemisphereLight("#cfe6ff", "#4a5a3a", 1.1));
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = this.fog; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const o = opt(ctx, "sky");
    const kind = o.mountain ?? "fuji", mt = this.mts[kind], H = mt.userData.H as number;
    this.mts.fuji.visible = kind === "fuji"; this.mts.everest.visible = kind === "everest";
    this.city.visible = !!o.city;
    this.clouds.visible = o.clouds ?? !o.city;
    this.cloudTex.offset.set(ctx.t * 0.004, ctx.t * 0.002);
    const altM = o.altitudeM ?? (o.altitudeFrom !== undefined ? lerp(o.altitudeFrom, o.altitudeTo ?? o.altitudeFrom, ctx.lp) : H * 10);
    skyColorAt(altM, this.bg); this.fog.color.copy(this.bg);
    this.fog.far = lerp(1900, 6000, clamp(altM / 20000));
    (this.stars.material as THREE.PointsMaterial).opacity = clamp((altM - 15000) / 30000); (this.stars.material as THREE.PointsMaterial).transparent = true;
    // Kai đứng trên đỉnh (phóng to ×6 để nhìn thấy trên núi 1 đơn vị = 10 m)
    const summit = new THREE.Vector3(0, H - (kind === "fuji" ? 2 : 0), 0);
    character.root.position.copy(summit); character.root.scale.setScalar(1); character.root.rotation.set(0, 0.4, 0);
    const p = preset(ctx);
    if (p === "mt_summit") this.anchor.copy(summit);
    else if (p === "mt_climb") this.anchor.set(0, Math.min(H, altM / 10), 0);
    else this.anchor.set(0, H * 0.45, 0);
    character.root.visible = p === "mt_summit";
    this.labelList = [];
    if (o.showNames !== false) {
      this.labelList.push(lbl(summit.clone().add(new THREE.Vector3(0, 40, 0)), kind === "fuji" ? "富士山 3,776m" : "エベレスト 8,849m"));
      if (this.city.visible) this.labelList.push(lbl(new THREE.Vector3(700, 75, 520), "スカイツリー 634m"));
    }
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return this.labelList.map(l => lbl(l.pos, l.text)); }
  dispose(): void { this.ds.forEach(d => d.dispose()); }
}

/* ---------- 4. MẮT BÃO ---------- */
function spiralTex(seed: number): THREE.CanvasTexture {
  const S = 512;
  return canvasTex(S, S, g => {
    g.clearRect(0, 0, S, S);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2), r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const sp = Math.sin(a * 3 + Math.log(r + 0.02) * 9) * 0.5 + 0.5;
      const n = fbm3(dx * 4, dy * 4, seed, seed, 4);
      let v = clamp((sp * 0.6 + n * 0.7 - 0.35) * 1.8) * clamp((1 - r) * 3) * clamp((r - 0.07) * 12);
      v = Math.pow(v, 0.8);
      const i = (y * S + x) * 4; img.data[i] = 245; img.data[i + 1] = 248; img.data[i + 2] = 255; img.data[i + 3] = v * 255;
    }
    g.putImageData(img, 0, 0);
  });
}

export class TyphoonEye implements ScenePrefab {
  id = "typhoon_eye" as const;
  root = new THREE.Group();
  private bg = new THREE.Color("#4f8fd0");
  private disk: THREE.Mesh;
  private wall: THREE.Mesh;
  private wallTex: THREE.CanvasTexture;
  private sea: THREE.Mesh;
  private rain: THREE.Points;
  private anchor = new THREE.Vector3();
  private ty_fog = new THREE.Fog("#7fa9cf", 200, 1900);
  private labelList: SceneLabel[] = [];
  private ds: D[] = [];

  constructor() {
    const ds = this.ds;
    // biển
    const sGeo = new THREE.PlaneGeometry(4000, 4000, 1, 1); sGeo.rotateX(-Math.PI / 2);
    const sMat = new THREE.MeshStandardMaterial({ color: "#1d4f78", roughness: 0.35, metalness: 0.1 });
    this.sea = new THREE.Mesh(sGeo, sMat); this.root.add(this.sea); ds.push(sGeo, sMat);
    // đĩa mây xoắn (nhìn từ trên) – bán kính 600, mắt bão ~40
    const tex = spiralTex(3); ds.push(tex);
    const dGeo = new THREE.CircleGeometry(600, 96); dGeo.rotateX(-Math.PI / 2);
    const dMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1 });
    this.disk = new THREE.Mesh(dGeo, dMat); this.disk.position.y = 60; this.root.add(this.disk); ds.push(dGeo, dMat);
    // vách mắt bão: hình trụ loe, mặt trong là mây cuộn
    this.wallTex = canvasTex(512, 256, g => {
      const R = rng(8); g.fillStyle = "#c9d3de"; g.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 700; i++) { const x = R() * 512, y = R() * 256, r = 8 + R() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); const v = 170 + R() * 85; gr.addColorStop(0, `rgba(${v},${v + 5},${v + 12},0.8)`); gr.addColorStop(1, "rgba(200,210,220,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    }, true);
    this.wallTex.repeat.set(4, 1);
    const wGeo = new THREE.CylinderGeometry(70, 38, 60, 64, 1, true); wGeo.translate(0, 30, 0);
    const wMat = new THREE.MeshStandardMaterial({ map: this.wallTex, side: THREE.DoubleSide, roughness: 1 });
    this.wall = new THREE.Mesh(wGeo, wMat); this.root.add(this.wall); ds.push(this.wallTex, wGeo, wMat);
    // mưa ngoài vách
    const n = 1800, rp = new Float32Array(n * 3), Rr = rng(4);
    for (let i = 0; i < n; i++) { const a = Rr() * Math.PI * 2, d = 75 + Rr() * 120; rp[i * 3] = Math.cos(a) * d; rp[i * 3 + 1] = Rr() * 55; rp[i * 3 + 2] = Math.sin(a) * d; }
    const rGeo = new THREE.BufferGeometry(); rGeo.setAttribute("position", new THREE.BufferAttribute(rp, 3));
    const rMat = new THREE.PointsMaterial({ color: "#cfe0f0", size: 0.6, transparent: true, opacity: 0.6, depthWrite: false });
    this.rain = new THREE.Points(rGeo, rMat); this.root.add(this.rain); ds.push(rGeo, rMat);
    // thuyền nhỏ cho Kai đứng (ở tâm mắt bão)
    const hullGeo = new THREE.BoxGeometry(2.2, 0.5, 4.5); hullGeo.translate(0, 0.25, 0);
    const hullMat = new THREE.MeshStandardMaterial({ color: "#e9edf2" }); const hull = new THREE.Mesh(hullGeo, hullMat); hull.position.y = -0.3; this.root.add(hull); ds.push(hullGeo, hullMat);
    const sun = new THREE.DirectionalLight("#ffffff", 2.6); sun.position.set(200, 500, 300);
    this.root.add(sun, new THREE.HemisphereLight("#bcdcff", "#203040", 1.0));
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = this.ty_fog; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const o = opt(ctx, "typhoon");
    const p = preset(ctx);
    const space = p === "ty_space";
    this.bg.set(space ? "#02040a" : "#4f8fd0");
    this.ty_fog.near = space ? 5000 : 200; this.ty_fog.far = space ? 6000 : 1900;
    this.disk.rotation.y = -ctx.t * 0.05;
    this.wall.rotation.y = -ctx.t * 0.25;
    this.wallTex.offset.y = (ctx.t * 0.02) % 1;
    this.rain.rotation.y = -ctx.t * 0.6;
    this.disk.visible = space || p === "ty_wide";
    const inside = !space && p !== "ty_wide";
    this.wall.scale.setScalar(inside ? 6 : 1); this.rain.scale.setScalar(inside ? 6 : 1);
    character.root.position.set(0, 0.2, 0); character.root.rotation.set(0, 0.3, 0);
    character.root.visible = !space && p !== "ty_wide";
    this.anchor.set(0, 0, 0);
    this.labelList = [];
    if (o.label) this.labelList.push(lbl(new THREE.Vector3(0, space ? 80 : 12, 0), o.label));
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return this.labelList.map(l => lbl(l.pos, l.text)); }
  dispose(): void { this.ds.forEach(d => d.dispose()); }
}

export const createSkyScenes = (): Record<"space_elevator" | "solar_system" | "sky_mountain" | "typhoon_eye", ScenePrefab> => ({
  space_elevator: new SpaceElevator(),
  solar_system: new SolarSystem(),
  sky_mountain: new SkyMountain(),
  typhoon_eye: new TyphoonEye(),
});
