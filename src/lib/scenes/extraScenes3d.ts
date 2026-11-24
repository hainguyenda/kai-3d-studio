import * as THREE from "three";
import type { ExtraSceneId } from "./extraScenesData";

/* 6 bối cảnh 3D procedural của Gemini (extra_scenes_3d.js) chuyển sang TypeScript.
   Mọi chuyển động chỉ phụ thuộc thời gian → xuất MP4 ổn định.
   Claude chỉnh: sóng thần tiến theo tiến độ beat (lp) thay vì lặp 12 giây; con lắc Foucault chạy theo
   giây trong beat (lt) để mỗi beat bắt đầu lại từ đầu; sức gió đọc thêm env.windSpeed. */

export type Climate = "scorching" | "frozen" | "twilight";

export interface ExtraEnv {
  windStrength?: number;
  windSpeed?: number;
  waveProgress?: number;
  showAxis?: boolean;
  earthStopped?: boolean;
  showRadiation?: boolean;
  climate?: Climate;
}

export interface ExtraTime { t: number; lt: number; lp: number }

export interface ExtraScene {
  group: THREE.Group;
  update: (time: ExtraTime, env: ExtraEnv) => { bgColor?: number } | void;
  bgColor: number;
  fog: THREE.FogExp2 | null;
}

function hash01(seed: number): number { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); }
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// 1. Phố Nhật giữa bão siêu thanh (gió thổi về +X)
function createWindStormStreet(): ExtraScene {
  const group = new THREE.Group(); group.name = "wind_storm_street";
  group.add(new THREE.Mesh(new THREE.SphereGeometry(65, 24, 16), new THREE.MeshBasicMaterial({ color: 0x2c3442, side: THREE.BackSide })));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 40), new THREE.MeshStandardMaterial({ color: 0x252a33, roughness: 0.92 }));
  ground.rotation.x = -Math.PI / 2; group.add(ground);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xdbe4ee });
  for (let i = -5; i <= 5; i++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.22), dashMat); d.rotation.x = -Math.PI / 2; d.position.set(i * 3.4, 0.02, 0.6); group.add(d); }
  const buildings: { mesh: THREE.Mesh; seed: number }[] = [];
  const bColors = [0x475569, 0x64748b, 0x334155, 0x52525b, 0x3f4c5e];
  for (let i = 0; i < 10; i++) {
    const w = 2.2 + hash01(i + 1) * 1.8, h = 4.2 + hash01(i + 11) * 5.8, d = 2.6 + hash01(i + 21) * 1.6;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: bColors[i % bColors.length], roughness: 0.85 }));
    b.position.set(-13 + i * 2.9, h / 2, -4.5 - hash01(i + 31) * 3.0); group.add(b); buildings.push({ mesh: b, seed: i + 1 });
  }
  const poles: { group: THREE.Group; seed: number }[] = [];
  const postMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.4, roughness: 0.6 }), armMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
  for (let i = 0; i < 4; i++) {
    const pg = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5.2, 8), postMat); post.position.y = 2.6; pg.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.1), armMat); arm.position.set(0.4, 4.7, 0); pg.add(arm);
    pg.position.set(-7 + i * 5.2, 0, -2.2); group.add(pg); poles.push({ group: pg, seed: i * 1.7 + 0.5 });
  }
  const streaks: { mesh: THREE.Mesh; y: number; z: number; speed: number; phase: number }[] = [];
  const streakGeo = new THREE.BoxGeometry(3.6, 0.045, 0.045);
  for (let i = 0; i < 48; i++) {
    const s = new THREE.Mesh(streakGeo, new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xf8fafc : 0xbae6fd, transparent: true, opacity: 0.25 + hash01(i + 50) * 0.45 }));
    s.scale.x = 0.6 + hash01(i + 100) * 1.8; group.add(s);
    streaks.push({ mesh: s, y: 0.4 + hash01(i + 60) * 7.2, z: -6.0 + hash01(i + 70) * 11.0, speed: 18 + hash01(i + 80) * 24, phase: hash01(i + 90) * 32 });
  }
  const debris: { mesh: THREE.Mesh; baseY: number; z: number; speed: number; phase: number; rx: number; rz: number }[] = [];
  const boxGeo = new THREE.BoxGeometry(0.55, 0.35, 0.45), carGeo = new THREE.BoxGeometry(1.6, 0.65, 0.85);
  const dColors = [0xe11d48, 0xf59e0b, 0x3b82f6, 0x94a3b8, 0xd97706];
  for (let i = 0; i < 18; i++) {
    const isCar = i < 3;
    const m = new THREE.Mesh(isCar ? carGeo : boxGeo, new THREE.MeshStandardMaterial({ color: dColors[i % dColors.length], roughness: 0.65 }));
    if (!isCar) { const sc = 0.45 + hash01(i + 120) * 0.9; m.scale.set(sc, sc * 0.7, sc); }
    group.add(m);
    debris.push({ mesh: m, baseY: (isCar ? 1.1 : 0.6) + hash01(i + 130) * 4.5, z: -3.2 + hash01(i + 140) * 7.0, speed: (isCar ? 11 : 15) + hash01(i + 150) * 14,
      phase: hash01(i + 160) * 36, rx: 2.0 + hash01(i + 170) * 5.0, rz: 3.0 + hash01(i + 180) * 6.0 });
  }
  const dir = new THREE.DirectionalLight(0xfde68a, 1.3); dir.position.set(-8, 12, 8); group.add(dir);
  group.add(new THREE.HemisphereLight(0x94a3b8, 0x1e293b, 0.9));
  const span = 34;
  return {
    group, bgColor: 0x2c3442, fog: new THREE.FogExp2(0x36404f, 0.028),
    update: ({ t }, env) => {
      const wind = clamp(env.windStrength ?? env.windSpeed ?? 1.0, 0.2, 1.8);
      buildings.forEach(b => { b.mesh.rotation.z = -0.025 * wind - Math.sin(t * 22 + b.seed) * 0.008 * wind; });
      poles.forEach(p => { p.group.rotation.z = -0.24 * wind - Math.sin(t * 17 + p.seed) * 0.06 * wind; });
      streaks.forEach(s => { const x = ((t * s.speed * wind + s.phase) % span) - span / 2; s.mesh.position.set(x, s.y + Math.sin(t * 6 + s.phase) * 0.12, s.z); });
      debris.forEach(d => {
        const x = ((t * d.speed * wind + d.phase) % span) - span / 2;
        d.mesh.position.set(x, Math.max(0.35, d.baseY + Math.sin((x + span / 2) * 0.22 + d.phase) * 0.85), d.z);
        d.mesh.rotation.set(t * d.rx * wind, t * 1.4, -t * d.rz * wind);
      });
    },
  };
}

