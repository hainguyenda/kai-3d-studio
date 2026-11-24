import * as THREE from "three";
import type { CharacterLike, FrameCtx, ScenePrefab, SceneLabel } from "../types";
import { clamp } from "../math";
import { createNebulaTexture } from "../textures";
import { earthAssets } from "../earthAssets";
import { applyCameraPreset } from "./cameraPresets";
import { createCrossSectionTexture } from "./EarthCutaway";
import { PulseMarker } from "./markers";

/*
  gravity_train – "tàu trọng lực": đường hầm thẳng (dây cung) xuyên lòng đất giữa 2 điểm.
  Trái Đất bổ đôi (mặt cắt z = 0), dây cung nằm ngang phía trên tâm, điểm đi bên trái, điểm đến bên phải.
  Vị trí khoang tàu = hud.progress (0 = điểm đi, 1 = điểm đến), chạy theo dao động điều hoà
  (tăng tốc nửa đầu, giảm tốc nửa sau) – đúng vật lý: thời gian luôn ≈ 42 phút với mọi đường hầm thẳng.
*/

const R = 3, DEG = Math.PI / 180;

export interface GravityTrainOptions {
  /** góc ở tâm giữa 2 điểm (độ). Tokyo → New York ≈ 97.5 (mặc định) */
  angleDeg?: number;
  /** tên điểm đi / điểm đến */
  from?: string;
  to?: string;
  /** hiện tên 2 điểm (mặc định bật) */
  showNames?: boolean;
  /** nhãn đi theo khoang tàu */
  label?: string;
  /** nhãn ở điểm sâu nhất (giữa đường hầm), ví dụ "最深 2,172km" */
  deepLabel?: string;
  /** mũi tên trọng lực: kéo về tâm (trắng) + phần kéo dọc đường hầm (vàng) */
  gravity?: boolean;
  /** thêm 2 đường hầm khác (xuyên tâm + ngắn) chạy cùng lúc → về đích cùng lúc */
  compare?: boolean;
  /** ẩn đường hầm chính (chỉ dùng khi compare) */
  hideMain?: boolean;
}

const chordPoint = (angleDeg: number, p: number, out = new THREE.Vector3()): THREE.Vector3 => {
  const h = (angleDeg / 2) * DEG, half = R * Math.sin(h), y = R * Math.cos(h);
  // dao động điều hoà: x = -half·cos(πp)
  return out.set(-half * Math.cos(Math.PI * clamp(p)), y, 0);
};

class Tunnel {
  group = new THREE.Group();
  capsule: THREE.Group;
  private mats: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];
  constructor(public angleDeg: number, private rotZ: number, color: string, capColor: string, radius: number) {
    const a = chordPoint(angleDeg, 0), b = chordPoint(angleDeg, 1), len = a.distanceTo(b);
    const outer = new THREE.CylinderGeometry(radius * 1.7, radius * 1.7, len, 16); outer.rotateZ(Math.PI / 2);
    const inner = new THREE.CylinderGeometry(radius, radius, len, 16); inner.rotateZ(Math.PI / 2);
    const mo = new THREE.MeshBasicMaterial({ color: "#3a1f12", toneMapped: false });
    const mi = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    const o = new THREE.Mesh(outer, mo), i = new THREE.Mesh(inner, mi);
    o.position.set(0, a.y, 0.015); i.position.set(0, a.y, 0.03);
    this.group.add(o, i);
    // khoang tàu: thân bo tròn + cửa sổ sáng
    this.capsule = new THREE.Group();
    const body = new THREE.CapsuleGeometry(radius * 2.2, radius * 6, 6, 16); body.rotateZ(Math.PI / 2);
    const mb = new THREE.MeshStandardMaterial({ color: capColor, emissive: capColor, emissiveIntensity: 0.45, roughness: 0.4, metalness: 0.3 });
    const win = new THREE.SphereGeometry(radius * 1.1, 12, 10);
    const mw = new THREE.MeshBasicMaterial({ color: "#bfe9ff", toneMapped: false });
    const cb = new THREE.Mesh(body, mb), w1 = new THREE.Mesh(win, mw), w2 = new THREE.Mesh(win, mw);
    w1.position.set(-radius * 1.6, 0, radius * 1.6); w2.position.set(radius * 1.6, 0, radius * 1.6);
    this.capsule.add(cb, w1, w2); this.capsule.position.z = 0.06;
    this.group.add(this.capsule);
    this.group.rotation.z = rotZ;
    this.mats.push(mo, mi, mb, mw); this.geos.push(outer, inner, body, win);
  }
  set(p: number): THREE.Vector3 {
    chordPoint(this.angleDeg, p, this.capsule.position); this.capsule.position.z = 0.06;
    return this.capsule.position.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), this.rotZ);
  }
  dispose(): void { this.mats.forEach(m => m.dispose()); this.geos.forEach(g => g.dispose()); }
}

