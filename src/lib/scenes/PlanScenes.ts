import * as THREE from "three";
import type { CameraPreset, CharacterLike, FrameCtx, ScenePrefab, SceneLabel } from "../types";
import { clamp, lerp, rng } from "../math";
import { createEarthTexture, fbm3 } from "../textures";
import { earthAssets } from "../earthAssets";
import { applyCameraPreset } from "./cameraPresets";
import { canvasTex, makeEarth, starField } from "./NewScenes";
import { skyColorAt } from "./SkyScenes";
import type { NewBeatFields } from "./newScenesData";

/* =====================================================================
   4 BỐI CẢNH ĐỂ PHỦ HẾT CÁC TẬP CÒN LẠI TRONG PLAN
   - ocean_world    : quả địa cầu rút cạn nước biển, lộ đáy đại dương (tập 23/12)
   - sea_level_city : thành phố + mực nước biển dâng theo mét (tập 28/12 băng Nam Cực tan)
   - whale_inside   : bên trong thân cá voi xanh, tim 180 kg đập (tập 1/1)
   - space_stairs   : cầu thang xoắn lên tới vũ trụ 100 km, màu trời + Trái Đất cong theo độ cao (tập 6/1)
   ===================================================================== */

type D = { dispose(): void };
const opt = <K extends keyof NewBeatFields>(ctx: FrameCtx, k: K): NonNullable<NewBeatFields[K]> =>
  ((ctx.beat as unknown as NewBeatFields)[k] ?? {}) as NonNullable<NewBeatFields[K]>;
const lbl = (p: THREE.Vector3, text: string): SceneLabel => ({ pos: p.clone(), text });
const preset = (ctx: FrameCtx) => ctx.beat.cameraPreset as CameraPreset | string;
const fromTo = (fixed: number | undefined, a: number | undefined, b: number | undefined, lp: number, dflt: number): number =>
  fixed ?? (a !== undefined ? lerp(a, b ?? a, lp) : b ?? dflt);

/** vị trí trên mặt cầu khớp UV của SphereGeometry (bản đồ equirect) */
const geo = (lat: number, lon: number, r: number): THREE.Vector3 => {
  const phi = ((lon + 180) / 360) * Math.PI * 2, th = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th));
};

/* ---------- 1. QUẢ ĐỊA CẦU KHÔNG CÒN NƯỚC BIỂN ---------- */
const OW_R = 10;
const MARIANA: [number, number] = [11.35, 142.2];

export class OceanWorld implements ScenePrefab {
  id = "ocean_world" as const;
  root = new THREE.Group();
  private globe = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private baseQ = new THREE.Quaternion();
  private bg = new THREE.Color("#02030a");
  private anchor = new THREE.Vector3();
  private labelList: SceneLabel[] = [];
  private ds: D[] = [];