// 2. Bờ biển & tường sóng thần khổng lồ
function createMegaTsunamiCoast(): ExtraScene {
  const group = new THREE.Group(); group.name = "mega_tsunami_coast";
  const land = new THREE.Mesh(new THREE.BoxGeometry(50, 0.8, 16), new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 })); land.position.set(0, -0.4, 5.5); group.add(land);
  const seawall = new THREE.Mesh(new THREE.BoxGeometry(50, 1.3, 0.8), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 })); seawall.position.set(0, 0.45, -2.3); group.add(seawall);
  const townColors = [0xcbd5e1, 0x94a3b8, 0xe2e8f0, 0x64748b];
  for (let i = 0; i < 8; i++) {
    const w = 1.6 + hash01(i + 5) * 1.2, h = 2.2 + hash01(i + 15) * 3.0;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.8), new THREE.MeshStandardMaterial({ color: townColors[i % townColors.length], roughness: 0.8 }));
    b.position.set(-10.5 + i * 3.1, h / 2, 1.2 + (i % 2) * 1.4); group.add(b);
  }
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(70, 50), new THREE.MeshStandardMaterial({ color: 0x0c4a6e, roughness: 0.28, metalness: 0.25 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.25, -26); group.add(sea);
  const shape = new THREE.Shape();
  shape.moveTo(-14, 0); shape.lineTo(0, 0);
  shape.bezierCurveTo(-1.2, 4.5, -2.2, 9.5, 2.2, 11.8);
  shape.bezierCurveTo(3.4, 12.4, 1.2, 13.6, -2.4, 12.8);
  shape.bezierCurveTo(-7.5, 11.4, -11.5, 6.2, -14, 0);
  const waveGeo = new THREE.ExtrudeGeometry(shape, { depth: 44, bevelEnabled: false, curveSegments: 24 });
  waveGeo.translate(0, 0, -22); waveGeo.rotateY(Math.PI / 2);
  const waveGroup = new THREE.Group();
  waveGroup.add(new THREE.Mesh(waveGeo, new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.22, metalness: 0.15, transparent: true, opacity: 0.92 })));
  const foam: { mesh: THREE.Mesh; baseY: number; seed: number }[] = [];
  const foamGeo = new THREE.DodecahedronGeometry(0.9, 1), foamMat = new THREE.MeshStandardMaterial({ color: 0xf0f9ff, roughness: 0.9 });
  for (let i = 0; i < 34; i++) {
    const f = new THREE.Mesh(foamGeo, foamMat), sc = 0.75 + hash01(i + 200) * 0.9;
    f.scale.set(sc * 1.2, sc * 0.85, sc); f.position.set(-20 + i * 1.22, 11.8 + hash01(i + 210) * 1.1, 1.8 + hash01(i + 220) * 1.2);
    waveGroup.add(f); foam.push({ mesh: f, baseY: f.position.y, seed: i + 1 });
  }
  const sprays: { mesh: THREE.Mesh; x: number; phase: number; speed: number }[] = [];
  const sprayGeo = new THREE.SphereGeometry(0.18, 6, 6), sprayMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 40; i++) { const sp = new THREE.Mesh(sprayGeo, sprayMat); waveGroup.add(sp); sprays.push({ mesh: sp, x: -16 + hash01(i + 250) * 32, phase: hash01(i + 260) * 2.0, speed: 1.2 + hash01(i + 270) * 1.6 }); }
  waveGroup.position.set(0, -0.2, -16); group.add(waveGroup);
  const sun = new THREE.DirectionalLight(0xe0f2fe, 1.5); sun.position.set(6, 16, 10); group.add(sun);
  group.add(new THREE.HemisphereLight(0x7dd3fc, 0x0f172a, 0.85));
  return {
    group, bgColor: 0x1e3a5f, fog: new THREE.FogExp2(0x274c77, 0.018),
    update: ({ t, lp }, env) => {
      const prog = clamp(env.waveProgress ?? lp, 0, 1);
      waveGroup.position.z = -18 + prog * 11.5;
      waveGroup.position.y = -0.25 + Math.sin(t * 2.2) * 0.18;
      foam.forEach(f => { f.mesh.rotation.x = t * 2.8 + f.seed; f.mesh.position.y = f.baseY + Math.sin(t * 5.0 + f.seed) * 0.25; });
      sprays.forEach(sp => { const p = (t * sp.speed + sp.phase) % 1; sp.mesh.position.set(sp.x, 11.5 - p * p * 11.0, 2.2 + p * 4.5); sp.mesh.scale.setScalar(1 - p * 0.7); });
    },
  };
}

