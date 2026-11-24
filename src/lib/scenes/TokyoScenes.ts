import * as THREE from "three";
import type { CameraPreset, CharacterLike, FrameCtx, ScenePrefab, SceneLabel } from "../types";
import { clamp, rng } from "../math";
import { applyCameraPreset } from "./cameraPresets";

/* =====================================================================
   3 BỐI CẢNH TOKYO DƯỚI LÒNG ĐẤT (cho tập "Mặt đất Tokyo trong suốt")
   - tokyo_glass_street : mặt đường hoá kính, thấy ống nước/ga/điện/cáp quang + đường hầm tàu Ginza chạy bên dưới
   - tokyo_deep_infra   : lát cắt 0–60 m (1 đơn vị = 1 m): ống, tàu Ginza, Chiyoda, ga Roppongi 42,3 m, hồ điều tiết
   - tokyo_strata_onsen : lát cắt 0–3.000 m (1 đơn vị = 10 m): địa tầng, giếng suối nóng 1.500 m, đá gốc, tháp Skytree so sánh
   Vạch đỏ "độ sâu" chạy theo HUD depthKm. Mọi chuyển động chỉ phụ thuộc thời gian.
   ===================================================================== */

type D = { dispose(): void };

function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); if (!g) throw new Error("Canvas 2D không khả dụng");
  draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

/** tấm đất có hạt + vệt lớp */
function soilTex(base: string, seed: number, stripes = 6): THREE.CanvasTexture {
  return tex(256, 256, g => {
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    const R = rng(seed);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "255,255,255"},${R() * 0.12})`; g.fillRect(R() * 256, R() * 256, 1 + R() * 3, 1 + R() * 2); }
    for (let s = 0; s < stripes; s++) { g.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.06})`; g.fillRect(0, R() * 256, 256, 2 + R() * 6); }
  });
}

/** ống chạy dọc trục Z */
function pipeZ(r: number, len: number, mat: THREE.Material, x: number, y: number, ds: D[]): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, len, 20); geo.rotateX(Math.PI / 2); ds.push(geo);
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, 0); return m;
}

/** đường hầm tròn dọc trục Z (vỏ bê tông + lòng tối) */
function tunnelZ(r: number, len: number, x: number, y: number, ds: D[], shell = "#9aa3ad"): THREE.Group {
  const g = new THREE.Group();
  const outer = new THREE.CylinderGeometry(r, r, len, 40, 1, true); outer.rotateX(Math.PI / 2);
  const inner = new THREE.CylinderGeometry(r * 0.9, r * 0.9, len, 40, 1, true); inner.rotateX(Math.PI / 2);
  const mo = new THREE.MeshStandardMaterial({ color: shell, roughness: 0.8 });
  const mi = new THREE.MeshStandardMaterial({ color: "#2a2f36", roughness: 0.9, side: THREE.BackSide });
  const ringGeo = new THREE.RingGeometry(r * 0.9, r, 40);
  const ring = new THREE.Mesh(ringGeo, mo); ring.position.z = len / 2;
  g.add(new THREE.Mesh(outer, mo), new THREE.Mesh(inner, mi), ring);
  g.position.set(x, y, 0);
  ds.push(outer, inner, mo, mi, ringGeo);
  return g;
}

/** đoàn tàu đơn giản (hộp + cửa sổ phát sáng) chạy dọc Z */
function train(color: string, w: number, h: number, cars: number, ds: D[]): THREE.Group {
  const g = new THREE.Group();
  const win = tex(128, 32, c => { c.fillStyle = color; c.fillRect(0, 0, 128, 32); c.fillStyle = "#fff6c8"; for (let i = 0; i < 6; i++) c.fillRect(6 + i * 21, 8, 14, 12); });
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", map: win, emissive: "#ffffff", emissiveMap: win, emissiveIntensity: 0.35, roughness: 0.5 });
  const geo = new THREE.BoxGeometry(w, h, 18);
  for (let i = 0; i < cars; i++) { const m = new THREE.Mesh(geo, mat); m.position.z = i * 18.6; g.add(m); }
  ds.push(win, mat, geo);
  return g;
}

