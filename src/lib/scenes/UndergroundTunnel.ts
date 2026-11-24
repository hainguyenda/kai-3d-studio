import * as THREE from "three";
import type { CharacterLike, FrameCtx, ScenePrefab } from "../types";
import { clamp, lerp, rng, seg } from "../math";
import { createCrustTexture, createGlowSpriteTexture, createMagmaWallTexture, createMoltenIronTexture, type GlowTextures } from "../textures";
import { applyCameraPreset } from "./cameraPresets";

const R_TUNNEL = 3.2, H_TUNNEL = 140, ANCHOR = new THREE.Vector3(0, 0, 0), N_PARTICLES = 420;

interface Layer { name: string; from: number; to: number; tex: GlowTextures; color: string; fog: string; fogDensity: number; emissive: string; emissiveMin: number; emissiveMax: number; light: string; lightI: number }

/** Đường hầm thẳng đứng xuyên lòng đất. Lớp địa chất đổi theo hud.depthKm, tường trôi theo hud.speedKmh */
export class UndergroundTunnel implements ScenePrefab {
  id = "underground_tunnel" as const;
  root = new THREE.Group();
  private layers: Layer[];
  private wall: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  private rails = new THREE.Group();
  private platform = new THREE.Group();
  private points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private seeds: Float32Array;
  private light = new THREE.PointLight("#ffffff", 30, 30, 1.6);
  private lamp = new THREE.SpotLight("#fff2dc", 40, 25, 0.9, 0.5, 1.4);
  private hemi = new THREE.HemisphereLight("#ffffff", "#332211", 0.25);
  private fog = new THREE.FogExp2("#120a06", 0.05);
  private bg = new THREE.Color("#000000");
  private disposables: { dispose(): void }[] = [];

  constructor() {
    const crust = createCrustTexture(), magma = createMagmaWallTexture(), molten = createMoltenIronTexture();
    for (const t of [crust, magma, molten]) { t.map.repeat.set(5, 10); t.emissive.repeat.set(5, 10); this.disposables.push(t.map, t.emissive); }
    this.layers = [
      { name: "地殻", from: 0, to: 30, tex: crust, color: "#ffffff", fog: "#1a1410", fogDensity: 0.05, emissive: "#000000", emissiveMin: 0, emissiveMax: 0, light: "#fff1dd", lightI: 26 },
      { name: "マントル", from: 30, to: 2890, tex: magma, color: "#ffffff", fog: "#2a0c04", fogDensity: 0.045, emissive: "#ff5a1a", emissiveMin: 0.5, emissiveMax: 2.2, light: "#ff8a4a", lightI: 22 },
      { name: "外核", from: 2890, to: 5150, tex: molten, color: "#ff9a40", fog: "#5a2408", fogDensity: 0.04, emissive: "#ff7a1a", emissiveMin: 1.6, emissiveMax: 2.4, light: "#ffb36b", lightI: 26 },
      { name: "内核", from: 5150, to: 7000, tex: molten, color: "#fff4d0", fog: "#f7e7c0", fogDensity: 0.035, emissive: "#fff0c8", emissiveMin: 2.4, emissiveMax: 3.2, light: "#fff6e0", lightI: 34 },
    ];
    const wallMat = new THREE.MeshStandardMaterial({ map: crust.map, emissiveMap: crust.emissive, roughness: 0.9, metalness: 0.05, side: THREE.BackSide });
    this.wall = new THREE.Mesh(new THREE.CylinderGeometry(R_TUNNEL, R_TUNNEL, H_TUNNEL, 64, 1, true), wallMat);
    this.wall.receiveShadow = true; this.root.add(this.wall);
    this.disposables.push(this.wall.geometry, wallMat);

    // ray dẫn hướng bằng thép
    const railMat = new THREE.MeshStandardMaterial({ color: "#c9cdd2", roughness: 0.3, metalness: 0.85 });
    const railGeo = new THREE.BoxGeometry(0.12, H_TUNNEL, 0.18);
    this.disposables.push(railMat, railGeo);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4, r = new THREE.Mesh(railGeo, railMat); r.position.set(Math.cos(a) * (R_TUNNEL - 0.12), 0, Math.sin(a) * (R_TUNNEL - 0.12)); r.rotation.y = -a; this.rails.add(r); }
    this.root.add(this.rails);