// 3. Bắc Cực / Nam Cực + tia trục quay + cực quang
function createArcticPole(): ExtraScene {
  const group = new THREE.Group(); group.name = "arctic_pole";
  const snow = new THREE.Mesh(new THREE.CylinderGeometry(35, 35, 1, 36), new THREE.MeshStandardMaterial({ color: 0xe2f1ff, roughness: 0.75 })); snow.position.y = -0.5; group.add(snow);
  const iceMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 0.35, metalness: 0.1, flatShading: true });
  ([[-9, -10, 4.2, 6.5], [9.5, -11, 5.0, 7.8], [-14, -4, 3.6, 4.8], [13, -3, 3.8, 5.2], [2.5, -14, 4.5, 6.0]] as const).forEach(([x, z, r, h]) => {
    const berg = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), iceMat); berg.position.set(x, h / 2 - 0.3, z); berg.rotation.y = x * 0.4; group.add(berg);
  });
  const axisGroup = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.4, 12), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })); stick.position.y = 1.2; axisGroup.add(stick);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.5, roughness: 0.25 })); top.position.y = 2.45; axisGroup.add(top);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.32, 26, 16, 1, true), beamMat); beam.position.y = 13; axisGroup.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.06, 8, 36), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.85 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; axisGroup.add(ring);
  axisGroup.position.set(1.6, 0, -1.8); group.add(axisGroup);
  const auroraGeo = new THREE.PlaneGeometry(36, 5.5, 32, 4);
  const aurora = new THREE.Mesh(auroraGeo, new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  aurora.position.set(0, 10.5, -16); group.add(aurora);
  const auroraPos = auroraGeo.attributes.position as THREE.BufferAttribute, base = Float32Array.from(auroraPos.array as Float32Array);
  const flakes: { mesh: THREE.Mesh; x: number; z: number; phase: number; speed: number }[] = [];
  const flakeGeo = new THREE.SphereGeometry(0.06, 5, 5), flakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 65; i++) { const f = new THREE.Mesh(flakeGeo, flakeMat); group.add(f); flakes.push({ mesh: f, x: -11 + hash01(i + 300) * 22, z: -8 + hash01(i + 310) * 14, phase: hash01(i + 320) * 10, speed: 0.8 + hash01(i + 330) * 0.9 }); }
  const moon = new THREE.DirectionalLight(0xcffafe, 1.35); moon.position.set(-6, 14, 10); group.add(moon);
  group.add(new THREE.HemisphereLight(0x67e8f9, 0x0f172a, 0.75));
  return {
    group, bgColor: 0x091529, fog: new THREE.FogExp2(0x0c1e3a, 0.016),
    update: ({ t }, env) => {
      axisGroup.visible = env.showAxis !== false;
      ring.rotation.z = t * 1.1; beamMat.opacity = 0.24 + Math.sin(t * 3.0) * 0.1;
      for (let i = 0; i < auroraPos.count; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1];
        auroraPos.setXYZ(i, bx, by + Math.cos(bx * 0.2 + t * 0.9) * 0.7, Math.sin(bx * 0.28 + t * 1.2) * 2.2);
      }
      auroraPos.needsUpdate = true;
      flakes.forEach(f => f.mesh.position.set(f.x + Math.sin(t * 1.5 + f.phase) * 0.4, 10 - ((t * f.speed + f.phase) % 10), f.z));
    },
  };
}

