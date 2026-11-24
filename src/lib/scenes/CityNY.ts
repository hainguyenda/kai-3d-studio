import * as THREE from 'three';

/* Phố New York ban đêm. Bản gốc của Gemini, Claude làm lại phần hình (21/11):
   chỉ cửa sổ đang bật đèn mới phát sáng, bảng neon tầng trệt, dãy nhà xa phía sau,
   khói nắp cống mềm, đèn đường có quầng sáng thật. Giữ nguyên API (holeObjects, windowMaterials, update, dispose). */

export interface CityNYCameraPreset {
  position: [number, number, number];
  lookAt: [number, number, number];
}

export const CITY_NY_CAMERAS: Record<string, CityNYCameraPreset> = {
  ny_wide: { position: [0, 2.35, 7.6], lookAt: [0, 1.85, -5] },
  ny_close: { position: [0.35, 1.65, 4.1], lookAt: [0, 1.35, 0] },
  ny_street: { position: [-3.1, 2.15, 6.4], lookAt: [0.4, 1.55, -3] },
};

const rng = (seed: number) => {
  let s = (seed * 9301 + 49297) % 233280;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
};

/** mặt tiền: map (màu tường + kính) và emissiveMap (CHỈ cửa sổ đang sáng) */
function facade(seed: number, base: string, cols: number, rows: number, litRate: number) {
  const W = 256, H = 512, r = rng(seed);
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cm = mk(), ce = mk(), m = cm.getContext('2d')!, e = ce.getContext('2d')!;
  const g = m.createLinearGradient(0, 0, 0, H); g.addColorStop(0, base); g.addColorStop(1, '#151922');
  m.fillStyle = g; m.fillRect(0, 0, W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const pad = 10, cw = (W - pad * 2) / cols, ch = (H - pad * 2) / rows;
  // gờ tầng & trụ đứng cho có khối
  m.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < rows; y++) m.fillRect(0, pad + y * ch, W, 2);
  m.fillStyle = 'rgba(0,0,0,0.25)';
  for (let x = 0; x <= cols; x++) m.fillRect(pad + x * cw - 2, 0, 4, H);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const wx = pad + x * cw + 4, wy = pad + y * ch + 5, ww = cw - 8, wh = ch - 10;
    const lit = r() < litRate;
    if (lit) {
      const warm = r() < 0.7;
      const col = warm ? `hsl(${38 + r() * 10},95%,${62 + r() * 14}%)` : `hsl(${195 + r() * 15},80%,${70 + r() * 10}%)`;
      m.fillStyle = col; m.fillRect(wx, wy, ww, wh);
      e.fillStyle = col; e.fillRect(wx, wy, ww, wh);
      // rèm che một nửa cho đỡ đều
      if (r() < 0.3) { m.fillStyle = 'rgba(30,24,20,0.55)'; m.fillRect(wx, wy, ww, wh * 0.45); e.fillStyle = 'rgba(0,0,0,0.6)'; e.fillRect(wx, wy, ww, wh * 0.45); }
    } else {
      m.fillStyle = '#0d121c'; m.fillRect(wx, wy, ww, wh);
      m.fillStyle = 'rgba(120,150,190,0.12)'; m.fillRect(wx, wy, ww * 0.35, wh); // ánh phản chiếu trên kính
    }
  }
  const map = new THREE.CanvasTexture(cm), emissiveMap = new THREE.CanvasTexture(ce);
  for (const t of [map, emissiveMap]) { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return { map, emissiveMap };
}

