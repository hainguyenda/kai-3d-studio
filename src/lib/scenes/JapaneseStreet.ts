import * as THREE from "three";
import type { CharacterLike, FrameCtx, ScenePrefab } from "../types";
import { rng } from "../math";
import {
  createAsphaltTexture, createBlockWallTexture, createGutterTexture, createHazardRimTexture,
  createHouseSidingTexture, createManholeTexture, createRoofTileTexture, createSkyTexture,
} from "../textures";
import { applyCameraPreset } from "./cameraPresets";

const ROAD_W = 7, LEN = 120, HOLE_R = 0.78;
const ANCHOR = new THREE.Vector3(0, 0, -0.6);
const HOLE = new THREE.Vector3(0, 0, 0.75);

/** Khu dân cư Nhật Bản: đường 2 chiều, cống, nắp cống, cái hố viền sọc vàng đen, nhà 2 tầng, cột điện */
export class JapaneseStreet implements ScenePrefab {
  id = "japanese_street" as const;
  root = new THREE.Group();
  private sky: THREE.Texture;
  private fog = new THREE.FogExp2("#dfe8ee", 0.012);
  private disposables: { dispose(): void }[] = [];

  constructor() {
    this.sky = createSkyTexture("#7fb7e6", "#e6eef3");
    this.disposables.push(this.sky);
    const R = rng(4);
    const std = (o: THREE.MeshStandardMaterialParameters) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05, ...o }); this.disposables.push(m); return m; };
    const track = <T extends { dispose(): void }>(x: T): T => { this.disposables.push(x); return x; };
    const shadow = <T extends THREE.Object3D>(o: T, cast = true): T => { o.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = cast; c.receiveShadow = true; } }); return o; };
    const add = <T extends THREE.Object3D>(o: T, cast = true): T => { this.root.add(shadow(o, cast)); return o; };

    /* ---------- ánh sáng ---------- */
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8d99ae, 1.0);
    const sun = new THREE.DirectionalLight(0xfff5e4, 2.1);
    sun.position.set(18, 30, 14); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 90 });
    sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
    sun.target.position.set(0, 0, -6);
    this.root.add(hemi, sun, sun.target);

    /* ---------- mặt đường có lỗ hố ---------- */
    const asphalt = track(createAsphaltTexture());
    asphalt.repeat.set(1 / ROAD_W, 1 / 14); asphalt.offset.set(0.5, 0);
    const roadShape = new THREE.Shape();
    roadShape.moveTo(-ROAD_W / 2, -12); roadShape.lineTo(ROAD_W / 2, -12); roadShape.lineTo(ROAD_W / 2, LEN); roadShape.lineTo(-ROAD_W / 2, LEN); roadShape.closePath();
    const holePath = new THREE.Path(); holePath.absarc(HOLE.x, -HOLE.z, HOLE_R, 0, Math.PI * 2, true); roadShape.holes.push(holePath);
    const road = new THREE.Mesh(track(new THREE.ShapeGeometry(roadShape, 48)), std({ map: asphalt, roughness: 0.92 }));
    road.rotation.x = -Math.PI / 2; add(road, false);

    // đất hai bên
    for (const s of [-1, 1]) {
      const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(60, LEN + 20)), std({ color: "#9b9a90" }));
      ground.rotation.x = -Math.PI / 2; ground.position.set(s * (ROAD_W / 2 + 30), -0.01, -LEN / 2 + 8); add(ground, false);
      const gtex = track(createGutterTexture()); gtex.repeat.set(1, (LEN + 20) / 4);
      const gutter = new THREE.Mesh(track(new THREE.BoxGeometry(0.45, 0.08, LEN + 20)), std({ map: gtex }));
      gutter.position.set(s * (ROAD_W / 2 + 0.22), 0.04, -LEN / 2 + 8); add(gutter, false);
    }
    const manhole = new THREE.Mesh(track(new THREE.CircleGeometry(0.34, 32)), std({ map: track(createManholeTexture()), roughness: 0.6, metalness: 0.3 }));
    manhole.rotation.x = -Math.PI / 2; manhole.position.set(-1.6, 0.012, -7); add(manhole, false);

    /* ---------- cái hố ---------- */
    const shaft = new THREE.Mesh(track(new THREE.CylinderGeometry(HOLE_R, HOLE_R, 40, 48, 1, true)), std({ color: "#1b1b1f", side: THREE.BackSide, roughness: 1 }));
    shaft.position.set(HOLE.x, -20, HOLE.z); this.root.add(shaft);
    const bottom = new THREE.Mesh(track(new THREE.CircleGeometry(HOLE_R, 32)), new THREE.MeshBasicMaterial({ color: "#000000" }));
    this.disposables.push(bottom.material as THREE.Material);
    bottom.rotation.x = -Math.PI / 2; bottom.position.set(HOLE.x, -6, HOLE.z); this.root.add(bottom);
    const rimTex = track(createHazardRimTexture()); rimTex.repeat.set(6, 1);
    const rim = new THREE.Mesh(track(new THREE.TorusGeometry(HOLE_R + 0.06, 0.09, 16, 72)), std({ map: rimTex, roughness: 0.6 }));
    rim.rotation.x = -Math.PI / 2; rim.position.set(HOLE.x, 0.05, HOLE.z); add(rim);

    /* ---------- nhà hai bên đường ---------- */
    const sidingCols = ["#ece5d6", "#e3d9c6", "#dcd8cf", "#f2eee5", "#cfc2ab", "#e9e2d5"];
    const sidings = sidingCols.map(c => { const t = track(createHouseSidingTexture(c)); t.repeat.set(2, 1.6); return std({ map: t }); });
    const roofMats = ["#4a4f57", "#5b4436", "#3f444b"].map(c => { const t = track(createRoofTileTexture(c)); t.repeat.set(3, 2); return std({ map: t, roughness: 0.75 }); });
    const blockTex = track(createBlockWallTexture()); blockTex.repeat.set(3, 1);
    const blockMat = std({ map: blockTex });
    const frameMat = std({ color: "#5b4a3a" }), glassMat = std({ color: "#3a4d63", roughness: 0.15, metalness: 0.4 }), curtainMat = std({ color: "#e8d9b8", roughness: 0.95 });
    const doorMat = std({ color: "#6b4f3a" }), ironMat = std({ color: "#1c1c1e", roughness: 0.5, metalness: 0.6 }), railMat = std({ color: "#d7d7d2", roughness: 0.5, metalness: 0.4 });
    const trunkMat = std({ color: "#6b5038" });
    const leafMats = ["#3d6b36", "#4b7b3f", "#355f30", "#5a8a46"].map(c => std({ color: c, flatShading: true }));
    const box = (w: number, h: number, d: number) => track(new THREE.BoxGeometry(w, h, d));
    const barGeo = track(new THREE.BoxGeometry(0.025, 0.62, 0.025)), railGeo = track(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6));
    const fenceBars: THREE.Matrix4[] = [], balRails: THREE.Matrix4[] = [];
    const icoGeo = [track(new THREE.IcosahedronGeometry(0.7, 1)), track(new THREE.IcosahedronGeometry(0.55, 1)), track(new THREE.IcosahedronGeometry(0.4, 0))];

    for (const s of [-1, 1]) {
      for (let z = 4; z > -LEN + 10; z -= 10.5 + R() * 2.5) {
        const lot = 9, cz = z - lot / 2;
        // tường gạch block + hàng rào sắt
        const wallX = s * (ROAD_W / 2 + 0.75), wallLen = lot - 2.2;
        const wall = new THREE.Mesh(box(0.22, 0.85, wallLen), blockMat); wall.position.set(wallX, 0.425, cz - 0.6); add(wall);
        for (let b = 0; b < wallLen; b += 0.16) fenceBars.push(new THREE.Matrix4().makeTranslation(wallX, 0.85 + 0.31, cz - 0.6 - wallLen / 2 + b));
        const cap = new THREE.Mesh(box(0.05, 0.04, wallLen), ironMat); cap.position.set(wallX, 1.47, cz - 0.6); add(cap);
        // nhà
        const hw = 6.2 + R() * 1.8, hd = 7 + R() * 1.4, hh = 5.5 + R() * 0.7, hx = s * (ROAD_W / 2 + 2.6 + hw / 2);
        const house = new THREE.Group(); house.position.set(hx, 0, cz);
        const body = new THREE.Mesh(box(hw, hh, hd), sidings[Math.floor(R() * sidings.length)]); body.position.y = hh / 2; house.add(body);
        const band = new THREE.Mesh(box(hw + 0.08, 0.14, hd + 0.08), frameMat); band.position.y = hh * 0.5; house.add(band);
        // mái dốc + mái hiên
        const rw = hw / 2 + 0.55, rise = 1.7 + R() * 0.5, sh = new THREE.Shape();
        sh.moveTo(-rw, 0); sh.lineTo(rw, 0); sh.lineTo(0, rise); sh.closePath();
        const rg = track(new THREE.ExtrudeGeometry(sh, { depth: hd + 0.9, bevelEnabled: false })); rg.translate(0, 0, -(hd + 0.9) / 2);
        const roof = new THREE.Mesh(rg, roofMats[Math.floor(R() * roofMats.length)]); roof.position.y = hh; house.add(roof);
        // mặt tiền hướng ra đường (phía -s)
        const fx = -s * (hw / 2 + 0.03);
        for (let fl = 0; fl < 2; fl++) for (let w = 0; w < 2; w++) {
          if (fl === 0 && w === 0) continue; // chỗ cửa ra vào
          const wz = -hd / 4 + w * hd / 2, wy = 1.55 + fl * 2.65, win = new THREE.Group();
          const frame = new THREE.Mesh(box(0.08, 1.25, 1.5), frameMat); win.add(frame);
          const glass = new THREE.Mesh(box(0.04, 1.08, 1.32), glassMat); glass.position.x = -s * 0.03; win.add(glass);
          for (const cs of [-1, 1]) { const cur = new THREE.Mesh(box(0.02, 1.0, 0.38), curtainMat); cur.position.set(-s * 0.035, 0, cs * 0.45); win.add(cur); }
          const sill = new THREE.Mesh(box(0.18, 0.06, 1.6), frameMat); sill.position.set(-s * 0.06, -0.66, 0); win.add(sill);
          win.position.set(fx, wy, wz); house.add(win);
        }
        const door = new THREE.Mesh(box(0.08, 2.05, 1.0), doorMat); door.position.set(fx, 1.03, -hd / 4); house.add(door);
        const canopy = new THREE.Mesh(box(0.9, 0.08, 1.4), frameMat); canopy.position.set(fx - s * 0.45, 2.3, -hd / 4); house.add(canopy);
        // ban công tầng 2
        if (R() < 0.75) {
          const bx = fx - s * 0.55, bz = hd / 4;
          const slab = new THREE.Mesh(box(1.1, 0.12, 2.6), railMat); slab.position.set(bx, 3.25, bz); house.add(slab);
          const topRail = new THREE.Mesh(box(0.05, 0.05, 2.6), railMat); topRail.position.set(bx - s * 0.52, 4.18, bz); house.add(topRail);
          for (let r = -1.25; r <= 1.25; r += 0.13) balRails.push(new THREE.Matrix4().makeTranslation(hx + bx - s * 0.52, 3.75, cz + bz + r));
        }
        const wallLeft = new THREE.Mesh(box(0.12, 0.8, 0.12), frameMat); wallLeft.position.set(fx, hh + 0.05, 0); house.add(wallLeft);
        add(house);
        // cây nhiều tầng
        if (R() < 0.7) {
          const tx = s * (ROAD_W / 2 + 1.6), tz = cz + (R() - 0.5) * 3, tree = new THREE.Group();
          const th = 1.8 + R() * 1.2, trunk = new THREE.Mesh(track(new THREE.CylinderGeometry(0.07, 0.11, th, 8)), trunkMat); trunk.position.y = th / 2; tree.add(trunk);
          const tiers = 3 + Math.floor(R() * 2);
          for (let k = 0; k < tiers; k++) {
            const n = 2 + Math.floor(R() * 2);
            for (let c = 0; c < n; c++) {
              const leaf = new THREE.Mesh(icoGeo[Math.floor(R() * 3)], leafMats[Math.floor(R() * leafMats.length)]);
              const sc = 0.9 - k * 0.12; leaf.scale.set(sc, sc * 0.75, sc);
              leaf.position.set((R() - 0.5) * 0.7, th * 0.55 + k * 0.62, (R() - 0.5) * 0.7); leaf.rotation.set(R() * 3, R() * 3, R() * 3); tree.add(leaf);
            }
          }
          tree.position.set(tx, 0, tz); add(tree);
        }
        // bụi cây thấp sau tường
        if (R() < 0.6) for (let b = 0; b < 3; b++) {
          const bush = new THREE.Mesh(icoGeo[1], leafMats[Math.floor(R() * leafMats.length)]); bush.scale.set(1.1, 0.8, 1.1);
          bush.position.set(s * (ROAD_W / 2 + 1.3 + R() * 0.5), 0.9 + R() * 0.3, cz - 2 + b * 1.6); add(bush);
        }
      }
      // cột điện + dây điện võng
      const poles: THREE.Vector3[] = [];
      for (let z = 6; z > -LEN + 10; z -= 26) {
        const px = s * (ROAD_W / 2 + 0.45), pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.11, 0.15, 9.5, 12)), std({ color: "#aaa79f" }));
        pole.position.set(px, 4.75, z); add(pole);
        const arm = new THREE.Mesh(box(1.8, 0.1, 0.1), std({ color: "#8e8c86" })); arm.position.set(px, 8.7, z); add(arm);
        for (const dx of [-0.75, 0.75]) { const ins = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8)), std({ color: "#ececec" })); ins.position.set(px + dx, 8.83, z); add(ins); }
        const tr = new THREE.Mesh(track(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 14)), std({ color: "#9aa0a3", metalness: 0.3 })); tr.position.set(px + s * 0.35, 7.3, z); add(tr);
        poles.push(new THREE.Vector3(px, 8.9, z));
      }
      const wireMat = std({ color: "#111111", roughness: 0.6 });
      for (let i = 1; i < poles.length; i++) for (const dx of [-0.75, 0.75]) {
        const a = poles[i - 1].clone().add(new THREE.Vector3(dx, 0, 0)), b = poles[i].clone().add(new THREE.Vector3(dx, 0, 0));
        const mid = a.clone().lerp(b, 0.5); mid.y -= 0.75;
        const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).setY(a.y - 0.42), mid, b.clone().lerp(mid, 0.5).setY(b.y - 0.42), b]);
        const wire = new THREE.Mesh(track(new THREE.TubeGeometry(curve, 32, 0.018, 5, false)), wireMat); add(wire, false);
      }
    }
    const fence = new THREE.InstancedMesh(barGeo, ironMat, fenceBars.length); fenceBars.forEach((m, i) => fence.setMatrixAt(i, m)); fence.castShadow = true; this.root.add(fence);
    const rails = new THREE.InstancedMesh(railGeo, railMat, Math.max(1, balRails.length)); balRails.forEach((m, i) => rails.setMatrixAt(i, m)); rails.count = balRails.length; rails.castShadow = true; this.root.add(rails);
  }

  apply(scene: THREE.Scene): void { scene.background = this.sky; scene.fog = this.fog; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    character.root.position.copy(ANCHOR);
    character.root.rotation.set(0, 0, 0);
    if (ctx.beat.characterAction === "jump_in") character.root.position.x = HOLE.x;
    applyCameraPreset(camera, ctx.beat.cameraPreset, ANCHOR, ctx.lp);
  }

  dispose(): void { this.disposables.forEach(d => d.dispose()); }
}