// 4. Quỹ đạo Trái Đất + ISS + vệ tinh + bức xạ
function createSpaceIssOrbit(): ExtraScene {
  const group = new THREE.Group(); group.name = "space_iss_orbit";
  const stars: number[] = [];
  for (let i = 0; i < 420; i++) {
    const th = hash01(i + 400) * Math.PI * 2, ph = Math.acos(2 * hash01(i + 450) - 1), r = 42 + hash01(i + 500) * 14;
    stars.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
  group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16 })));
  const earth = new THREE.Mesh(new THREE.SphereGeometry(24, 48, 36), new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.65, metalness: 0.1 }));
  earth.position.set(0, -25.2, -5); group.add(earth);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(24.55, 48, 36), new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.22, side: THREE.BackSide }));
  atmo.position.copy(earth.position); group.add(atmo);
  const iss = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.55, roughness: 0.35 });
  const solar = new THREE.MeshStandardMaterial({ color: 0xd97706, emissive: 0x451a03, metalness: 0.45, roughness: 0.3 });
  iss.add(new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.22, 0.22), metal));
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 3.2, 16), metal); core.rotation.x = Math.PI / 2; iss.add(core);
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 2.0, 14), metal); lab.rotation.z = Math.PI / 2; lab.position.set(0, 0, 0.75); iss.add(lab);
  [-2.9, -2.0, 2.0, 2.9].forEach(px => [-1.35, 1.35].forEach(pz => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.04, 2.1), solar); p.position.set(px, 0, pz); iss.add(p); }));
  iss.position.set(-0.6, 1.3, 0.4); iss.rotation.set(0.25, -0.35, 0.12); group.add(iss);
  const sat = new THREE.Group();
  sat.add(new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.3 })));
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.5, roughness: 0.25 });
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.45), wingMat); wingL.position.x = -1.1;
  const wingR = wingL.clone(); wingR.position.x = 1.1; sat.add(wingL, wingR);
  sat.position.set(3.8, 2.1, -1.6); group.add(sat);
  const radGroup = new THREE.Group();
  const rads: { mesh: THREE.Mesh; x0: number; z: number; phase: number; speed: number }[] = [];
  const radGeo = new THREE.BoxGeometry(0.9, 0.04, 0.04), radMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 28; i++) { const r = new THREE.Mesh(radGeo, radMat); r.rotation.z = -0.65; radGroup.add(r); rads.push({ mesh: r, x0: -9 + hash01(i + 600) * 18, z: -4 + hash01(i + 610) * 6, phase: hash01(i + 620) * 4, speed: 4.5 + hash01(i + 630) * 3.5 }); }
  group.add(radGroup);
  const sun = new THREE.DirectionalLight(0xfffbeb, 1.9); sun.position.set(12, 10, 14); group.add(sun);
  group.add(new THREE.AmbientLight(0x334155, 0.7));
  return {
    group, bgColor: 0x030712, fog: null,
    update: ({ t }, env) => {
      earth.rotation.y = t * (env.earthStopped ? 0.0 : 0.04);
      iss.position.y = 1.3 + Math.sin(t * 0.9) * 0.16; iss.rotation.y = -0.35 + Math.sin(t * 0.4) * 0.08;
      sat.position.x = 2.6 + Math.sin(t * 0.7) * 1.6; sat.rotation.y = t * 0.6;
      radGroup.visible = !!env.showRadiation;
      if (radGroup.visible) rads.forEach(p => { const pr = (t * p.speed + p.phase) % 10; p.mesh.position.set(p.x0 + pr * 0.8, 7.5 - pr * 1.2, p.z); });
    },
  };
}