/** bảng neon: chữ phát sáng có quầng */
function neonTexture(title: string, sub: string, bg: string, glow: string, w = 512, h = 256, reuse?: HTMLCanvasElement): THREE.CanvasTexture {
  const c = reuse ?? document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = glow; g.lineWidth = 8; g.shadowColor = glow; g.shadowBlur = 24; g.strokeRect(12, 12, w - 24, h - 24);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
  g.font = `900 ${Math.round(h * 0.34)}px "Noto Sans JP", Arial, sans-serif`; g.fillText(title, w / 2, sub ? h * 0.42 : h / 2);
  if (sub) { g.fillStyle = glow; g.font = `700 ${Math.round(h * 0.15)}px "Noto Sans JP", Arial, sans-serif`; g.fillText(sub, w / 2, h * 0.75); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** dãy nhà xa: hình bóng nhiều toà nhà có cửa sổ sáng lấm tấm */
function skylineTexture(): THREE.CanvasTexture {
  const W = 2048, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!, r = rng(77);
  g.clearRect(0, 0, W, H);
  let x = 0;
  while (x < W) {
    const bw = 50 + r() * 110, bh = 140 + r() * 340, y = H - bh;
    g.fillStyle = `hsl(220,22%,${9 + r() * 7}%)`; g.fillRect(x, y, bw, bh);
    if (r() < 0.25) { g.fillRect(x + bw * 0.35, y - 40, bw * 0.3, 40); g.fillRect(x + bw * 0.47, y - 80, bw * 0.06, 40); }
    for (let wy = y + 8; wy < H - 6; wy += 11) for (let wx = x + 5; wx < x + bw - 6; wx += 9)
      if (r() < 0.32) { g.fillStyle = r() < 0.75 ? 'rgba(255,214,140,0.9)' : 'rgba(160,220,255,0.85)'; g.fillRect(wx, wy, 4, 5); }
    x += bw + 2 + r() * 8;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** khói mềm (sprite tròn mờ dần) */
function puffTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(235,240,250,0.9)'); gr.addColorStop(0.5, 'rgba(220,228,240,0.35)'); gr.addColorStop(1, 'rgba(220,228,240,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function createYellowCab(): THREE.Group {
  const cab = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0xf2b10f, roughness: 0.35, metalness: 0.15 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.9 });
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 3.9), body); lower.position.y = 0.55; lower.castShadow = true; cab.add(lower);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.0), glass); upper.position.set(0, 1.05, -0.15); cab.add(upper);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.06, 1.7), body); roof.position.set(0, 1.32, -0.15); cab.add(roof);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.16, 4.0), dark); bumper.position.y = 0.33; cab.add(bumper);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.22), new THREE.MeshBasicMaterial({ color: 0xfff1b8 })); sign.position.set(0, 1.45, -0.15); cab.add(sign);
  const head = new THREE.MeshBasicMaterial({ color: 0xfffbe6 }), tail = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
  [-0.6, 0.6].forEach(x => {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.05), head); h.position.set(x, 0.62, 1.96); cab.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.05), tail); t.position.set(x, 0.62, -1.96); cab.add(t);
  });
  const wg = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 18); wg.rotateZ(Math.PI / 2);
  [[-0.84, 1.25], [0.84, 1.25], [-0.84, -1.25], [0.84, -1.25]].forEach(([x, z]) => { const w = new THREE.Mesh(wg, dark); w.position.set(x, 0.32, z); cab.add(w); });
  return cab;
}

