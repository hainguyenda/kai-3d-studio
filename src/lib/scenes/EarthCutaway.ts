import * as THREE from "three";
import type { CharacterLike, FrameCtx, ScenePrefab, SceneLabel } from "../types";
import { clamp, easeOut, rng } from "../math";
import { createNebulaTexture } from "../textures";
import { earthAssets, HOME_LATLON } from "../earthAssets";
import { applyCameraPreset } from "./cameraPresets";
import { arrowAlong, disposeGeometries, PulseMarker } from "./markers";

const R = 3, DEG = Math.PI / 180;
/** trục Trái Đất = +y, mặt cắt = mặt phẳng z = 0 (kinh tuyến qua nhà). Nhà nằm trên mép mặt cắt */
const HOME = new THREE.Vector3(Math.cos(HOME_LATLON.lat * DEG), Math.sin(HOME_LATLON.lat * DEG), 0).multiplyScalar(R);
const ANTI = HOME.clone().negate();

/** bán kính tương đối của các lớp (thực tế; riêng vỏ được phóng to để nhìn thấy) */
const LAYERS = { crust: 0.972, upperMantle: 0.896, outerCore: 0.546, innerCore: 0.192 };

/** vẽ mặt cắt các lớp: vỏ → manti → lõi ngoài → lõi trong */
export function createCrossSectionTexture(size = 2048): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"); if (!g) throw new Error("Canvas 2D không khả dụng");
  const m = size / 2, rr = (f: number) => f * m;
  const ring = (f: number, inner: string, outer: string, fi = 0) => {
    const gr = g.createRadialGradient(m, m, rr(fi), m, m, rr(f));
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.beginPath(); g.arc(m, m, rr(f), 0, Math.PI * 2); g.fill();
  };
  ring(1, "#e9b48e", "#dfa27c", LAYERS.crust);
  ring(LAYERS.crust, "#ec9a6c", "#e8916a", LAYERS.upperMantle);
  ring(LAYERS.upperMantle, "#ef8f5c", "#e98a5f", LAYERS.outerCore);
  ring(LAYERS.outerCore, "#ffc565", "#f6a84f", LAYERS.innerCore);
  ring(LAYERS.innerCore, "#fff8e2", "#ffe3a3", 0);
  // hạt nhiễu nhẹ cho cảm giác vật liệu
  const img = g.getImageData(0, 0, size, size), d = img.data, rand = rng(5);
  for (let i = 0; i < d.length; i += 4) { const n = (rand() - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  // đường ranh giới mảnh
  g.strokeStyle = "rgba(120,55,25,0.22)"; g.lineWidth = size * 0.0012;
  for (const f of [LAYERS.crust, LAYERS.upperMantle, LAYERS.outerCore, LAYERS.innerCore]) { g.beginPath(); g.arc(m, m, rr(f), 0, Math.PI * 2); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

/** Trái Đất bổ đôi: nửa quả cầu ảnh vệ tinh + mặt cắt các lớp, đường xuyên tâm, chấm vị trí nhân vật, lớp minh hoạ */
export class EarthCutaway implements ScenePrefab {
  id = "earth_cutaway" as const;
  root = new THREE.Group();
  private bodyMat: THREE.MeshStandardMaterial;
  private marker: PulseMarker;
  private rotArrows = new THREE.Group();
  private field = new THREE.Group();
  private wave: THREE.Mesh;
  private waveMat: THREE.ShaderMaterial;
  private nebula: THREE.Texture;
  private labelList: SceneLabel[] = [];
  private disposables: { dispose(): void }[] = [];
  private epi = new THREE.Vector2(Math.cos(100 * DEG), Math.sin(100 * DEG)).multiplyScalar(R);

  constructor() {
    this.nebula = createNebulaTexture(); this.disposables.push(this.nebula);
    // nửa sau quả cầu (z ≤ 0), Nhật Bản xoay đúng vào vị trí nhà trên mép cắt
    const clip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
    this.bodyMat = new THREE.MeshStandardMaterial({ color: "#2a5d93", roughness: 0.85, clippingPlanes: clip });
    const body = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 120), this.bodyMat);
    const phi = ((HOME_LATLON.lon + 180) / 360) * Math.PI * 2;
    body.rotation.y = Math.atan2(Math.sin(phi), -Math.cos(phi));
    this.root.add(body); this.disposables.push(body.geometry, this.bodyMat);
    const assets = earthAssets();
    assets.onLoad(() => {
      if (!assets.day) return;
      const m = this.bodyMat;
      m.map = assets.day; m.emissiveMap = assets.day; m.emissive.set("#ffffff"); m.emissiveIntensity = 0.22; m.color.set("#ffffff");
      if (assets.normal) { m.normalMap = assets.normal; m.normalScale.set(0.85, -0.85); }
      m.needsUpdate = true;
    });

    // viền khí quyển
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color("#6fb6ff") } },
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 color; varying vec3 vN; void main(){ float i = pow(0.74 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(color, 1.0) * i * 0.8; }",
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 64, 48), atmoMat);
    this.root.add(atmo); this.disposables.push(atmoMat, atmo.geometry);

    // mặt cắt các lớp
    const secTex = createCrossSectionTexture();
    const secMat = new THREE.MeshBasicMaterial({ map: secTex, toneMapped: false });
    const sec = new THREE.Mesh(new THREE.CircleGeometry(R, 256), secMat);
    this.root.add(sec); this.disposables.push(secTex, secMat, sec.geometry);

    // đường đi xuyên tâm (trắng, viền tối mảnh)
    const lineGeo = new THREE.CylinderGeometry(1, 1, 1, 12); lineGeo.translate(0, 0.5, 0);
    const dir = ANTI.clone().sub(HOME), len = dir.length(), quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const mkLine = (r: number, color: string, z: number) => {
      const m = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
      m.scale.set(r, len, r); m.position.copy(HOME).setZ(z); m.quaternion.copy(quat);
      this.disposables.push(m.material as THREE.Material); return m;
    };
    this.root.add(mkLine(0.026, "#5a3420", 0.01), mkLine(0.016, "#ffffff", 0.03));
    this.disposables.push(lineGeo);

    // chấm vị trí nhân vật
    this.marker = new PulseMarker(0.3, "#ff7a3d", true);
    this.root.add(this.marker.group); this.disposables.push(this.marker);

    // lớp minh hoạ 1: tốc độ tự quay giảm dần theo độ sâu (mũi tên hướng Đông, dài ∝ khoảng cách tới trục)
    const arrowMat = new THREE.MeshBasicMaterial({ color: "#ffd99a", toneMapped: false, depthTest: false, transparent: true });
    this.disposables.push(arrowMat);
    for (const s of [0, 0.1, 0.2, 0.3, 0.4]) {
      const p = HOME.clone().lerp(ANTI, s), L = (p.x / R) * 1.5;
      if (L < 0.15) continue;
      const curve = new THREE.LineCurve3(p.clone().setZ(0.04), p.clone().setZ(0.04 - L));
      const a = arrowAlong(curve, 0.028, arrowMat); a.traverse(o => { o.renderOrder = 15; });
      this.rotArrows.add(a);
    }
    this.root.add(this.rotArrows);

    // lớp minh hoạ 2: từ trường (đường sức lưỡng cực quanh trục)
    const fieldMat = new THREE.MeshBasicMaterial({ color: "#d6e6ff", toneMapped: false, transparent: true, opacity: 0.85 });
    this.disposables.push(fieldMat);
    for (const Lr of [1.45, 1.95, 2.6, 3.5]) {
      const th0 = Math.asin(Math.sqrt(1 / Lr)) + 0.01;
      for (const side of [1, -1]) {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 80; i++) {
          const th = th0 + ((Math.PI - 2 * th0) * i) / 80, r = Lr * R * Math.sin(th) ** 2;
          pts.push(new THREE.Vector3(side * r * Math.sin(th), r * Math.cos(th), 0));
        }
        this.field.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.022, 6, false), fieldMat));
      }
    }
    this.root.add(this.field);

    // lớp minh hoạ 3: sóng địa chấn lan ra trong lòng đất (vòng tròn sáng, chỉ vẽ bên trong mặt cắt)
    this.waveMat = new THREE.ShaderMaterial({
      uniforms: { epi: { value: this.epi }, rad: { value: 0 }, R: { value: R } },
      vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec2 epi; uniform float rad; uniform float R; varying vec2 vP;\n        void main(){ float d = abs(length(vP - epi) - rad); float a = smoothstep(0.045, 0.0, d) * 0.95;\n          float trail = smoothstep(rad, rad - 0.9, length(vP - epi)) * step(length(vP - epi), rad) * 0.12;\n          a = max(a, trail); if (a < 0.01 || length(vP) > R) discard; gl_FragColor = vec4(1.0, 0.97, 0.92, a); }",
      transparent: true, depthWrite: false, toneMapped: false,
    });
    this.wave = new THREE.Mesh(new THREE.CircleGeometry(R, 128), this.waveMat);
    this.wave.position.z = 0.02; this.wave.renderOrder = 12;
    this.root.add(this.wave); this.disposables.push(this.waveMat, this.wave.geometry);

    const sun = new THREE.DirectionalLight("#ffffff", 3.0); sun.position.set(6, 6, 9);
    const hemi = new THREE.HemisphereLight("#cfe0ff", "#1a2030", 0.75);
    this.root.add(sun, hemi);
  }

  apply(scene: THREE.Scene): void { scene.background = this.nebula; scene.fog = null; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    character.root.visible = false;
    const o = ctx.beat.cutaway ?? {}, overlay = o.overlay ?? "none";
    const p = clamp(ctx.hud.progress), pos = HOME.clone().lerp(ANTI, p).setZ(0.05);
    this.marker.group.visible = !o.hideMarker;
    this.marker.group.position.copy(pos); this.marker.update(ctx.t);

    this.rotArrows.visible = overlay === "rotation";
    if (this.rotArrows.visible) this.rotArrows.children.forEach((a, i) => { const k = easeOut(ctx.lp * 2.2 - i * 0.18); a.scale.set(1, 1, Math.max(0.001, k)); });
    this.field.visible = overlay === "magnetic";
    this.wave.visible = overlay === "seismic";
    const rad = clamp(ctx.lp * 1.15) * R * 1.9;
    this.waveMat.uniforms.rad.value = rad;

    this.labelList = [];
    if (o.label) {
      const at = o.labelAt ?? (overlay === "seismic" ? "wave" : "marker");
      let lp: THREE.Vector3;
      if (at === "home") lp = HOME.clone();
      else if (at === "antipode") lp = ANTI.clone();
      else if (at === "center") lp = new THREE.Vector3();
      else if (at === "wave") { const d = this.epi.clone().negate().normalize().multiplyScalar(Math.min(rad, R * 1.7)); lp = new THREE.Vector3(this.epi.x + d.x, this.epi.y + d.y, 0); }
      else lp = pos.clone();
      this.labelList.push({ pos: lp, text: o.label });
    }

    const follow = ctx.beat.cameraPreset === "cut_follow";
    applyCameraPreset(camera, ctx.beat.cameraPreset, follow ? pos.clone().setZ(0) : new THREE.Vector3(), ctx.lp);
  }

  labels(): SceneLabel[] { return this.labelList; }

  dispose(): void { disposeGeometries(this.rotArrows); disposeGeometries(this.field); this.disposables.forEach(d => d.dispose()); }
}