    // khoang thang máy kính: sàn kim loại + vách kính mỏng + viền kim loại mảnh + mái vòm; cáp treo ở mép mái (không xuyên qua nhân vật)
    const metal = new THREE.MeshStandardMaterial({ color: "#8f969c", roughness: 0.45, metalness: 0.7 }), stripe = new THREE.MeshStandardMaterial({ color: "#f1c40f", roughness: 0.6 });
    const trim = new THREE.MeshStandardMaterial({ color: "#d9dee3", roughness: 0.25, metalness: 0.9 });
    const glass = new THREE.MeshPhysicalMaterial({ color: "#e6f6ff", roughness: 0.04, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    this.disposables.push(metal, stripe, trim, glass);
    const CAP_R = 1.2, CAP_H = 2.35;
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.14, 48), metal); disk.position.y = -0.07; disk.receiveShadow = true; disk.castShadow = true;
    const edge = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.05, 10, 64), stripe); edge.rotation.x = Math.PI / 2;
    const wallGlass = new THREE.Mesh(new THREE.CylinderGeometry(CAP_R, CAP_R, CAP_H, 64, 1, true), glass); wallGlass.position.y = CAP_H / 2; wallGlass.renderOrder = 5;
    const roof = new THREE.Mesh(new THREE.SphereGeometry(CAP_R, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass); roof.position.y = CAP_H; roof.scale.y = 0.28; roof.renderOrder = 5;
    this.platform.add(disk, edge, wallGlass, roof);
    for (const y of [0.04, CAP_H]) { const r = new THREE.Mesh(new THREE.TorusGeometry(CAP_R, 0.016, 8, 72), trim); r.rotation.x = Math.PI / 2; r.position.y = y; this.platform.add(r); }
    for (let i = 0; i < 3; i++) { // 3 thanh dọc mảnh phía sau, không che mặt
      const a = Math.PI * (1.25 + i * 0.25), post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, CAP_H, 6), trim);
      post.position.set(Math.cos(a) * CAP_R, CAP_H / 2, Math.sin(a) * CAP_R); this.platform.add(post);
    }
    for (const x of [-0.95, 0.95]) { const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 60, 8), metal); cable.position.set(x, CAP_H + 0.1 + 30, -0.35); this.platform.add(cable); }
    this.platform.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) this.disposables.push(m.geometry); });
    this.root.add(this.platform);

    // hạt sáng / vệt dung nham
    const R = rng(12); this.seeds = new Float32Array(N_PARTICLES * 4);
    for (let i = 0; i < N_PARTICLES; i++) { this.seeds[i * 4] = R() * Math.PI * 2; this.seeds[i * 4 + 1] = 0.6 + R() * (R_TUNNEL - 0.9); this.seeds[i * 4 + 2] = R(); this.seeds[i * 4 + 3] = 0.6 + R() * 0.8; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N_PARTICLES * 3), 3));
    const sprite = createGlowSpriteTexture();
    const pm = new THREE.PointsMaterial({ map: sprite, color: "#ffb04a", size: 0.18, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(geo, pm); this.root.add(this.points);
    this.disposables.push(geo, pm, sprite);

    this.light.position.set(0, 3.2, 0); this.lamp.position.set(0.5, 3.6, 1.6); this.lamp.target.position.set(0, -2, 0); this.lamp.castShadow = true;
    this.root.add(this.light, this.lamp, this.lamp.target, this.hemi);
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = this.fog; }

  private layerAt(d: number): Layer { return this.layers.find(l => d < l.to) ?? this.layers[this.layers.length - 1]; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const d = ctx.hud.depthKm, L = this.layerAt(d), m = this.wall.material;
    if (m.map !== L.tex.map) { m.map = L.tex.map; m.emissiveMap = L.tex.emissive; m.needsUpdate = true; }
    const inLayer = seg(d, L.from, L.to);
    m.color.set(L.color); m.emissive.set(L.emissive);
    m.emissiveIntensity = lerp(L.emissiveMin, L.emissiveMax, inLayer) + (L.name === "外核" ? Math.sin(ctx.t * 3) * 0.2 : 0);
    // tường trôi lên khi đang đi xuống
    const v = clamp(ctx.hud.speedKmh / 75, 0, 3);
    const scroll = ctx.t * 0.35 * v;
    L.tex.map.offset.y = scroll; L.tex.emissive.offset.y = scroll;
    if (L.name === "外核" || L.name === "内核") L.tex.map.offset.x = Math.sin(ctx.t * 0.2) * 0.05;
    this.fog.color.set(L.fog); this.fog.density = L.fogDensity; this.bg.set(L.fog);
    this.light.color.set(L.light); this.light.intensity = L.lightI; this.lamp.intensity = L.name === "地殻" ? 45 : 18;
    this.hemi.intensity = L.name === "内核" ? 1.2 : 0.25;
    this.rails.visible = d >= 30;

    // hạt bay ngược lên theo tốc độ
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute, arr = pos.array as Float32Array;
    const span = 40, flow = ctx.t * (2 + 14 * v);
    for (let i = 0; i < N_PARTICLES; i++) {
      const a = this.seeds[i * 4] + ctx.t * 0.1 * this.seeds[i * 4 + 3], r = this.seeds[i * 4 + 1];
      const y = (((this.seeds[i * 4 + 2] * span + flow * this.seeds[i * 4 + 3]) % span) + span) % span - span / 2;
      arr[i * 3] = Math.cos(a) * r; arr[i * 3 + 1] = y; arr[i * 3 + 2] = Math.sin(a) * r;
    }
    pos.needsUpdate = true;
    const pm = this.points.material;
    pm.visible = d >= 30; pm.color.set(L.name === "内核" ? "#fff3c4" : "#ffb04a");
    pm.size = L.name === "マントル" ? 0.12 : 0.22; pm.opacity = L.name === "マントル" ? 0.6 : 0.95;

    this.platform.visible = !!ctx.beat.platform;
    character.root.position.copy(ANCHOR);
    character.root.rotation.set(0, ctx.beat.characterAction === "freefall_float" ? ctx.t * 0.15 : 0, 0);
    applyCameraPreset(camera, ctx.beat.cameraPreset, ANCHOR, ctx.lp);
    const shake = ctx.hud.speedKmh > 1 ? 0.015 : 0;
    camera.position.x += Math.sin(ctx.t * 37) * shake; camera.position.y += Math.sin(ctx.t * 29 + 1) * shake;
  }

  /** tên lớp hiện tại (dùng cho HUD) */
  layerName(depthKm: number): string { return this.layerAt(depthKm).name; }

  dispose(): void { this.disposables.forEach(d => d.dispose()); }
}