export function createCityNYScene(): {
  group: THREE.Group;
  holeObjects: THREE.Object3D[];
  windowMaterials: THREE.MeshStandardMaterial[];
  update: (dt: number, elapsed: number) => void;
  /** đồng bộ bảng NEW YORK với giờ HUD (giờ Tokyo, giây) → giờ New York = Tokyo − 14h */
  setLocalTime: (tokyoSeconds: number) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'city_ny';
  const textures: THREE.Texture[] = [];
  const holeObjects: THREE.Object3D[] = [];
  const windowMaterials: THREE.MeshStandardMaterial[] = [];
  const puffs: THREE.Sprite[] = [];
  const blinkers: { mat: THREE.MeshBasicMaterial; base: THREE.Color; phase: number }[] = [];

  // 1. Mặt đường ướt (bóng nhẹ dưới đèn) + vỉa hè + vạch
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 90), new THREE.MeshStandardMaterial({ color: 0x1a1e27, roughness: 0.42, metalness: 0.25 }));
  road.rotation.x = -Math.PI / 2; road.position.z = -28; road.receiveShadow = true; group.add(road);
  const yellow = new THREE.MeshBasicMaterial({ color: 0xe8a90a });
  [-0.12, 0.12].forEach(lx => { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 86), yellow); l.rotation.x = -Math.PI / 2; l.position.set(lx, 0.012, -28); group.add(l); });
  const white = new THREE.MeshBasicMaterial({ color: 0xcfd6e0 });
  for (let z = -6; z > -60; z -= 6) [-2.3, 2.3].forEach(x => { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 2.4), white); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.012, z); group.add(d); });
  for (let i = -3; i <= 3; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 2.2), white); s.rotation.x = -Math.PI / 2; s.position.set(i * 1.15, 0.014, 3.4); group.add(s); }
  const walk = new THREE.MeshStandardMaterial({ color: 0x3b4150, roughness: 0.85 });
  const curb = new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.7 });
  [-1, 1].forEach(sd => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.2, 90), walk); w.position.set(sd * 7.4, 0.1, -28); w.receiveShadow = true; group.add(w);
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 90), curb); c.position.set(sd * 4.65, 0.11, -28); group.add(c);
  });

  // 2. Miệng hầm (env.showHole) – viền mảnh phát sáng cam
  const hole = new THREE.Group(); hole.position.set(0, 0.02, 1.45);
  const pit = new THREE.Mesh(new THREE.CircleGeometry(0.92, 40), new THREE.MeshBasicMaterial({ color: 0x030408 })); pit.rotation.x = -Math.PI / 2; pit.position.y = 0.006; hole.add(pit);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.07, 12, 48), new THREE.MeshStandardMaterial({ color: 0x5a3a1a, emissive: 0xff8a2a, emissiveIntensity: 1.6, roughness: 0.5 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.05; hole.add(rim);
  const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.5, 48), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.18, depthWrite: false }));
  glowRing.rotation.x = -Math.PI / 2; glowRing.position.y = 0.01; hole.add(glowRing);
  group.add(hole); holeObjects.push(hole);

  // 3. Toà nhà hai bên đại lộ – tường nhiều màu, chỉ cửa sổ sáng mới phát quang
  const bases = ['#3c414d', '#4a3e36', '#2e3949', '#4d5059', '#3a332e', '#34404f'];
  const specs: [number, number, number, number, number][] = [
    [-1, 2.0, 4.6, 16, 5.6], [-1, -5.0, 4.8, 22, 6.0], [-1, -12.4, 4.4, 18, 5.4], [-1, -19.6, 5.2, 27, 6.4], [-1, -27.8, 4.8, 21, 6.0], [-1, -35.6, 5.0, 30, 6.2], [-1, -44.0, 4.8, 24, 6.0],
    [1, 1.4, 4.6, 18, 5.6], [1, -5.6, 4.8, 24, 5.8], [1, -13.2, 4.6, 19, 5.8], [1, -20.8, 5.2, 29, 6.4], [1, -29.0, 5.0, 23, 6.0], [1, -37.0, 5.0, 26, 6.2], [1, -45.4, 4.8, 21, 6.0],
  ];
  specs.forEach(([sd, z, w, h, d], i) => {
    const { map, emissiveMap } = facade(i + 3, bases[i % bases.length], 6, 16, 0.38 + (i % 3) * 0.08);
    map.repeat.set(Math.max(1, Math.round(d / 5)), Math.max(1, Math.round(h / 9))); emissiveMap.repeat.copy(map.repeat);
    textures.push(map, emissiveMap);
    const mat = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.75, metalness: 0.05 });
    windowMaterials.push(mat);
    const x = sd * (6.6 + w / 2);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, h / 2, z); group.add(b);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 1.6, d * 0.6), new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.9 }));
    cap.position.set(x, h + 0.8, z); group.add(cap);
    // đèn đỏ chớp trên nóc
    const bm = new THREE.MeshBasicMaterial({ color: 0xff3030 }); const bl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bm);
    bl.position.set(x, h + 1.75, z); group.add(bl); blinkers.push({ mat: bm, base: new THREE.Color(0xff3030), phase: i * 0.7 });
    // bảng hiệu / mái hiên tầng trệt phía mặt đường
    const fx = sd * 6.58, colors = [0xff3b6b, 0x29d3ff, 0xffc93c, 0x8c5bff, 0x3cff9e, 0xff7a29];
    const awn = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, d * 0.8), new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }));
    awn.position.set(fx - sd * 0.25, 2.6, z); group.add(awn);
    const shop = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.8, 2.1), new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.55 }));
    shop.rotation.y = -sd * Math.PI / 2; shop.position.set(fx, 1.25, z); group.add(shop);
  });

  // 4. Empire State phía cuối đại lộ
  const emp = new THREE.Group(); emp.position.set(0, 0, -62);
  const ef = facade(99, '#4a4f5a', 8, 20, 0.5); ef.map.repeat.set(2, 4); ef.emissiveMap.repeat.set(2, 4); textures.push(ef.map, ef.emissiveMap);
  const empMat = new THREE.MeshStandardMaterial({ map: ef.map, emissiveMap: ef.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.6 });
  windowMaterials.push(empMat);
  [[10, 18, 7, 9], [7.2, 16, 5.4, 26], [4.4, 9, 3.8, 38.5], [2.4, 4, 2.4, 45]].forEach(([w, h, d, y]) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), empMat); t.position.y = y; emp.add(t);
  });
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 3, 12), new THREE.MeshBasicMaterial({ color: 0xffe6a8 })); crown.position.y = 48.5; emp.add(crown);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.45, 9.5, 12), new THREE.MeshBasicMaterial({ color: 0xfff2c8 })); spire.position.y = 54.7; emp.add(spire);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff595e });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), beaconMat); beacon.position.y = 59.6; emp.add(beacon);
  blinkers.push({ mat: beaconMat, base: new THREE.Color(0xff595e), phase: 0 });
  group.add(emp);

  // 5. Dãy nhà xa phía sau (lấp kín đường chân trời)
  const sky = skylineTexture(); textures.push(sky);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(170, 42), new THREE.MeshBasicMaterial({ map: sky, transparent: true, depthWrite: false, fog: false }));
  back.position.set(0, 20, -80); group.add(back);

  // 6. Bảng neon kiểu Times Square
  const boards: [string, string, string, string, number, number, number, number, number][] = [
    ['NEW YORK', '22:42  LOCAL TIME', '#14213d', '#ffd166', -1, 6.2, -5.0, 4.4, 2.2],
    ['42 MIN', 'TOKYO → NYC', '#0b1d33', '#ff9f43', 1, 6.6, -5.6, 4.4, 2.2],
    ['NYC', '', '#2a0b2e', '#ff4fd8', -1, 9.6, -12.4, 3.2, 1.6],
    ['SUBWAY', '24H', '#0b2a1f', '#3cff9e', 1, 3.6, -13.2, 3.0, 1.3],
    ['THEATER', 'TONIGHT', '#2e0b0b', '#ff4b4b', -1, 4.2, -19.6, 3.6, 1.6],
    ['CAFE', 'OPEN', '#1f1405', '#ffc93c', 1, 4.0, -20.8, 2.6, 1.3],
  ];
  let nyTex: THREE.CanvasTexture | null = null, nyLabel = '';
  boards.forEach(([t, s, bg, glow, sd, y, z, w, h], bi) => {
    const tex = neonTexture(t, s, bg, glow); textures.push(tex);
    if (bi === 0) nyTex = tex;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
    m.position.set(sd * 6.55, y, z); m.rotation.y = -sd * Math.PI / 2; group.add(m);
  });
  // biển dọc phát sáng
  [[-1, -8.8, '#ff3b6b'], [1, -17.0, '#29d3ff'], [-1, -24.0, '#ffc93c']].forEach(([sd, z, col]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5, 0.9), new THREE.MeshBasicMaterial({ color: col as string }));
    m.position.set((sd as number) * 6.35, 7, z as number); group.add(m);
  });

  // 7. Taxi vàng
  const cabL = createYellowCab(); cabL.position.set(-3.1, 0, -4.8); group.add(cabL);
  const cabR = createYellowCab(); cabR.position.set(3.1, 0, -11); cabR.rotation.y = Math.PI; group.add(cabR);
  const cabF = createYellowCab(); cabF.position.set(-2.4, 0, -22); group.add(cabF);

  // 8. Đèn đường + quầng sáng thật (2 cột gần dùng PointLight)
  const pole = new THREE.MeshStandardMaterial({ color: 0x1c2530, metalness: 0.5, roughness: 0.4 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
  ([[-5.0, -1.5], [5.0, -1.5], [-5.0, -13], [5.0, -13], [-5.0, -25], [5.0, -25]] as [number, number][]).forEach(([lx, lz], i) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.6, 10), pole); p.position.set(lx, 2.3, lz); group.add(p);
    const dir = lx < 0 ? 1 : -1;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.08), pole); arm.position.set(lx + dir * 0.48, 4.55, lz); group.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), bulbMat); bulb.position.set(lx + dir * 0.92, 4.42, lz); group.add(bulb);
    if (i < 2) { const L = new THREE.PointLight(0xffc977, 26, 12, 2); L.position.copy(bulb.position); group.add(L); }
  });
  const neonFill = new THREE.PointLight(0x5ab8ff, 14, 14, 2); neonFill.position.set(3.5, 4.5, -3); group.add(neonFill);
  const neonFill2 = new THREE.PointLight(0xff5fa8, 10, 12, 2); neonFill2.position.set(-3.8, 3.5, -6); group.add(neonFill2);

  // 9. Khói nắp cống – sprite mềm
  const pt = puffTexture(); textures.push(pt);
  const manhole = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.4 }));
  manhole.rotation.x = -Math.PI / 2; manhole.position.set(-3.6, 0.013, -2.2); group.add(manhole);
  for (let i = 0; i < 10; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pt, transparent: true, opacity: 0.32, depthWrite: false }));
    sp.position.set(-3.6, 0.2 + i * 0.38, -2.2); sp.userData.phase = i * 0.9; puffs.push(sp); group.add(sp);
  }

  return {
    group, holeObjects, windowMaterials,
    update: (dt: number, elapsed: number) => {
      for (const p of puffs) {
        p.position.y += 0.55 * dt;
        if (p.position.y > 3.9) p.position.y = 0.2;
        const k = p.position.y / 3.9;
        p.position.x = -3.6 + Math.sin(elapsed * 1.2 + p.userData.phase) * 0.25 + k * 0.6;
        p.scale.setScalar(0.5 + k * 1.8);
        (p.material as THREE.SpriteMaterial).opacity = 0.34 * (1 - k);
      }
      for (const b of blinkers) b.mat.color.copy(b.base).multiplyScalar(Math.sin(elapsed * 2.2 + b.phase) > 0.2 ? 1 : 0.15);
    },
    setLocalTime: (tokyoSeconds: number) => {
      if (!nyTex || !Number.isFinite(tokyoSeconds)) return;
      const m = Math.floor((((tokyoSeconds - 14 * 3600) % 86400) + 86400) % 86400 / 60);
      const label = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}  LOCAL TIME`;
      if (label === nyLabel) return;
      nyLabel = label;
      const b = boards[0];
      neonTexture(b[0], label, b[2], b[3], 512, 256, nyTex.image as HTMLCanvasElement);
      nyTex.needsUpdate = true;
    },
    dispose: () => {
      textures.forEach(t => t.dispose());
      group.traverse(obj => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose()); else if (mat) mat.dispose();
      });
    },
  };
}