  constructor() {
    const ds = this.ds;
    const stars = starField(2000, 400, 600, 71, 1.2); this.root.add(stars); ds.push(stars.geometry, stars.material as THREE.Material);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, water: { value: 1 }, sunDir: { value: new THREE.Vector3(-0.5, 0.45, 0.75).normalize() } },
      vertexShader: "varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `
        uniform sampler2D map; uniform float water; uniform vec3 sunDir;
        varying vec2 vUv; varying vec3 vN; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
        float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
        void main(){
          vec3 c = texture2D(map, vUv).rgb;
          float ratio = c.b / (max(c.r, c.g) + 0.004);
          float ocean = smoothstep(1.15, 1.7, ratio);
          float lum = c.r + c.g + c.b;
          float deep = 1.0 - smoothstep(0.03, 0.28, lum);
          float rough = n3(vP * 1.6) * 0.6 + n3(vP * 4.0) * 0.4;
          vec3 shelf = vec3(0.42, 0.33, 0.22), plain = vec3(0.20, 0.15, 0.11), abyss = vec3(0.08, 0.06, 0.06);
          vec3 bed = mix(shelf, plain, smoothstep(0.0, 0.5, deep));
          bed = mix(bed, abyss, smoothstep(0.55, 1.0, deep));
          bed *= 0.75 + rough * 0.5;
          vec3 col = mix(c, bed, ocean * (1.0 - water));
          float d = max(dot(normalize(vN), sunDir), 0.0);
          gl_FragColor = vec4(col * (0.22 + d * 1.1), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const g = new THREE.SphereGeometry(OW_R, 160, 120); ds.push(g, this.mat);
    this.globe.add(new THREE.Mesh(g, this.mat));
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color("#6fb6ff") } },
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform vec3 color; varying vec3 vN; varying vec3 vV; void main(){ float i = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), 4.0) * 0.9; gl_FragColor = vec4(color * i, 1.0); }",
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    const atmoGeo = new THREE.SphereGeometry(OW_R * 1.025, 64, 48); ds.push(atmoMat, atmoGeo);
    this.globe.add(new THREE.Mesh(atmoGeo, atmoMat));
    this.root.add(this.globe);
    // xoay để rãnh Mariana hướng về camera (+z), hơi nghiêng cho có chiều sâu
    this.baseQ.setFromUnitVectors(geo(MARIANA[0], MARIANA[1], 1).normalize(), new THREE.Vector3(0, 0.12, 1).normalize());
    const assets = earthAssets();
    assets.onLoad(() => {
      if (assets.day) this.mat.uniforms.map.value = assets.day;
      else { const t = createEarthTexture(7); this.mat.uniforms.map.value = t.map; ds.push(t.map, t.bump, t.rough); }
    });
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = null; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    character.root.visible = false;
    const o = opt(ctx, "world");
    const w = clamp(fromTo(o.water, o.waterFrom, o.waterTo, ctx.lp, 0));
    this.mat.uniforms.water.value = w;
    const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(ctx.t * 0.06) * 0.12);
    this.globe.quaternion.copy(spin).multiply(this.baseQ);
    this.globe.updateMatrixWorld(true);
    this.anchor.set(0, 0, 0);
    this.labelList = [];
    if (o.showNames !== false && w < 0.6) {
      this.labelList.push(lbl(this.globe.localToWorld(geo(MARIANA[0], MARIANA[1], OW_R * 1.03)), "マリアナ海溝 −10,920m"));
      this.labelList.push(lbl(this.globe.localToWorld(geo(27.99, 86.93, OW_R * 1.03)), "エベレスト 8,849m"));
    }
    if (o.label) this.labelList.push(lbl(new THREE.Vector3(0, OW_R * 1.25, 0), o.label));
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return this.labelList.map(l => lbl(l.pos, l.text)); }
  dispose(): void { this.ds.forEach(d => d.dispose()); }
}

/* ---------- 2. THÀNH PHỐ + MỰC NƯỚC BIỂN DÂNG (1 đơn vị = 1 m) ---------- */
const ROOF_H = 70;                      // toà nhà Kai đứng (≈ 20 tầng)
const SKYTREE = new THREE.Vector3(-260, 0, -420);

export class SeaLevelCity implements ScenePrefab {
  id = "sea_level_city" as const;
  root = new THREE.Group();
  private water: THREE.Mesh;
  private waterTex: THREE.CanvasTexture;
  private bg = new THREE.Color("#9cc8ec");
  private fog = new THREE.Fog("#b9d6ee", 600, 2000);
  private anchor = new THREE.Vector3();
  private labelList: SceneLabel[] = [];
  private ds: D[] = [];