/** thanh vạch độ sâu: đường ngang đỏ + chấm */
function depthLine(width: number, ds: D[]): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(width, 0.15, 0.15), mat = new THREE.MeshBasicMaterial({ color: "#ff4d3d", toneMapped: false, transparent: true, opacity: 0.9 });
  g.add(new THREE.Mesh(geo, mat)); ds.push(geo, mat);
  return g;
}

const lbl = (x: number, y: number, z: number, text: string): SceneLabel => ({ pos: new THREE.Vector3(x, y, z), text });
const clone = (l: SceneLabel[]): SceneLabel[] => l.map(x => ({ pos: x.pos.clone(), text: x.text }));

/* =====================================================================
   1. MẶT ĐƯỜNG KÍNH
   ===================================================================== */
export class TokyoGlassStreet implements ScenePrefab {
  id = "tokyo_glass_street" as const;
  root = new THREE.Group();
  private anchor = new THREE.Vector3();
  private bg = new THREE.Color("#a9cdeb");
  private trainG: THREE.Group;
  private flow: THREE.Mesh[] = [];
  private glassMat: THREE.MeshStandardMaterial;
  private labelList: SceneLabel[] = [];
  private ds: D[] = [];

  constructor() {
    const ds = this.ds;
    // kính: tấm mờ xanh nhạt + đường kẻ ô
    const grid = tex(256, 256, g => { g.fillStyle = "rgba(200,230,255,0.35)"; g.fillRect(0, 0, 256, 256); g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 4; g.strokeRect(2, 2, 252, 252); g.fillStyle = "rgba(255,255,255,0.85)"; g.fillRect(124, 0, 8, 256); });
    grid.wrapS = grid.wrapT = THREE.RepeatWrapping; grid.repeat.set(12, 10);
    this.glassMat = new THREE.MeshStandardMaterial({ map: grid, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
    const glassGeo = new THREE.PlaneGeometry(36, 30); glassGeo.rotateX(-Math.PI / 2);
    const glass = new THREE.Mesh(glassGeo, this.glassMat); glass.renderOrder = 5;
    this.root.add(glass); ds.push(grid, this.glassMat, glassGeo);
    // vạch kẻ đường trắng (trên kính)
    const lineMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.8 });
    const lineGeo = new THREE.PlaneGeometry(0.25, 2.4); lineGeo.rotateX(-Math.PI / 2); ds.push(lineMat, lineGeo);
    for (let z = -14; z <= 14; z += 4.5) { const l = new THREE.Mesh(lineGeo, lineMat); l.position.set(3, 0.01, z); this.root.add(l); }
    // hộp đất (chỉ thấy mặt trong): vách + đáy
    const soil = soilTex("#6b4f3a", 3, 10); soil.wrapS = soil.wrapT = THREE.RepeatWrapping; soil.repeat.set(3, 2);
    const soilMat = new THREE.MeshStandardMaterial({ map: soil, roughness: 1, side: THREE.BackSide });
    const boxGeo = new THREE.BoxGeometry(36, 14, 30); boxGeo.translate(0, -7.02, 0);
    // bỏ mặt trên (index group 2) bằng mảng vật liệu
    const none = new THREE.MeshBasicMaterial({ visible: false });
    const box = new THREE.Mesh(boxGeo, [soilMat, soilMat, none, soilMat, soilMat, soilMat]);
    this.root.add(box); ds.push(soil, soilMat, boxGeo, none);
    // ống: nước (xanh), ga (vàng), điện (cam, ống bó), cáp quang (xanh lá), cống (xám to)
    const mk = (c: string, e = 0) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.2, emissive: c, emissiveIntensity: e }); ds.push(m); return m; };
    const water = mk("#2f8fff", 0.15), gas = mk("#ffcc33", 0.12), power = mk("#ff7a2e", 0.12), fiber = mk("#3ddc84", 0.25), sewer = mk("#8c9399");
    this.root.add(
      pipeZ(0.35, 30, water, -3.2, -1.3, ds), pipeZ(0.25, 30, gas, -1.6, -1.0, ds),
      pipeZ(0.18, 30, power, 1.4, -0.8, ds), pipeZ(0.18, 30, power, 1.85, -0.8, ds), pipeZ(0.18, 30, power, 1.62, -1.15, ds),
      pipeZ(0.08, 30, fiber, 2.8, -0.6, ds), pipeZ(0.08, 30, fiber, 3.0, -0.6, ds),
      pipeZ(0.9, 30, sewer, -6.5, -2.6, ds),
    );
    // dòng chảy trong ống nước: chấm sáng trượt
    const dotGeo = new THREE.SphereGeometry(0.12, 10, 8), dotMat = new THREE.MeshBasicMaterial({ color: "#bfe3ff", toneMapped: false }); ds.push(dotGeo, dotMat);
    for (let i = 0; i < 8; i++) { const d = new THREE.Mesh(dotGeo, dotMat); d.position.set(-3.2, -1.3, 0); this.flow.push(d); this.root.add(d); }
    // nắp cống
    const mhGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.06, 28), mhMat = new THREE.MeshStandardMaterial({ color: "#4d5257", metalness: 0.6, roughness: 0.5 }); ds.push(mhGeo, mhMat);
    const mh = new THREE.Mesh(mhGeo, mhMat); mh.position.set(-6.5, 0.03, 3); this.root.add(mh);
    const shaftGeo = new THREE.CylinderGeometry(0.55, 0.55, 2.5, 20, 1, true), shaftMat = new THREE.MeshStandardMaterial({ color: "#9a9a92", side: THREE.DoubleSide }); ds.push(shaftGeo, shaftMat);
    const shaft = new THREE.Mesh(shaftGeo, shaftMat); shaft.position.set(-6.5, -1.25, 3); this.root.add(shaft);
    // đường hầm tàu Ginza (~8 m) + đoàn tàu vàng cam chạy
    this.root.add(tunnelZ(3.2, 30, 1.5, -8.5, ds, "#b5b9be"));
    this.trainG = train("#f39800", 2.6, 2.8, 4, ds); this.trainG.position.set(1.5, -9.2, 0); this.root.add(this.trainG);
    // nhà hai bên đường (khối có cửa sổ)
    const winTex = tex(64, 128, g => { g.fillStyle = "#d8d4cc"; g.fillRect(0, 0, 64, 128); g.fillStyle = "#5c7590"; for (let y = 6; y < 128; y += 16) for (let x = 6; x < 64; x += 20) g.fillRect(x, y, 12, 9); });
    winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping; ds.push(winTex);
    const R = rng(12);
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1, h = 6 + R() * 22, w = 5 + R() * 3;
      const geo = new THREE.BoxGeometry(w, h, 5 + R() * 3); geo.translate(0, h / 2, 0);
      const t = winTex.clone(); t.repeat.set(w / 4, h / 4); t.needsUpdate = true;
      const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
      const b = new THREE.Mesh(geo, m); b.position.set(side * (12 + R() * 3), 0, -14 + Math.floor(i / 2) * 6.5); b.castShadow = true;
      this.root.add(b); ds.push(geo, m, t);
    }
    // ánh sáng
    const sun = new THREE.DirectionalLight("#fff4e0", 2.6); sun.position.set(8, 16, 10);
    const hemi = new THREE.HemisphereLight("#d6ecff", "#5a4535", 1.1);
    const under = new THREE.PointLight("#ffe6b0", 30, 30, 1.5); under.position.set(0, -4, 4);
    this.root.add(sun, hemi, under);
    this.labelList = [
      lbl(-3.2, -1.3, 6, "水道管"), lbl(-1.6, -1.0, 9, "ガス管"), lbl(1.6, -0.8, 7, "電線"), lbl(2.9, -0.6, 10, "光ファイバー"),
      lbl(-6.5, -2.6, 8, "下水道"), lbl(1.5, -5.8, 6, "地下鉄 銀座線"),
    ];
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = new THREE.Fog("#a9cdeb", 40, 120); }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    character.root.position.copy(this.anchor); character.root.rotation.set(0, 0.3, 0);
    const z = ((ctx.t * 9) % 90) - 60;           // tàu chạy qua, lặp mỗi 10 giây
    this.trainG.position.z = z;
    this.flow.forEach((d, i) => { d.position.z = (((ctx.t * 2.5 + i * 3.75) % 30) + 30) % 30 - 15; });
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return clone(this.labelList); }
  dispose(): void { this.ds.forEach(d => d.dispose()); }
}

