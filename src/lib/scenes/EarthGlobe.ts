import * as THREE from "three";
import type { CharacterLike, FrameCtx, GeoPoint, ScenePrefab, SceneLabel } from "../types";
import { clamp, easeInOut, easeOut } from "../math";
import { createEarthTexture, createNebulaTexture, latLonToVec } from "../textures";
import { earthAssets, HOME_LATLON, resolveGeo } from "../earthAssets";
import { applyCameraPreset } from "./cameraPresets";
import { arrowAlong, disposeGeometries, dotTexture, PulseMarker } from "./markers";

export { HOME_LATLON };

const WIDE_OFFSET = -0.6;
const RADIUS = 3, ORIGIN = new THREE.Vector3(0, 0, 0), DEG = Math.PI / 180;

/** góc quay để điểm (lat, lon) quay thẳng về camera (+z), bắc ở trên */
const focusQuat = ([lat, lon]: [number, number]): THREE.Quaternion => {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(lat * DEG, Math.atan2(Math.cos(phi), Math.sin(phi)), 0, "XYZ"));
};

/** mũi tên tự quay trên mặt đất: [vĩ độ, lệch kinh độ so với nhà, nổi bật] */
const ARROWS: [number, number, boolean][] = [
  [35.7, 0, true], [62, -55, false], [44, -95, false], [18, -45, false], [2, -12, false],
  [-16, -70, false], [56, 22, false], [20, 30, false], [-5, 40, false],
];

/** Trái Đất trong vũ trụ: ảnh vệ tinh thật, mây, viền khí quyển, mũi tên tự quay, chấm vị trí nhân vật, điểm đất liền gần nhất */
export class EarthGlobe implements ScenePrefab {
  id = "earth_globe" as const;
  root = new THREE.Group();
  private spin = new THREE.Group();
  private earthMat: THREE.MeshStandardMaterial;
  private cloudMat: THREE.MeshStandardMaterial;
  private clouds: THREE.Mesh;
  private arrows = new THREE.Group();
  private path: THREE.Mesh;
  private antipode: THREE.Mesh;
  private homeMarker: THREE.Mesh;
  private marker: PulseMarker;
  private nearestDot: THREE.Mesh;
  private dashes: THREE.Points;
  private nebula: THREE.Texture;
  private homeAngle: number;
  private q = new THREE.Quaternion();
  private labelList: SceneLabel[] = [];
  private disposables: { dispose(): void }[] = [];