// 5. Vùng khí hậu cực đoan 3-trong-1
interface Theme { bg: number; fog: number; ground: number; hill: number; sunColor: number; sunPos: [number, number, number]; lightColor: number; lightPos: [number, number, number]; hemiSky: number; hemiGround: number; particleColor: number; riseUp: boolean }
const THEMES: Record<Climate, Theme> = {
  scorching: { bg: 0x7c2d12, fog: 0x9a3412, ground: 0xb45309, hill: 0x78350f, sunColor: 0xfef08a, sunPos: [3.0, 9.5, -24], lightColor: 0xffedd5, lightPos: [4, 14, 6], hemiSky: 0xfb923c, hemiGround: 0x451a03, particleColor: 0xfde047, riseUp: true },
  frozen: { bg: 0x0b162c, fog: 0x0f1f3d, ground: 0xdbeafe, hill: 0x93c5fd, sunColor: 0x1e293b, sunPos: [0, -12, -24], lightColor: 0xbae6fd, lightPos: [-6, 10, 8], hemiSky: 0x38bdf8, hemiGround: 0x0f172a, particleColor: 0xffffff, riseUp: false },
  twilight: { bg: 0x3b1d4a, fog: 0x581c5c, ground: 0x475569, hill: 0x312e81, sunColor: 0xfb923c, sunPos: [0.0, 1.4, -26], lightColor: 0xfdba74, lightPos: [0, 3.5, -14], hemiSky: 0xf472b6, hemiGround: 0x1e1b4b, particleColor: 0xfed7aa, riseUp: true },
};
function createExtremeClimateZone(): ExtraScene {
  const group = new THREE.Group(); group.name = "extreme_climate_zone";
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), groundMat); ground.rotation.x = -Math.PI / 2; group.add(ground);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, fog: false });
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(3.2, 24, 18), sunMat); group.add(sunDisc);
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.9, flatShading: true });
  for (let i = 0; i < 7; i++) {
    const r = 4.0 + hash01(i + 700) * 4.5, h = 2.4 + hash01(i + 710) * 3.8;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), hillMat); hill.position.set(-16 + i * 5.4, h / 2 - 0.3, -12 - (i % 2) * 4); group.add(hill);
  }
  const parts: { mesh: THREE.Mesh; x: number; z: number; phase: number; speed: number }[] = [];
  const pGeo = new THREE.SphereGeometry(0.08, 6, 6), pMat = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.6 });
  for (let i = 0; i < 50; i++) { const m = new THREE.Mesh(pGeo, pMat); group.add(m); parts.push({ mesh: m, x: -10 + hash01(i + 750) * 20, z: -6 + hash01(i + 760) * 12, phase: hash01(i + 770) * 8, speed: 0.9 + hash01(i + 780) * 1.1 }); }
  const dir = new THREE.DirectionalLight(0xffedd5, 1.8); group.add(dir, dir.target);
  const hemi = new THREE.HemisphereLight(0xfdba74, 0x431407, 0.8); group.add(hemi);
  const fog = new THREE.FogExp2(0x7c2d12, 0.02);
  return {
    group, bgColor: 0x7c2d12, fog,
    update: ({ t }, env) => {
      const th = THEMES[env.climate ?? "scorching"] ?? THEMES.scorching;
      groundMat.color.setHex(th.ground); hillMat.color.setHex(th.hill); sunMat.color.setHex(th.sunColor);
      sunDisc.position.set(...th.sunPos); dir.color.setHex(th.lightColor); dir.position.set(...th.lightPos);
      hemi.color.setHex(th.hemiSky); hemi.groundColor.setHex(th.hemiGround); pMat.color.setHex(th.particleColor); fog.color.setHex(th.fog);
      parts.forEach(p => { const c = (t * p.speed + p.phase) % 8; p.mesh.position.set(p.x + Math.sin(t * 2 + p.phase) * 0.35, th.riseUp ? 0.2 + c : 8.2 - c, p.z); });
      return { bgColor: th.bg };
    },
  };
}