/* =====================================================================
   2. LÁT CẮT HẠ TẦNG 0–60 m (1 đơn vị = 1 m)
   ===================================================================== */
export class TokyoDeepInfra implements ScenePrefab {
  id = "tokyo_deep_infra" as const;
  root = new THREE.Group();
  private bg = new THREE.Color("#0d1420");
  private anchor = new THREE.Vector3();
  private line: THREE.Group;
  private trains: { g: THREE.Group; speed: number; off: number }[] = [];
  private water: THREE.Mesh;
  private labelList: SceneLabel[] = [];
  private ds: D[] = [];

  constructor() {
    const ds = this.ds, W = 90, H = 62;
    // mặt cắt phía sau: các lớp đất (ghi tên bằng nhãn)
    const layers: [number, number, string][] = [[0, 4, "#7a5a3c"], [4, 12, "#9a4f2e"], [12, 22, "#b89a6a"], [22, 36, "#8a7a62"], [36, 62, "#6a6052"]];
    for (const [a, b, c] of layers) {
      const t = soilTex(c, Math.round(a * 7 + 1), 8); ds.push(t);
      const geo = new THREE.PlaneGeometry(W, b - a), mat = new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
      const m = new THREE.Mesh(geo, mat); m.position.set(0, -(a + b) / 2, -6); this.root.add(m); ds.push(geo, mat);
    }
    // nền đất tối phía dưới mặt cắt (đáy)
    const floorGeo = new THREE.PlaneGeometry(W, 12); floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: "#3a332b" }); const fl = new THREE.Mesh(floorGeo, floorMat); fl.position.set(0, -H, 0); this.root.add(fl); ds.push(floorGeo, floorMat);
    // mặt đất + nhà phía trên
    const roadGeo = new THREE.BoxGeometry(W, 0.6, 12); roadGeo.translate(0, -0.3, 0);
    const roadMat = new THREE.MeshStandardMaterial({ color: "#3d4045" }); this.root.add(new THREE.Mesh(roadGeo, roadMat)); ds.push(roadGeo, roadMat);
    const R = rng(4);
    for (let i = 0; i < 9; i++) {
      const h = 8 + R() * 30, w = 6 + R() * 4, x = -40 + i * 10;
      if (Math.abs(x) < 6) continue;
      const geo = new THREE.BoxGeometry(w, h, 6); geo.translate(0, h / 2, -3);
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.58, 0.08, 0.55 + R() * 0.2), roughness: 0.8 });
      const b = new THREE.Mesh(geo, mat); b.position.x = x; this.root.add(b); ds.push(geo, mat);
    }
    // ống nông (0,5–3 m)
    const mk = (c: string) => { const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25, roughness: 0.5 }); ds.push(m); return m; };
    this.root.add(pipeZ(0.4, 12, mk("#2f8fff"), -8, -1.4, ds), pipeZ(0.3, 12, mk("#ffcc33"), -5, -1.1, ds), pipeZ(0.25, 12, mk("#ff7a2e"), 4, -0.9, ds), pipeZ(1.0, 12, mk("#8c9399"), 9, -3.0, ds));
    // tàu Ginza ~8 m (nông), Chiyoda ~37,9 m, Oedo ga Roppongi 42,3 m
    const tun = (x: number, y: number, r: number, color: string, speed: number, off: number) => {
      this.root.add(tunnelZ(r, 12, x, y, ds));
      const g = train(color, r * 0.8, r * 0.8, 3, ds); g.position.set(x, y - r * 0.25, 0); this.root.add(g);
      this.trains.push({ g, speed, off });
    };
    tun(-14, -8, 3.2, "#f39800", 7, 0);
    tun(-28, -37.9 + 3, 3.4, "#00bb85", -6, 4);
    // ga Roppongi: hộp sân ga + đường hầm 2 bên
    const stGeo = new THREE.BoxGeometry(24, 7, 10); stGeo.translate(0, 3.5, 0);
    const stMat = new THREE.MeshStandardMaterial({ color: "#c9cdd2", transparent: true, opacity: 0.55, depthWrite: false });
    const st = new THREE.Mesh(stGeo, stMat); st.position.set(14, -42.3 - 0.5, 0); this.root.add(st); ds.push(stGeo, stMat);
    const platGeo = new THREE.BoxGeometry(22, 1, 3), platMat = new THREE.MeshStandardMaterial({ color: "#e6e2d8" });
    const plat = new THREE.Mesh(platGeo, platMat); plat.position.set(14, -42.3, 0); this.root.add(plat); ds.push(platGeo, platMat);
    const oedo = train("#b6007a", 2.6, 2.8, 3, ds); oedo.position.set(14, -41.3, 0); oedo.rotation.y = Math.PI / 2; this.root.add(oedo);
    this.trains.push({ g: oedo, speed: 0, off: 0 });
    // hồ điều tiết dưới vành đai 7: đường hầm Ø12,5 m, ở ~40–52 m, có nước dâng theo env
    this.root.add(tunnelZ(6.25, 12, 34, -46, ds, "#a8b0b8"));
    const wGeo = new THREE.CylinderGeometry(5.5, 5.5, 11.8, 32); wGeo.rotateX(Math.PI / 2);
    const wMat = new THREE.MeshStandardMaterial({ color: "#3d8fd8", transparent: true, opacity: 0.7, emissive: "#1d4f80", emissiveIntensity: 0.4 });
    this.water = new THREE.Mesh(wGeo, wMat); this.water.position.set(34, -46, 0); this.root.add(this.water); ds.push(wGeo, wMat);
    // thước độ sâu bên trái
    const tickMat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }); ds.push(tickMat);
    for (let d = 0; d <= 60; d += 10) { const geo = new THREE.BoxGeometry(d % 20 ? 1.2 : 2.4, 0.18, 0.1); ds.push(geo); const t = new THREE.Mesh(geo, tickMat); t.position.set(-44, -d, 1); this.root.add(t); }
    const rulerGeo = new THREE.BoxGeometry(0.2, 60, 0.1); ds.push(rulerGeo); const ruler = new THREE.Mesh(rulerGeo, tickMat); ruler.position.set(-44.6, -30, 1); this.root.add(ruler);
    // vạch độ sâu
    this.line = depthLine(W, ds); this.line.position.z = 2; this.root.add(this.line);
    // đèn
    this.root.add(new THREE.AmbientLight("#ffffff", 0.9));
    const key = new THREE.DirectionalLight("#ffffff", 2.2); key.position.set(-20, 30, 40); this.root.add(key);
    this.labelList = [
      lbl(-8, -1.4, 6, "水道・ガス"), lbl(-14, -3.5, 6, "銀座線 約8m"), lbl(-28, -30.5, 6, "千代田線 国会議事堂前 37.9m"),
      lbl(14, -34.5, 6, "大江戸線 六本木駅 42.3m"), lbl(34, -38.5, 6, "地下調節池 直径12.5m"),
      lbl(-41, -10, 1, "10m"), lbl(-41, -20, 1, "20m"), lbl(-41, -30, 1, "30m"), lbl(-41, -40, 1, "40m"), lbl(-41, -50, 1, "50m"),
    ];
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = null; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const depthM = Math.max(0, ctx.hud.depthKm * 1000);
    const env = (ctx.beat.env ?? {}) as { weather?: string };
    character.root.position.set(0, 0, 3); character.root.rotation.set(0, 0.2, 0);
    this.line.position.y = -depthM; this.line.visible = depthM > 0.3;
    for (const t of this.trains) if (t.speed) t.g.position.z = ((((ctx.t + t.off) * t.speed) % 80) + 80) % 80 - 50;
    // nước trong hồ điều tiết: dâng lên khi beat có mưa lớn
    const fill = env.weather === "heavy_rain" ? clamp(0.1 + ctx.lp * 1.2) : 0;
    this.water.scale.set(1, Math.max(0.01, fill), 1); this.water.position.y = -46 - 5.5 * (1 - fill); this.water.visible = fill > 0.06;
    // góc máy: infra_follow bám vạch độ sâu
    const preset = ctx.beat.cameraPreset as string;
    this.anchor.set(preset === "infra_follow" ? 0 : 0, preset === "infra_follow" ? -depthM : preset === "infra_wide" ? -26 : 0, 0);
    if (preset === "infra_kai") this.anchor.set(0, 0, 3);
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return clone(this.labelList); }
  dispose(): void { this.ds.forEach(d => d.dispose()); }
}