  constructor() {
    this.nebula = createNebulaTexture(); this.disposables.push(this.nebula);
    this.earthMat = new THREE.MeshStandardMaterial({ color: "#2a5d93", roughness: 0.85, metalness: 0 });
    const earthGeo = new THREE.SphereGeometry(RADIUS, 160, 120);
    this.spin.add(new THREE.Mesh(earthGeo, this.earthMat));
    this.cloudMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5, depthWrite: false, roughness: 1, visible: false });
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.008, 128, 96), this.cloudMat);
    this.root.add(this.spin, this.clouds);
    this.disposables.push(earthGeo, this.earthMat, this.cloudMat, this.clouds.geometry);

    // ảnh vệ tinh thật; nếu không tải được thì dùng bản đồ tự sinh
    const assets = earthAssets();
    assets.onLoad(() => {
      const m = this.earthMat;
      if (assets.day) {
        m.map = assets.day; m.emissiveMap = assets.day; m.emissive.set("#ffffff"); m.emissiveIntensity = 0.22; m.color.set("#ffffff");
        if (assets.normal) { m.normalMap = assets.normal; m.normalScale.set(0.85, -0.85); }
      } else {
        const { map, bump, rough } = createEarthTexture(7);
        m.map = map; m.bumpMap = bump; m.bumpScale = 0.04; m.roughnessMap = rough; m.color.set("#ffffff");
        this.disposables.push(map, bump, rough);
      }
      m.needsUpdate = true;
      if (assets.clouds) { this.cloudMat.map = assets.clouds; this.cloudMat.visible = true; this.cloudMat.needsUpdate = true; }
    });

    // viền khí quyển (Fresnel)
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color("#6fb6ff") } },
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 color; varying vec3 vN; void main(){ float i = pow(0.74 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(color, 1.0) * i; }",
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.15, 64, 48), atmoMat);
    this.root.add(atmo); this.disposables.push(atmoMat, atmo.geometry);

    // nhà (Nhật Bản) + điểm đối diện + đường đi xuyên tâm (giữ như bản cũ)
    const red = new THREE.MeshBasicMaterial({ color: "#ff3b30", depthTest: false, transparent: true });
    const gold = new THREE.MeshBasicMaterial({ color: "#ffd25a", depthTest: false, transparent: true });
    this.disposables.push(red, gold);
    const home = latLonToVec(HOME_LATLON.lat, HOME_LATLON.lon, RADIUS * 1.01);
    this.homeMarker = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), red); this.homeMarker.position.copy(home); this.homeMarker.renderOrder = 10;
    this.antipode = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), gold); this.antipode.position.copy(home.clone().negate()); this.antipode.renderOrder = 10;
    const pathGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 10); pathGeo.translate(0, 0.5, 0);
    this.path = new THREE.Mesh(pathGeo, red); this.path.position.copy(home); this.path.renderOrder = 9;
    this.path.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), home.clone().negate().normalize());
    this.spin.add(this.homeMarker, this.antipode, this.path);
    this.disposables.push(this.homeMarker.geometry, pathGeo);
    const phi = ((HOME_LATLON.lon + 180) / 360) * Math.PI * 2;
    this.homeAngle = Math.atan2(Math.cos(phi), Math.sin(phi));

    // mũi tên tự quay (hướng Đông) nằm trên mặt đất – dài hơn ở xích đạo
    const arrowMat = new THREE.MeshBasicMaterial({ color: "#ffd9a0", toneMapped: false });
    const hotMat = new THREE.MeshBasicMaterial({ color: "#ffc061", toneMapped: false });
    this.disposables.push(arrowMat, hotMat);
    for (const [lat, dl, hot] of ARROWS) {
      const lon0 = HOME_LATLON.lon + dl, span = hot ? 24 : 20, pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 16; i++) pts.push(latLonToVec(lat, lon0 + (span * i) / 16, RADIUS * 1.03));
      this.arrows.add(arrowAlong(new THREE.CatmullRomCurve3(pts), hot ? 0.034 : 0.026, hot ? hotMat : arrowMat));
    }
    this.spin.add(this.arrows);

    // chấm vị trí nhân vật + chấm đất liền gần nhất + nét chấm nối
    this.marker = new PulseMarker(0.24);
    this.spin.add(this.marker.group);
    const white = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    this.nearestDot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), white);
    const dotTex = dotTexture();
    const dashGeo = new THREE.BufferGeometry(); dashGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(40 * 3), 3));
    const dashMat = new THREE.PointsMaterial({ map: dotTex, size: 0.045, transparent: true, depthWrite: false, toneMapped: false });
    this.dashes = new THREE.Points(dashGeo, dashMat);
    this.spin.add(this.nearestDot, this.dashes);
    this.disposables.push(white, this.nearestDot.geometry, dotTex, dashGeo, dashMat, this.marker);

    // ánh sáng: chiếu chéo từ trước (giống ảnh minh hoạ), bóng tối nhẹ
    const sun = new THREE.DirectionalLight("#ffffff", 3.0); sun.position.set(-5, 6, 11);
    const hemi = new THREE.HemisphereLight("#cfe0ff", "#1a2030", 0.75);
    this.root.add(sun, hemi);
  }

  /** dùng ảnh bản đồ Trái Đất riêng (URL) nếu muốn */
  setCustomTexture(url: string): void {
    new THREE.TextureLoader().load(url, t => { t.colorSpace = THREE.SRGBColorSpace; this.earthMat.map = t; this.earthMat.needsUpdate = true; this.disposables.push(t); });
  }

  apply(scene: THREE.Scene): void { scene.background = this.nebula; scene.fog = null; }

  private geo(p: GeoPoint, r = RADIUS * 1.012): THREE.Vector3 { const [la, lo] = resolveGeo(p); return latLonToVec(la, lo, r); }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    character.root.visible = false;
    const o = ctx.beat.globe ?? {}, preset = ctx.beat.cameraPreset, close = preset === "globe_close";
    if (o.focus) {
      const to = focusQuat(resolveGeo(o.focus));
      if (o.focusFrom) this.q.slerpQuaternions(focusQuat(resolveGeo(o.focusFrom)), to, easeInOut(ctx.lp)); else this.q.copy(to);
      this.spin.quaternion.copy(this.q);
    } else {
      // tính theo giây trong beat (ctx.lt), không theo tổng thời gian video: nếu không Nhật Bản sẽ trôi ra sau quả cầu ở cuối video.
      // globe_wide: Nhật lệch sang trái ~35° để thấy rõ đường hầm xuyên tâm, rồi quay chậm.
      this.spin.rotation.set(close ? 0.45 : 0.2, close ? this.homeAngle + Math.sin(ctx.lt * 0.15) * 0.25 : this.homeAngle + WIDE_OFFSET + ctx.lt * 0.05, 0, "XYZ");
    }
    this.clouds.quaternion.copy(this.spin.quaternion); this.clouds.rotateY(ctx.t * 0.004);

    this.arrows.visible = o.arrows ?? (!o.focus && preset === "globe_wide");
    const showPath = o.path ?? !o.focus;
    const p = clamp(ctx.hud.progress), len = RADIUS * 2 * easeOut(p);
    this.path.visible = showPath && p > 0.001; this.path.scale.set(1, Math.max(0.0001, len), 1);
    this.homeMarker.visible = showPath;
    this.antipode.visible = showPath && p > 0.5;

    this.labelList = [];
    this.marker.group.visible = !!o.marker;
    if (o.marker) {
      this.marker.group.position.copy(this.geo(o.marker.at, RADIUS * 1.02));
      this.marker.setColor(o.marker.color ?? "#ff7a3d"); this.marker.update(ctx.t);
      if (o.marker.label) this.labelList.push({ pos: this.marker.group.position.clone(), text: o.marker.label });
    }
    const nearest = o.nearest && o.marker ? o.nearest : undefined;
    this.nearestDot.visible = this.dashes.visible = !!nearest;
    if (nearest && o.marker) {
      const a = this.geo(o.marker.at, 1).normalize(), b = this.geo(nearest.at, 1).normalize();
      this.nearestDot.position.copy(b).multiplyScalar(RADIUS * 1.012);
      const arr = (this.dashes.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array, n = arr.length / 3;
      const grow = easeOut(ctx.lp / 0.5), v = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion().setFromUnitVectors(a, b);
      for (let i = 0; i < n; i++) {
        qa.slerpQuaternions(new THREE.Quaternion(), qb, (i / (n - 1)) * grow);
        v.copy(a).applyQuaternion(qa).multiplyScalar(RADIUS * 1.014);
        arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
      }
      this.dashes.geometry.attributes.position.needsUpdate = true;
      if (nearest.label) this.labelList.push({ pos: a.clone().add(b).normalize().multiplyScalar(RADIUS * 1.02), text: nearest.label });
    }
    for (const l of o.labels ?? []) this.labelList.push({ pos: this.geo(l.at, RADIUS * 1.03), text: l.text });

    applyCameraPreset(camera, preset, ORIGIN, ctx.lp);
  }

  labels(camera: THREE.PerspectiveCamera): SceneLabel[] {
    this.spin.updateMatrixWorld(true);
    const out: SceneLabel[] = [];
    for (const l of this.labelList) {
      const w = this.spin.localToWorld(l.pos.clone());
      const facing = w.clone().normalize().dot(camera.position.clone().sub(w).normalize());
      if (facing > 0.12) out.push({ pos: w, text: l.text });
    }
    return out;
  }

  dispose(): void { disposeGeometries(this.arrows); this.disposables.forEach(d => d.dispose()); }
}