  constructor() {
    const ds = this.ds;
    // mặt đất
    const gGeo = new THREE.PlaneGeometry(5000, 5000); gGeo.rotateX(-Math.PI / 2);
    const gMat = new THREE.MeshStandardMaterial({ color: "#7d8a72", roughness: 1 }); ds.push(gGeo, gMat);
    this.root.add(new THREE.Mesh(gGeo, gMat));
    // nhà cửa: phần lớn 8–40 m, vài toà 100–240 m
    const R = rng(77), N = 1400;
    const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
    const bMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.75 }); ds.push(bGeo, bMat);
    const blocks = new THREE.InstancedMesh(bGeo, bMat, N), m4 = new THREE.Matrix4(), c = new THREE.Color();
    const pal = ["#d8d9dc", "#c4c7cc", "#e6e1d6", "#b9bec6", "#d2cbbf", "#aeb6c0"];
    let k = 0;
    for (let i = 0; i < N * 3 && k < N; i++) {
      const x = (R() - 0.5) * 2400, z = (R() - 0.5) * 2400 - 300;
      if (Math.hypot(x, z) < 40 || Math.hypot(x - SKYTREE.x, z - SKYTREE.z) < 40) continue;
      const tall = R() < 0.05, h = tall ? 100 + R() * 140 : 8 + Math.pow(R(), 2) * 32, w = tall ? 30 + R() * 20 : 12 + R() * 18;
      m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(w, h, w * (0.7 + R() * 0.6)));
      blocks.setMatrixAt(k, m4); blocks.setColorAt(k, c.set(pal[Math.floor(R() * pal.length)])); k++;
    }
    blocks.count = k; this.root.add(blocks);
    // toà nhà Kai đứng trên nóc
    const kaiB = new THREE.Mesh(bGeo, new THREE.MeshStandardMaterial({ color: "#cfd3d8", roughness: 0.6 }));
    kaiB.scale.set(24, ROOF_H, 24); kaiB.position.set(0, 0, -6); this.root.add(kaiB); ds.push(kaiB.material as THREE.Material);
    // Skytree 634 m
    const stGeo = new THREE.CylinderGeometry(3, 34, 634, 3); stGeo.translate(0, 317, 0);
    const stMat = new THREE.MeshStandardMaterial({ color: "#eef3f8", metalness: 0.4, roughness: 0.3 }); ds.push(stGeo, stMat);
    const st = new THREE.Mesh(stGeo, stMat); st.position.copy(SKYTREE); this.root.add(st);
    const dGeo = new THREE.CylinderGeometry(14, 14, 12, 16); ds.push(dGeo);
    [350, 450].forEach(y => { const d = new THREE.Mesh(dGeo, stMat); d.position.set(SKYTREE.x, y, SKYTREE.z); this.root.add(d); });
    // cột thước đo cạnh toà nhà: vạch mỗi 10 m
    const poleGeo = new THREE.CylinderGeometry(0.4, 0.4, 100, 8); poleGeo.translate(0, 50, 0);
    const poleMat = new THREE.MeshStandardMaterial({ color: "#f4f4f4" }); ds.push(poleGeo, poleMat);
    const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(18, 0, 12); this.root.add(pole);
    const tickGeo = new THREE.BoxGeometry(3, 0.6, 0.6), tickMat = new THREE.MeshBasicMaterial({ color: "#e0453a" }); ds.push(tickGeo, tickMat);
    for (let y = 10; y <= 100; y += 10) { const t = new THREE.Mesh(tickGeo, tickMat); t.position.set(18, y, 12); this.root.add(t); }
    // nước
    this.waterTex = canvasTex(256, 256, g => {
      g.fillStyle = "#808080"; g.fillRect(0, 0, 256, 256); const Rw = rng(9);
      for (let i = 0; i < 400; i++) { g.fillStyle = Rw() < 0.5 ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)"; g.fillRect(Rw() * 256, Rw() * 256, 6 + Rw() * 30, 1 + Rw() * 2); }
    }, true);
    this.waterTex.repeat.set(60, 60);
    const wGeo = new THREE.PlaneGeometry(5000, 5000); wGeo.rotateX(-Math.PI / 2);
    const wMat = new THREE.MeshStandardMaterial({ color: "#3d7fb2", roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88, bumpMap: this.waterTex, bumpScale: 0.4 });
    this.water = new THREE.Mesh(wGeo, wMat); this.root.add(this.water); ds.push(wGeo, wMat, this.waterTex);
    const sun = new THREE.DirectionalLight("#fff3df", 2.6); sun.position.set(-600, 900, 700);
    this.root.add(sun, new THREE.HemisphereLight("#cfe6ff", "#5a6a50", 1.0));
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = this.fog; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const o = opt(ctx, "flood");
    const level = Math.max(0, fromTo(o.levelM, o.levelFrom, o.levelTo, ctx.lp, 0));
    this.water.position.y = Math.max(0.05, level);
    this.water.visible = level > 0.01;
    this.waterTex.offset.set(ctx.t * 0.01, ctx.t * 0.006);
    const roof = new THREE.Vector3(0, ROOF_H, 0);
    character.root.visible = true; character.setSpacesuit(false);
    character.root.position.copy(roof); character.root.rotation.set(0, 0.5, 0); character.root.scale.setScalar(1);
    const p = preset(ctx);
    if (p === "flood_street") this.anchor.copy(roof);
    else if (p === "flood_tower") this.anchor.copy(SKYTREE);
    else this.anchor.set(0, 0, 0);
    this.labelList = [];
    if (o.showNames !== false) {
      this.labelList.push(lbl(SKYTREE.clone().setY(670), "スカイツリー 634m"));
      if (p !== "flood_street") this.labelList.push(lbl(new THREE.Vector3(18, 108, 12), "100m"));
    }
    if (level > 0.01 || o.label) this.labelList.push(lbl(new THREE.Vector3(p === "flood_street" ? 0 : 18, (p === "flood_street" ? ROOF_H - 6 : level + 6), p === "flood_street" ? -18 : 12), o.label ?? `海面 +${Math.round(level)}m`));
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return this.labelList.map(l => lbl(l.pos, l.text)); }
  dispose(): void { this.ds.forEach(d => d.dispose()); }
}