/* =====================================================================
   3. LÁT CẮT ĐỊA TẦNG 0–3.000 m (1 đơn vị = 10 m) + suối nóng + Skytree
   ===================================================================== */
export class TokyoStrataOnsen implements ScenePrefab {
  id = "tokyo_strata_onsen" as const;
  root = new THREE.Group();
  private bg = new THREE.Color("#0b1018");
  private anchor = new THREE.Vector3();
  private line: THREE.Group;
  private hot: THREE.Mesh;
  private steam: THREE.Points;
  private labelList: SceneLabel[] = [];
  private ds: D[] = [];

  constructor() {
    const ds = this.ds, W = 360;
    // [từ m, đến m, màu, tên]
    const L: [number, number, string, string][] = [
      [0, 20, "#9a4f2e", "関東ローム・砂れき"], [20, 300, "#b7a07a", "東京層群（砂と泥）"],
      [300, 1500, "#7d6b55", "上総層群（黒湯の温泉）"], [1500, 3000, "#5c5248", "三浦層群など古い地層"], [3000, 3400, "#3b3f47", "地震基盤（かたい岩盤）"],
    ];
    L.forEach(([a, b, c], i) => {
      const t = soilTex(c, 20 + i, 14); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, Math.max(1, (b - a) / 400)); ds.push(t);
      const geo = new THREE.BoxGeometry(W, (b - a) / 10, 10), mat = new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
      const m = new THREE.Mesh(geo, mat); m.position.set(0, -(a + b) / 20, -5.5); this.root.add(m); ds.push(geo, mat);
      this.labelList.push(lbl(-110, -(a + b) / 20, 0.5, L[i][3]));
    });
    // giếng suối nóng tới 1.500 m (x = 40)
    const pipeGeo = new THREE.CylinderGeometry(0.5, 0.5, 150, 12); pipeGeo.translate(0, -75, 0);
    const pipeMat = new THREE.MeshStandardMaterial({ color: "#c8ccd0", metalness: 0.5, roughness: 0.4 });
    const pipe = new THREE.Mesh(pipeGeo, pipeMat); pipe.position.set(40, 0, 0.5); this.root.add(pipe); ds.push(pipeGeo, pipeMat);
    const hotGeo = new THREE.SphereGeometry(4, 24, 16), hotMat = new THREE.MeshBasicMaterial({ color: "#ff9a3d", transparent: true, opacity: 0.6, toneMapped: false });
    this.hot = new THREE.Mesh(hotGeo, hotMat); this.hot.position.set(40, -150, 0.5); this.root.add(this.hot); ds.push(hotGeo, hotMat);
    this.labelList.push(lbl(40, -142, 1, "温泉 1500m"));
    // nhà tắm suối nóng nhỏ trên mặt đất + hơi nước
    const bathGeo = new THREE.BoxGeometry(10, 4, 6); bathGeo.translate(0, 2, 0);
    const bathMat = new THREE.MeshStandardMaterial({ color: "#7a5236" }); const bath = new THREE.Mesh(bathGeo, bathMat); bath.position.set(40, 0, -1); this.root.add(bath); ds.push(bathGeo, bathMat);
    const sp = new Float32Array(60 * 3); for (let i = 0; i < 60; i++) { sp[i * 3] = 40; sp[i * 3 + 1] = 4; sp[i * 3 + 2] = 0; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const sm = new THREE.PointsMaterial({ color: "#ffffff", size: 1.6, transparent: true, opacity: 0.5, depthWrite: false });
    this.steam = new THREE.Points(sg, sm); this.root.add(this.steam); ds.push(sg, sm);
    // Skytree 634 m (63,4 đơn vị) để so sánh, ở x = -40
    const sk = new THREE.Group();
    const towerGeo = new THREE.CylinderGeometry(0.8, 3.2, 63.4, 3); towerGeo.translate(0, 31.7, 0);
    const towerMat = new THREE.MeshStandardMaterial({ color: "#dfe8f2", metalness: 0.4, roughness: 0.4 });
    const deckGeo = new THREE.CylinderGeometry(2.2, 2.2, 1.6, 20), deckMat = new THREE.MeshStandardMaterial({ color: "#9fc6ff", emissive: "#4f86d0", emissiveIntensity: 0.5 });
    const d1 = new THREE.Mesh(deckGeo, deckMat); d1.position.y = 35; const d2 = new THREE.Mesh(deckGeo, deckMat); d2.position.y = 45; d2.scale.setScalar(0.75);
    sk.add(new THREE.Mesh(towerGeo, towerMat), d1, d2); sk.position.set(-40, 0, -1); this.root.add(sk); ds.push(towerGeo, towerMat, deckGeo, deckMat);
    this.labelList.push(lbl(-40, 66, 0, "スカイツリー 634m"));
    // mặt đất & phố
    const gGeo = new THREE.BoxGeometry(W, 0.8, 12); gGeo.translate(0, -0.4, 0); const gMat = new THREE.MeshStandardMaterial({ color: "#4a4f55" });
    this.root.add(new THREE.Mesh(gGeo, gMat)); ds.push(gGeo, gMat);
    const R = rng(9);
    for (let i = 0; i < 44; i++) { const h = 2 + R() * 14, x = -176 + i * 8; if (Math.abs(x - 40) < 8 || Math.abs(x + 40) < 6) continue; const geo = new THREE.BoxGeometry(5, h, 5); geo.translate(0, h / 2, -3); const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.6, 0.06, 0.5 + R() * 0.25) }); const b = new THREE.Mesh(geo, mat); b.position.x = x; this.root.add(b); ds.push(geo, mat); }
    // thước độ sâu (mỗi 500 m)
    const tickMat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }); ds.push(tickMat);
    for (let d = 0; d <= 3000; d += 500) { const geo = new THREE.BoxGeometry(6, 0.5, 0.2); ds.push(geo); const t = new THREE.Mesh(geo, tickMat); t.position.set(W / 2 - 8, -d / 10, 0.5); this.root.add(t); if (d) this.labelList.push(lbl(W / 2 - 16, -d / 10, 0.5, `${d}m`)); }
    this.line = depthLine(W, ds); this.line.scale.set(1, 4, 4); this.line.position.z = 1; this.root.add(this.line);
    this.root.add(new THREE.AmbientLight("#ffffff", 1.0));
    const key = new THREE.DirectionalLight("#ffffff", 2); key.position.set(-50, 80, 120); this.root.add(key);
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = null; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    character.root.visible = false;
    const depthM = Math.max(0, ctx.hud.depthKm * 1000);
    this.line.position.y = -depthM / 10; this.line.visible = depthM > 1;
    (this.hot.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.25 * Math.sin(ctx.t * 3);
    const a = (this.steam.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < 60; i++) { const ph = ((ctx.t * 0.4 + i / 60) % 1); a[i * 3] = 40 + Math.sin(i * 7.1 + ctx.t) * 2 * ph; a[i * 3 + 1] = 4 + ph * 14; a[i * 3 + 2] = Math.cos(i * 3.3) * 2; }
    this.steam.geometry.attributes.position.needsUpdate = true;
    const preset = ctx.beat.cameraPreset as CameraPreset | string;
    if (preset === "strata_follow") this.anchor.set(0, -depthM / 10, 0);
    else if (preset === "strata_top") this.anchor.set(0, 10, 0);
    else this.anchor.set(0, -150, 0);
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return clone(this.labelList); }
  dispose(): void { this.ds.forEach(d => d.dispose()); }
}

export const createTokyoScenes = (): Record<"tokyo_glass_street" | "tokyo_deep_infra" | "tokyo_strata_onsen", ScenePrefab> => ({
  tokyo_glass_street: new TokyoGlassStreet(),
  tokyo_deep_infra: new TokyoDeepInfra(),
  tokyo_strata_onsen: new TokyoStrataOnsen(),
});