// 6. Phòng thí nghiệm + con lắc Foucault
function createScienceMuseumPendulum(): ExtraScene {
  const group = new THREE.Group(); group.name = "science_museum_pendulum";
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 0.5, 48), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })); floor.position.y = -0.25; group.add(floor);
  const compass = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.65, 48), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }));
  compass.rotation.x = -Math.PI / 2; compass.position.y = 0.02; group.add(compass);
  const colMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, c = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 11, 12), colMat); c.position.set(Math.cos(a) * 9.5, 5.5, Math.sin(a) * 9.5); group.add(c); }
  const pegs: { pivot: THREE.Group; angle: number }[] = [];
  const pegGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.55, 8), pegMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2, pivot = new THREE.Group();
    pivot.position.set(Math.cos(angle) * 3.1, 0, Math.sin(angle) * 3.1); pivot.rotation.y = -angle;
    const peg = new THREE.Mesh(pegGeo, pegMat); peg.position.y = 0.275; pivot.add(peg); group.add(pivot); pegs.push({ pivot, angle });
  }
  const prec = new THREE.Group(); prec.position.set(0, 10.2, 0); group.add(prec);
  const swing = new THREE.Group(); prec.add(swing);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 9.2, 8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 })); cable.position.y = -4.6; swing.add(cable);
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.75, roughness: 0.22 })); bob.position.y = -9.2; swing.add(bob);
  const spot = new THREE.DirectionalLight(0xfef3c7, 1.6); spot.position.set(4, 12, 6); group.add(spot);
  group.add(new THREE.HemisphereLight(0x94a3b8, 0x0f172a, 0.85));
  return {
    group, bgColor: 0x0f172a, fog: new THREE.FogExp2(0x111827, 0.022),
    update: ({ lt }) => {
      const pa = (lt * 0.26) % (Math.PI * 2);
      swing.rotation.z = Math.sin(lt * 2.4) * 0.34; prec.rotation.y = -pa;
      pegs.forEach(p => { const swept = p.angle <= pa || (p.angle >= Math.PI && p.angle - Math.PI <= pa); p.pivot.rotation.z = swept ? -Math.PI * 0.46 : 0; });
    },
  };
}

const BUILDERS: Record<ExtraSceneId, () => ExtraScene> = {
  wind_storm_street: createWindStormStreet,
  mega_tsunami_coast: createMegaTsunamiCoast,
  arctic_pole: createArcticPole,
  space_iss_orbit: createSpaceIssOrbit,
  extreme_climate_zone: createExtremeClimateZone,
  science_museum_pendulum: createScienceMuseumPendulum,
};

export function createExtraScene(id: ExtraSceneId): ExtraScene { return BUILDERS[id](); }