export class GravityTrain implements ScenePrefab {
  id = "gravity_train" as const;
  root = new THREE.Group();
  private nebula: THREE.Texture;
  private bodyMat: THREE.MeshStandardMaterial;
  private main: Tunnel | null = null;
  private extras: Tunnel[] = [];
  private marker: PulseMarker;
  private gArrow: THREE.ArrowHelper;
  private cArrow: THREE.ArrowHelper;
  private labelList: SceneLabel[] = [];
  private disposables: { dispose(): void }[] = [];

  constructor() {
    this.nebula = createNebulaTexture(); this.disposables.push(this.nebula);
    // nửa sau quả cầu (ảnh vệ tinh) + mặt cắt các lớp
    const clip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
    this.bodyMat = new THREE.MeshStandardMaterial({ color: "#2a5d93", roughness: 0.85, clippingPlanes: clip });
    const body = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), this.bodyMat);
    body.rotation.y = -0.6;
    this.root.add(body); this.disposables.push(body.geometry, this.bodyMat);
    const assets = earthAssets();
    assets.onLoad(() => {
      if (!assets.day) return;
      const m = this.bodyMat;
      m.map = assets.day; m.emissiveMap = assets.day; m.emissive.set("#ffffff"); m.emissiveIntensity = 0.22; m.color.set("#ffffff");
      m.needsUpdate = true;
    });
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color("#6fb6ff") } },
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 color; varying vec3 vN; void main(){ float i = pow(0.74 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(color, 1.0) * i * 0.8; }",
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 64, 48), atmoMat);
    this.root.add(atmo); this.disposables.push(atmoMat, atmo.geometry);
    const secTex = createCrossSectionTexture();
    const secMat = new THREE.MeshBasicMaterial({ map: secTex, toneMapped: false });
    const sec = new THREE.Mesh(new THREE.CircleGeometry(R, 256), secMat);
    this.root.add(sec); this.disposables.push(secTex, secMat, sec.geometry);
    // viền mặt đất (xanh lá mảnh) để thấy rõ bề mặt
    const rimGeo = new THREE.RingGeometry(R * 0.985, R * 1.004, 256);
    const rimMat = new THREE.MeshBasicMaterial({ color: "#4fae5c", toneMapped: false });
    const rim = new THREE.Mesh(rimGeo, rimMat); rim.position.z = 0.01;
    this.root.add(rim); this.disposables.push(rimGeo, rimMat);

    // 2 đường hầm so sánh: xuyên tâm (180°) và ngắn (40°)
    this.extras = [new Tunnel(180, -0.55, "#d9f2ff", "#8fd3ff", 0.05), new Tunnel(50, 1.35, "#d9f2ff", "#b6f28f", 0.05)];
    this.extras.forEach(t => { this.root.add(t.group); this.disposables.push(t); });

    this.marker = new PulseMarker(0.22, "#ff7a3d", true);
    this.root.add(this.marker.group); this.disposables.push(this.marker);

    this.gArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 1, 0xffffff, 0.2, 0.13);
    this.cArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0xffd34d, 0.2, 0.13);
    for (const a of [this.gArrow, this.cArrow]) {
      a.traverse(o => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) { m.depthTest = false; (m as THREE.MeshBasicMaterial).toneMapped = false; } o.renderOrder = 30; });
      this.root.add(a);
    }

    const sun = new THREE.DirectionalLight("#ffffff", 3.0); sun.position.set(6, 6, 9);
    const hemi = new THREE.HemisphereLight("#cfe0ff", "#1a2030", 0.75);
    this.root.add(sun, hemi);
  }

  apply(scene: THREE.Scene): void { scene.background = this.nebula; scene.fog = null; }

  private mainFor(angle: number): Tunnel {
    if (this.main && this.main.angleDeg === angle) return this.main;
    if (this.main) { this.root.remove(this.main.group); this.main.dispose(); }
    this.main = new Tunnel(angle, 0, "#fff3d6", "#ff7a3d", 0.06);
    this.root.add(this.main.group);
    return this.main;
  }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    character.root.visible = false;
    const o: GravityTrainOptions = ctx.beat.gtrain ?? {};
    const angle = clamp(o.angleDeg ?? 97.5, 5, 180);
    const p = clamp(ctx.hud.progress);
    const main = this.mainFor(angle);
    main.group.visible = !o.hideMain;
    const pos = main.set(p);
    this.marker.group.visible = !o.hideMain;
    this.marker.group.position.copy(pos).setZ(0.1); this.marker.update(ctx.t);
    this.extras.forEach(t => { t.group.visible = !!o.compare; t.set(p); });

    // trọng lực: kéo về tâm, phần dọc đường hầm = -x (hướng về giữa đường hầm)
    const showG = !!o.gravity && !o.hideMain;
    this.gArrow.visible = this.cArrow.visible = showG;
    if (showG) {
      const toC = pos.clone().setZ(0).negate().normalize();
      this.gArrow.position.copy(pos).setZ(0.12); this.gArrow.setDirection(toC); this.gArrow.setLength(0.95, 0.2, 0.13);
      const along = -pos.x / (R * Math.sin((angle / 2) * DEG)); // -1..1
      const len = Math.abs(along) * 0.95 * Math.sin((angle / 2) * DEG);
      this.cArrow.visible = len > 0.06;
      this.cArrow.position.copy(pos).setZ(0.12); this.cArrow.setDirection(new THREE.Vector3(Math.sign(along) || 1, 0, 0));
      if (len > 0.06) this.cArrow.setLength(len, Math.min(0.2, len * 0.6), 0.13);
    }

    this.labelList = [];
    const a = chordPoint(angle, 0), b = chordPoint(angle, 1);
    if (o.showNames !== false && !o.hideMain) {
      this.labelList.push({ pos: a.clone().add(new THREE.Vector3(-0.15, 0.32, 0)), text: o.from ?? "東京" });
      this.labelList.push({ pos: b.clone().add(new THREE.Vector3(0.15, 0.32, 0)), text: o.to ?? "ニューヨーク" });
    }
    if (o.deepLabel && !o.hideMain) this.labelList.push({ pos: new THREE.Vector3(0, a.y - 1.0, 0), text: o.deepLabel });
    if (o.label) this.labelList.push({ pos: pos.clone().add(new THREE.Vector3(0, -0.55, 0)), text: o.label });

    const pr = ctx.beat.cameraPreset;
    const anchor = pr === "gt_follow" ? pos.clone().setZ(0) : pr === "gt_tunnel" ? new THREE.Vector3(0, a.y, 0) : new THREE.Vector3();
    applyCameraPreset(camera, pr, anchor, ctx.lp);
  }

  labels(): SceneLabel[] { return this.labelList; }

  dispose(): void { if (this.main) this.main.dispose(); this.disposables.forEach(d => d.dispose()); }
}