/* ---------- 3. BÊN TRONG CÁ VOI XANH (1 đơn vị = 1 m) ---------- */
const BODY_R = 2.4;
const HEART = new THREE.Vector3(0, 1.3, -9);

export class WhaleInside implements ScenePrefab {
  id = "whale_inside" as const;
  root = new THREE.Group();
  private heart = new THREE.Group();
  private heartLight = new THREE.PointLight("#ff5a4a", 6, 9, 1.5);
  private bg = new THREE.Color("#2a0a0e");
  private fog = new THREE.FogExp2("#2a0a0e", 0.06);
  private anchor = new THREE.Vector3();
  private labelList: SceneLabel[] = [];
  private ds: D[] = [];

  constructor() {
    const ds = this.ds;
    // thành trong: ống thịt dài 30 m, bề mặt lồi lõm
    const tGeo = new THREE.CylinderGeometry(BODY_R, BODY_R, 34, 64, 80, true); tGeo.rotateX(Math.PI / 2);
    const tp = tGeo.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
    for (let i = 0; i < tp.count; i++) {
      v.fromBufferAttribute(tp, i);
      const a = Math.atan2(v.y, v.x), r = BODY_R * (1 + (fbm3(Math.cos(a) * 2, Math.sin(a) * 2, v.z * 0.4, 5, 4) - 0.5) * 0.35);
      const rr = v.y < -1.9 ? Math.max(r, 2.0) : r;                       // đáy phẳng hơn cho Kai đứng
      tp.setXYZ(i, Math.cos(a) * rr, Math.sin(a) * rr, v.z);
    }
    tGeo.computeVertexNormals();
    const fleshTex = canvasTex(256, 256, g => {
      g.fillStyle = "#b4505a"; g.fillRect(0, 0, 256, 256); const Rf = rng(12);
      for (let i = 0; i < 900; i++) { g.fillStyle = Rf() < 0.5 ? "rgba(255,170,170,0.12)" : "rgba(80,0,10,0.15)"; g.beginPath(); g.ellipse(Rf() * 256, Rf() * 256, 2 + Rf() * 10, 1 + Rf() * 4, Rf() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 40; i++) { g.strokeStyle = "rgba(120,10,30,0.35)"; g.lineWidth = 1 + Rf() * 2; g.beginPath(); let x = Rf() * 256, y = Rf() * 256; g.moveTo(x, y); for (let j = 0; j < 8; j++) { x += (Rf() - 0.5) * 40; y += (Rf() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    }, true);
    fleshTex.repeat.set(6, 8);
    const tMat = new THREE.MeshStandardMaterial({ map: fleshTex, side: THREE.BackSide, roughness: 0.45, metalness: 0.05, emissive: "#3a0810", emissiveIntensity: 0.5 });
    const tube = new THREE.Mesh(tGeo, tMat); tube.position.set(0, 2.1, -10); this.root.add(tube); ds.push(tGeo, tMat, fleshTex);
    // xương sườn: cung ngà mỗi 1,3 m
    const ribGeo = new THREE.TorusGeometry(BODY_R * 0.92, 0.11, 8, 40, Math.PI * 1.25);
    const ribMat = new THREE.MeshStandardMaterial({ color: "#efe2cf", roughness: 0.5 }); ds.push(ribGeo, ribMat);
    for (let z = 3; z > -24; z -= 1.3) { const r = new THREE.Mesh(ribGeo, ribMat); r.position.set(0, 2.1, z); r.rotation.z = Math.PI / 2 - Math.PI * 0.625; this.root.add(r); }
    // tim ≈ 1,5 m, 180 kg + động mạch chủ
    const hMat = new THREE.MeshStandardMaterial({ color: "#a3202f", roughness: 0.35, emissive: "#40060c", emissiveIntensity: 0.6 });
    const hGeo = new THREE.SphereGeometry(0.72, 40, 32);
    const hp = hGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < hp.count; i++) { v.fromBufferAttribute(hp, i); const s = 1 + (fbm3(v.x * 2, v.y * 2, v.z * 2, 3, 3) - 0.5) * 0.25 - Math.max(0, -v.y) * 0.25; hp.setXYZ(i, v.x * s, v.y * s * 1.15, v.z * s * 0.9); }
    hGeo.computeVertexNormals();
    this.heart.add(new THREE.Mesh(hGeo, hMat));
    const aGeo = new THREE.CylinderGeometry(0.22, 0.26, 1.6, 20); aGeo.translate(0, 0.8, 0); ds.push(hGeo, hMat, aGeo);
    [[-0.25, 0.15], [0.28, -0.05]].forEach(([x, rz]) => { const a = new THREE.Mesh(aGeo, hMat); a.position.set(x, 0.5, 0); a.rotation.z = rz; this.heart.add(a); });
    this.heart.position.copy(HEART); this.root.add(this.heart);
    this.heartLight.position.copy(HEART).add(new THREE.Vector3(0.8, 0.6, 1.5)); this.root.add(this.heartLight);
    const kaiLight = new THREE.PointLight("#ffd9b8", 5, 10, 1.4); kaiLight.position.set(1.2, 2.4, 3);
    this.root.add(kaiLight, new THREE.HemisphereLight("#ff9c8f", "#3a0a10", 0.7));
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = this.fog; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const o = opt(ctx, "whaleIn");
    character.root.visible = true; character.setSpacesuit(false);
    character.root.position.set(0, 0, 0); character.root.rotation.set(0, -0.35, 0); character.root.scale.setScalar(1);
    this.heart.visible = o.heart !== false;
    const bpm = o.bpm ?? 30, ph = (ctx.t * bpm / 60) % 1;
    const beat = Math.exp(-Math.pow((ph - 0.08) / 0.05, 2)) + 0.6 * Math.exp(-Math.pow((ph - 0.25) / 0.05, 2));
    this.heart.scale.setScalar(1 + beat * 0.07);
    this.heartLight.intensity = this.heart.visible ? 4 + beat * 5 : 0;
    const p = preset(ctx);
    if (p === "wi_heart") this.anchor.copy(HEART); else this.anchor.set(0, 0, 0);
    this.labelList = [];
    if (this.heart.visible && o.showNames !== false) this.labelList.push(lbl(HEART.clone().add(new THREE.Vector3(0, 1.4, 0)), o.label ?? "心臓 約180kg"));
    else if (o.label) this.labelList.push(lbl(new THREE.Vector3(0, 2.6, -3), o.label));
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return this.labelList.map(l => lbl(l.pos, l.text)); }
  dispose(): void { this.ds.forEach(d => d.dispose()); }
}

/* ---------- 4. CẦU THANG LÊN VŨ TRỤ ---------- */
const RISE = 0.18, DTH = 0.32, STEP_R = 0.72, NSTEP = 150;     // 0,18 m/bậc → 100 km ≈ 555.000 bậc
const EARTH_U = 800;                                         // Trái Đất phông nền (bán kính 800 đơn vị)
const MARKS: [number, string][] = [[3.776, "富士山の高さ 3,776m"], [8.849, "エベレストの高さ 8,849m"], [10, "旅客機の高さ 約10km"], [12, "成層圏へ 約12km"], [50, "成層圏の上端 約50km"], [100, "宇宙 カーマン・ライン 100km"], [400, "ISS 400km"]];

export class SpaceStairs implements ScenePrefab {
  id = "space_stairs" as const;
  root = new THREE.Group();
  private stairs = new THREE.Group();
  private earth: THREE.Group;
  private stars: THREE.Points;
  private bg = new THREE.Color();
  private fog = new THREE.Fog("#8ec5f0", 8, 45);
  private karman: THREE.Mesh;
  private anchor = new THREE.Vector3();
  private labelList: SceneLabel[] = [];
  private ds: D[] = [];

  constructor() {
    const ds = this.ds;
    this.stars = starField(1500, 300, 500, 17, 1.6); this.root.add(this.stars); ds.push(this.stars.geometry, this.stars.material as THREE.Material);
    const sm = this.stars.material as THREE.PointsMaterial; sm.transparent = true; sm.fog = false;
    // Trái Đất làm phông: vẽ trước mọi thứ, không che cầu thang
    this.earth = makeEarth(EARTH_U, ds);
    this.earth.traverse(o => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) { m.depthTest = false; m.depthWrite = false; (m as THREE.MeshStandardMaterial).fog = false; }
      (o as THREE.Mesh).renderOrder = -10;
    });
    // đặt Nhật Bản ngay dưới chân (không phải Bắc Cực)
    this.earth.quaternion.setFromUnitVectors(geo(35, 139, 1).normalize(), new THREE.Vector3(0, 1, 0));
    this.root.add(this.earth);
    // cột giữa + bậc thang xoắn + tay vịn
    const colGeo = new THREE.CylinderGeometry(0.16, 0.16, NSTEP * RISE, 16);
    const metal = new THREE.MeshStandardMaterial({ color: "#d9dde3", metalness: 0.6, roughness: 0.35 }); ds.push(colGeo, metal);
    this.root.add(new THREE.Mesh(colGeo, metal));
    const stepGeo = new THREE.BoxGeometry(0.95, 0.05, 0.36); stepGeo.translate(0.16 + 0.475, 0, 0);
    const stepMat = new THREE.MeshStandardMaterial({ color: "#e9edf2", metalness: 0.3, roughness: 0.45 }); ds.push(stepGeo, stepMat);
    const steps = new THREE.InstancedMesh(stepGeo, stepMat, NSTEP), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < NSTEP; i++) {
      const k = i - NSTEP / 2, a = k * DTH;
      m4.compose(new THREE.Vector3(0, k * RISE - 0.025, 0), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(1, 1, 1));
      steps.setMatrixAt(i, m4);
    }
    this.stairs.add(steps);
    const rail: THREE.Vector3[] = [];
    for (let i = 0; i <= NSTEP * 4; i++) { const k = i / 4 - NSTEP / 2, a = k * DTH; rail.push(new THREE.Vector3(Math.cos(a) * 1.12, k * RISE + 0.9, -Math.sin(a) * 1.12)); }
    const railGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), NSTEP * 4, 0.025, 6); ds.push(railGeo);
    this.stairs.add(new THREE.Mesh(railGeo, metal));
    this.root.add(this.stairs);
    // đường Kármán (100 km): tấm sáng mỏng
    const kGeo = new THREE.RingGeometry(1.5, 60, 64); kGeo.rotateX(-Math.PI / 2);
    const kMat = new THREE.MeshBasicMaterial({ color: "#7fd8ff", transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, fog: false }); ds.push(kGeo, kMat);
    this.karman = new THREE.Mesh(kGeo, kMat); this.root.add(this.karman);
    const sun = new THREE.DirectionalLight("#ffffff", 2.8); sun.position.set(-30, 40, 25);
    this.root.add(sun, new THREE.HemisphereLight("#cfe6ff", "#40506a", 0.9));
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = this.fog; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const o = opt(ctx, "stairs");
    const alt = Math.max(0, fromTo(o.altKm, o.altKmFrom, o.altKmTo, ctx.lp, 0));       // km
    // trời & sương theo độ cao
    skyColorAt(alt * 1000, this.bg); this.fog.color.copy(this.bg);
    this.fog.far = lerp(45, 120, clamp(alt / 60));
    (this.stars.material as THREE.PointsMaterial).opacity = clamp((alt - 25) / 40);
    // Trái Đất dưới chân: độ võng chân trời đúng với độ cao thật
    const d = Math.max(1.5, EARTH_U * alt / 6371);
    this.earth.position.set(0, -EARTH_U - d, 0);
    // Kai leo: bậc thang trôi xuống dưới chân (lặp vô hạn)
    const f = (ctx.t * 1.5) % 1;
    this.stairs.position.y = -f * RISE; this.stairs.rotation.y = -f * DTH;
    const kai = new THREE.Vector3(STEP_R, 0, 0);
    character.root.visible = true; character.setSpacesuit(alt > 15);
    character.root.position.copy(kai).setY(Math.abs(Math.sin(ctx.t * Math.PI * 1.5)) * 0.03);
    character.root.rotation.set(0, Math.PI, 0); character.root.scale.setScalar(1);
    // đường Kármán khi tới gần 100 km
    const ky = (100 - alt) * 1000;
    this.karman.visible = Math.abs(ky) < 40; this.karman.position.y = ky;
    this.anchor.copy(kai);
    // nhãn: mốc vừa đi qua + số bậc
    this.labelList = [];
    let mark: string | null = null;
    for (const [h, t] of MARKS) if (alt >= h * 0.98) mark = t;
    const sp = preset(ctx);
    if (mark && sp !== "st_up") this.labelList.push(lbl(new THREE.Vector3(-2.6, 0.6, 0.4), mark));
    const head = new THREE.Vector3(STEP_R, 2.3, 0);
    if (o.label) this.labelList.push(lbl(head, o.label));
    else if (o.showSteps !== false && sp !== "st_up") this.labelList.push(lbl(head, `高度 ${alt < 10 ? alt.toFixed(1) : Math.round(alt).toLocaleString("ja-JP")}km · ${Math.round(alt * 1000 / RISE).toLocaleString("ja-JP")}段`));
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return this.labelList.map(l => lbl(l.pos, l.text)); }
  dispose(): void { this.ds.forEach(d => d.dispose()); }
}

export const createPlanScenes = (): Record<"ocean_world" | "sea_level_city" | "whale_inside" | "space_stairs", ScenePrefab> => ({
  ocean_world: new OceanWorld(),
  sea_level_city: new SeaLevelCity(),
  whale_inside: new WhaleInside(),
  space_stairs: new SpaceStairs(),
});
