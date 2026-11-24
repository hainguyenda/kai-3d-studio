import * as THREE from "three";
import type { CharacterAction, CharacterLike, Emotion, FaceInput } from "../types";
import { clamp, easeInOut, easeOut, lerp, seg } from "../math";
import { FACE_PHI_LEN, FACE_THETA_END, FACE_THETA_START, FaceCanvas } from "./FaceCanvas";

const mat = (color: string, rough = 0.78): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.04 });

const HEAD_R = 0.31, HEAD_Y = 0.31;

/**
 * Nhân vật 2 (mặc định): tóc rối vuốt lệch + 1 sợi tóc vểnh (ahoge), kính Boston vuông bo góc,
 * áo gió 2 màu (xanh xô thơm trên, kem dưới), dây túi đeo chéo, quần túi hộp, giày trắng–xanh.
 * Khuôn mặt vẽ bằng canvas (chớp mắt, nhép miệng theo giọng), lông mày 3D đổi theo cảm xúc.
 * Cao ~1.75 đơn vị, cùng tỉ lệ với nhân vật 1 để các góc camera vẫn đúng.
 */
export class CharacterPrefab2 implements CharacterLike {
  root = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private helmet = new THREE.Group();
  private browL: THREE.Mesh;
  private browR: THREE.Mesh;
  private ahoge: THREE.Mesh;
  private face: FaceCanvas;
  private materials: THREE.Material[] = [];
  private mouth = 0;
  private lastT = -1;
  private tilt = 0;

  constructor() {
    const C = {
      skin: mat("#f2cbb0", 0.72), hair: mat("#2c2623", 0.62), sage: mat("#3b7a75", 0.8), cream: mat("#f4efe6", 0.85),
      strap: mat("#1e272e", 0.65), silver: new THREE.MeshStandardMaterial({ color: "#c8ced3", roughness: 0.3, metalness: 0.85 }),
      pants: mat("#2f3542", 0.86), shoe: mat("#f7f7f5", 0.6), teal: mat("#2e8f88", 0.6), sole: mat("#d9dde0", 0.7),
      zip: mat("#3a3f44", 0.5), frame: mat("#2f3640", 0.4),
    };
    this.materials.push(...Object.values(C));
    const lens = new THREE.MeshPhysicalMaterial({ color: "#e8f4ff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false });
    this.materials.push(lens);
    const add = <T extends THREE.Object3D>(parent: THREE.Object3D, o: T, cast = true): T => {
      parent.add(o); o.traverse(m => { if ((m as THREE.Mesh).isMesh) { m.castShadow = cast; m.receiveShadow = true; } }); return o;
    };
    const mesh = (geo: THREE.BufferGeometry, m: THREE.Material) => new THREE.Mesh(geo, m);
    this.root.add(this.body);

    /* ---------- chân: quần túi hộp + giày thể thao ---------- */
    const leg = (g: THREE.Group, x: number) => {
      g.position.set(x, 0.74, 0); this.body.add(g);
      const thigh = add(g, mesh(new THREE.CapsuleGeometry(0.125, 0.4, 6, 16), C.pants)); thigh.position.y = -0.3;
      const pocket = add(g, mesh(new THREE.BoxGeometry(0.03, 0.13, 0.12), C.pants)); pocket.position.set(Math.sign(x) * 0.125, -0.26, 0);
      const flap = add(g, mesh(new THREE.BoxGeometry(0.035, 0.025, 0.125), C.zip)); flap.position.set(Math.sign(x) * 0.127, -0.195, 0);
      const cuff = add(g, mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.07, 18), C.pants)); cuff.position.y = -0.57;
      const shoe = add(g, mesh(new THREE.CapsuleGeometry(0.11, 0.17, 6, 14), C.shoe)); shoe.rotation.x = Math.PI / 2; shoe.position.set(0, -0.665, 0.06); shoe.scale.set(1.08, 1, 0.9);
      const stripe = add(g, mesh(new THREE.BoxGeometry(0.235, 0.035, 0.2), C.teal)); stripe.position.set(0, -0.655, 0.04);
      const heel = add(g, mesh(new THREE.BoxGeometry(0.2, 0.07, 0.06), C.teal)); heel.position.set(0, -0.67, -0.12);
      const sole = add(g, mesh(new THREE.BoxGeometry(0.235, 0.05, 0.42), C.sole)); sole.position.set(0, -0.74, 0.06);
    };
    leg(this.legL, -0.135); leg(this.legR, 0.135);

    /* ---------- thân: áo gió 2 màu (lathe theo dáng thân) ---------- */
    const lathe = (pts: [number, number][], m: THREE.Material) => {
      const o = mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 40), m); o.scale.set(1, 1, 0.8); return add(this.body, o);
    };
    lathe([[0.0, 0.76], [0.2, 0.765], [0.262, 0.8], [0.285, 0.88], [0.29, 1.07]], C.cream);
    lathe([[0.292, 1.06], [0.29, 1.2], [0.265, 1.29], [0.2, 1.355], [0.11, 1.385], [0.0, 1.39]], C.sage);
    const hem = add(this.body, mesh(new THREE.TorusGeometry(0.262, 0.032, 10, 32), C.cream)); hem.rotation.x = Math.PI / 2; hem.position.y = 0.8; hem.scale.set(1, 0.8, 1);
    const seam = add(this.body, mesh(new THREE.TorusGeometry(0.292, 0.012, 8, 40), C.zip)); seam.rotation.x = Math.PI / 2; seam.position.y = 1.065; seam.scale.set(1, 0.8, 1);
    const zipper = add(this.body, mesh(new THREE.BoxGeometry(0.018, 0.56, 0.012), C.zip)); zipper.position.set(0, 1.08, 0.232); zipper.rotation.x = -0.05;
    const pull = add(this.body, mesh(new THREE.BoxGeometry(0.03, 0.05, 0.012), C.silver)); pull.position.set(0, 1.3, 0.228);
    const collar = add(this.body, mesh(new THREE.TorusGeometry(0.15, 0.045, 12, 32), C.sage)); collar.position.set(0, 1.37, 0.0); collar.rotation.x = Math.PI / 2.15;
    const hood = add(this.body, mesh(new THREE.TorusGeometry(0.16, 0.06, 12, 28), C.sage)); hood.position.set(0, 1.38, -0.12); hood.rotation.x = Math.PI / 2.6;

    /* ---------- dây túi đeo chéo: vai phải → hông trái ---------- */
    const strapPiece = (a: THREE.Vector3, b: THREE.Vector3) => {
      const len = a.distanceTo(b), s = add(this.body, mesh(new THREE.BoxGeometry(0.055, len, 0.018), C.strap));
      s.position.copy(a).lerp(b, 0.5); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return s;
    };
    strapPiece(new THREE.Vector3(-0.17, 1.34, 0.17), new THREE.Vector3(0.24, 0.86, 0.205));
    strapPiece(new THREE.Vector3(-0.17, 1.34, -0.17), new THREE.Vector3(0.25, 0.88, -0.2));
    strapPiece(new THREE.Vector3(-0.17, 1.345, 0.17), new THREE.Vector3(-0.17, 1.345, -0.17));
    const buckle = add(this.body, mesh(new THREE.BoxGeometry(0.075, 0.05, 0.022), C.silver)); buckle.position.set(-0.075, 1.23, 0.218); buckle.rotation.z = -0.7;
    const bag = add(this.body, mesh(new THREE.CapsuleGeometry(0.075, 0.12, 6, 12), C.strap)); bag.rotation.z = Math.PI / 2; bag.position.set(0.27, 0.85, 0.03); bag.scale.set(1, 1, 0.75);
    const bagZip = add(this.body, mesh(new THREE.BoxGeometry(0.2, 0.012, 0.012), C.silver)); bagZip.position.set(0.27, 0.9, 0.085);

    /* ---------- tay: tay áo + cổ tay bo + bàn tay có ngón cái ---------- */
    const arm = (g: THREE.Group, x: number) => {
      g.position.set(x, 1.27, 0); this.body.add(g);
      const sleeve = add(g, mesh(new THREE.CapsuleGeometry(0.08, 0.34, 6, 14), C.sage)); sleeve.position.y = -0.24;
      const cuff = add(g, mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 20), C.cream)); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.46;
      const hand = add(g, mesh(new THREE.SphereGeometry(0.068, 18, 14), C.skin)); hand.position.y = -0.53; hand.scale.set(0.95, 1.08, 0.85);
      const thumb = add(g, mesh(new THREE.CapsuleGeometry(0.022, 0.04, 4, 8), C.skin)); thumb.position.set(-Math.sign(x) * 0.045, -0.5, 0.035); thumb.rotation.z = Math.sign(x) * 0.6;
    };
    arm(this.armL, -0.36); arm(this.armR, 0.36);

    /* ---------- đầu ---------- */
    this.head.position.y = 1.42; this.body.add(this.head);
    const skull = mesh(new THREE.SphereGeometry(HEAD_R, 48, 32), C.skin); skull.position.y = HEAD_Y;
    skull.castShadow = true; skull.receiveShadow = false; // không nhận bóng → mặt không bị tối
    this.head.add(skull);
    for (const s of [-1, 1]) { const ear = add(this.head, mesh(new THREE.SphereGeometry(0.055, 14, 10), C.skin)); ear.position.set(s * 0.305, HEAD_Y - 0.01, -0.02); ear.scale.set(0.5, 1, 0.8); }

    // lớp mặt vẽ bằng canvas
    this.face = new FaceCanvas("#f2cbb0");
    const faceMat = new THREE.MeshStandardMaterial({ map: this.face.texture, transparent: true, roughness: 0.75, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    this.materials.push(faceMat);
    const faceMesh = mesh(new THREE.SphereGeometry(HEAD_R * 1.004, 72, 48, Math.PI / 2 - FACE_PHI_LEN / 2, FACE_PHI_LEN, FACE_THETA_START, FACE_THETA_END - FACE_THETA_START), faceMat);
    faceMesh.position.y = HEAD_Y; faceMesh.renderOrder = 2; this.head.add(faceMesh);

    // tóc: mũ tóc + các lọn rối + mái vuốt lệch + ahoge
    const cap = add(this.head, mesh(new THREE.SphereGeometry(HEAD_R * 1.07, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.42), C.hair), false);
    cap.position.set(0, HEAD_Y + 0.035, -0.015); cap.rotation.x = -0.22;
    const back = add(this.head, mesh(new THREE.SphereGeometry(HEAD_R * 1.03, 32, 18), C.hair), false); back.position.set(0, HEAD_Y + 0.01, -0.08); back.scale.set(1.02, 0.96, 0.85);
    const lock = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx: number, ry: number, rz: number, detail = 1) => {
      const l = add(this.head, mesh(new THREE.IcosahedronGeometry(0.1, detail), C.hair), false);
      l.position.set(x, HEAD_Y + y, z); l.scale.set(sx, sy, sz); l.rotation.set(rx, ry, rz); return l;
    };
    // lọn quanh đỉnh đầu
    const crown: [number, number, number, number][] = [
      [0, 0.3, -0.02, 0], [0.15, 0.27, -0.05, 0.6], [-0.15, 0.27, -0.06, -0.6], [0.24, 0.17, -0.06, 1.1], [-0.25, 0.16, -0.05, -1.1],
      [0.08, 0.26, -0.18, 0.3], [-0.09, 0.25, -0.19, -0.3], [0.2, 0.12, -0.2, 1.4], [-0.21, 0.11, -0.2, -1.4], [0, 0.18, -0.27, 0],
    ];
    crown.forEach(([x, y, z, r], i) => lock(x, y, z, 1.25, 0.62, 1.05, 0.2 + (i % 3) * 0.12, r * 0.5, r * 0.45));
    // mái vuốt lệch sang phải người xem, dừng trên lông mày
    lock(-0.13, 0.2, 0.2, 1.35, 0.5, 0.75, -0.35, 0.2, -0.38);
    lock(0.0, 0.215, 0.215, 1.45, 0.5, 0.75, -0.42, 0.0, -0.22);
    lock(0.13, 0.19, 0.2, 1.3, 0.48, 0.72, -0.38, -0.25, -0.05);
    lock(0.24, 0.12, 0.13, 0.9, 0.6, 0.7, -0.2, -0.7, 0.35);
    lock(-0.25, 0.08, 0.12, 0.7, 0.75, 0.7, -0.1, 0.8, -0.2);
    // tóc mai
    for (const s of [-1, 1]) lock(s * 0.29, 0.02, 0.03, 0.42, 0.85, 0.6, 0, 0, s * 0.12, 0);
    // ahoge: sợi tóc cong vểnh trên đỉnh
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.02, HEAD_Y + 0.33, 0.0), new THREE.Vector3(0.05, HEAD_Y + 0.45, 0.02),
      new THREE.Vector3(0.0, HEAD_Y + 0.53, 0.07), new THREE.Vector3(-0.07, HEAD_Y + 0.5, 0.1),
    ]);
    this.ahoge = add(this.head, mesh(new THREE.TubeGeometry(curve, 24, 0.018, 8, false), C.hair), false);

    // kính Boston vuông bo góc + tròng trong suốt mờ
    const rr = (w: number, h: number, r: number) => {
      const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
      s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
    };
    const glasses = new THREE.Group(); glasses.position.y = HEAD_Y - 0.008; this.head.add(glasses);
    for (const s of [-1, 1]) {
      const outer = rr(0.158, 0.122, 0.042), inner = rr(0.134, 0.098, 0.032);
      outer.holes.push(new THREE.Path(inner.getPoints(12)));
      const fr = mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.012, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 10 }), C.frame);
      fr.position.set(s * 0.104, 0, HEAD_R - 0.003); fr.rotation.y = s * 0.3; fr.castShadow = false; glasses.add(fr);
      const ln = mesh(new THREE.ShapeGeometry(inner, 10), lens); ln.position.set(s * 0.104, 0, HEAD_R + 0.004); ln.rotation.y = s * 0.3; ln.renderOrder = 3; glasses.add(ln);
      const temple = mesh(new THREE.BoxGeometry(0.008, 0.008, 0.25), C.frame); temple.position.set(s * 0.29, 0.02, 0.13); temple.rotation.y = s * -0.06; glasses.add(temple);
    }
    const bridge = mesh(new THREE.TorusGeometry(0.022, 0.0055, 6, 12, Math.PI), C.frame); bridge.position.set(0, 0.012, HEAD_R + 0.018); glasses.add(bridge);

    // lông mày 3D
    const browGeo = new THREE.CapsuleGeometry(0.0145, 0.062, 4, 8);
    this.browL = mesh(browGeo, C.hair); this.browR = mesh(browGeo, C.hair);
    for (const b of [this.browL, this.browR]) { b.rotation.z = Math.PI / 2; this.head.add(b); }

    // ánh sáng phụ trước mặt → mặt và miệng luôn sáng rõ, kể cả trong đường hầm dung nham
    const fill = new THREE.PointLight(0xfff8ee, 0.9, 3.5, 1.2); fill.position.set(0, HEAD_Y + 0.05, 0.85); this.head.add(fill);

    // mũ kính phi hành gia mỏng + viền kim loại mảnh
    const glass = new THREE.MeshPhysicalMaterial({ color: "#e6f6ff", roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false });
    const rim = new THREE.MeshPhysicalMaterial({ color: "#bfe6ff", roughness: 0.2, transparent: true, opacity: 0.35, side: THREE.BackSide, depthWrite: false });
    const trim = new THREE.MeshStandardMaterial({ color: "#d9dee3", roughness: 0.25, metalness: 0.9 });
    this.materials.push(glass, rim, trim);
    const bubble = mesh(new THREE.SphereGeometry(0.47, 48, 32), glass); bubble.position.y = 1.75; bubble.renderOrder = 4;
    const rimShell = mesh(new THREE.SphereGeometry(0.475, 48, 32), rim); rimShell.position.y = 1.75; rimShell.renderOrder = 4;
    const neck = mesh(new THREE.TorusGeometry(0.29, 0.018, 10, 48), trim); neck.rotation.x = Math.PI / 2; neck.position.y = 1.37;
    const neck2 = mesh(new THREE.TorusGeometry(0.3, 0.01, 8, 48), trim); neck2.rotation.x = Math.PI / 2; neck2.position.y = 1.33;
    this.helmet.add(bubble, rimShell, neck, neck2); this.helmet.visible = false; this.body.add(this.helmet);
  }

  setSpacesuit(on: boolean): void { this.helmet.visible = on; }

  /** chớp mắt mỗi ~3,2 s (lệch ngẫu nhiên nhưng cố định theo thời gian → video xuất ra luôn giống bản xem thử) */
  private blinkAt(t: number): number {
    const P = 3.2, k = Math.floor(t / P), r = Math.abs(Math.sin(k * 12.9898 + 4.1) * 43758.5453) % 1;
    const start = k * P + r * 0.9, d = t - start;
    return d >= 0 && d <= 0.16 ? Math.sin((Math.PI * d) / 0.16) : 0;
  }

  setFace(f: FaceInput): void {
    // độ mở miệng: giọng thật (AnalyserNode) hoặc nhịp âm tiết khi chưa có tiếng
    let target = 0;
    if (f.speaking) {
      if (f.voiceLevel !== undefined) target = clamp(f.voiceLevel);
      else target = 0.2 + 0.55 * Math.abs(Math.sin(f.t * 11)) * (0.55 + 0.45 * Math.sin(f.t * 4.3 + 1));
    }
    const dt = this.lastT < 0 || f.t < this.lastT || f.t - this.lastT > 0.5 ? 1 : f.t - this.lastT;
    this.lastT = f.t;
    this.mouth = lerp(this.mouth, target, clamp(dt * 18));
    const e: Emotion = f.emotion;
    const shocked = e === "shocked";
    this.face.draw({ t: f.t, blink: shocked ? 0 : this.blinkAt(f.t), mouth: this.mouth, emotion: e });

    // lông mày theo cảm xúc: [độ cao thêm, góc nghiêng] cho trái/phải (trái = phía người xem bên trái)
    const B: Record<Emotion, [number, number, number, number]> = {
      neutral: [0, 0.05, 0, -0.05], curious: [0.035, 0.18, -0.005, -0.05], excited: [0.02, 0.1, 0.02, -0.1],
      shocked: [0.05, 0.12, 0.05, -0.12], sweating: [0.01, -0.32, 0.01, 0.32],
    };
    const [hl, al, hr, ar] = B[e];
    const by = HEAD_Y + 0.095 + Math.sin(f.t * 3) * 0.002;
    this.browL.position.set(-0.104, by + hl, HEAD_R * 0.965); this.browL.rotation.set(-0.15, -0.3, Math.PI / 2 + al);
    this.browR.position.set(0.104, by + hr, HEAD_R * 0.965); this.browR.rotation.set(-0.15, 0.3, Math.PI / 2 + ar);
    // nghiêng đầu khi tò mò, ahoge lắc nhẹ
    this.tilt = lerp(this.tilt, e === "curious" ? 0.12 : 0, clamp(dt * 6));
    this.head.rotation.z += this.tilt;
    this.ahoge.rotation.z = Math.sin(f.t * 5) * (e === "excited" ? 0.12 : 0.04);
  }

  /** đặt tư thế theo hành động. lt = giây trong beat, lp = 0..1, t = giây tổng */
  setAction(action: CharacterAction, lt: number, lp: number, t: number): void {
    const b = this.body, h = this.head;
    b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); h.rotation.set(0, 0, 0);
    this.armL.rotation.set(0, 0, -0.12); this.armR.rotation.set(0, 0, 0.12);
    this.legL.rotation.set(0, 0, 0); this.legR.rotation.set(0, 0, 0);
    const breathe = Math.sin(t * 2.4) * 0.01;
    switch (action) {
      case "idle_wave": {
        b.position.y = Math.abs(Math.sin(t * 3)) * 0.035 + breathe;
        const w = easeOut(lt / 0.5);
        this.armR.rotation.z = 0.12 + w * 2.55; this.armR.rotation.y = Math.sin(t * 9) * 0.35 * w;
        h.rotation.z = Math.sin(t * 3) * 0.05;
        break;
      }
      case "look_down": {
        const k = easeInOut(lt / 0.8);
        h.rotation.x = 0.55 * k; b.rotation.x = 0.12 * k; b.position.y = breathe;
        this.armL.rotation.x = -0.2 * k; this.armR.rotation.x = -0.2 * k;
        break;
      }
      case "jump_in": {
        const crouch = seg(lt, 0, 0.35), jump = seg(lt, 0.35, 1.2), fall = Math.max(0, lt - 1.2);
        const arc = Math.sin(Math.PI * jump) * 0.9;
        b.position.y = -0.12 * Math.sin(Math.PI * crouch) + arc - fall * fall * 4.9;
        b.position.z = jump * 1.1;
        this.armL.rotation.z = -0.12 - jump * 2.4; this.armR.rotation.z = 0.12 + jump * 2.4;
        this.legL.rotation.x = -0.5 * jump; this.legR.rotation.x = 0.3 * jump;
        break;
      }
      case "freefall_float": {
        b.position.y = Math.sin(t * 1.3) * 0.08;
        b.rotation.x = Math.sin(t * 0.7) * 0.15; b.rotation.z = Math.sin(t * 0.5) * 0.12;
        this.armL.rotation.z = -1.2 + Math.sin(t * 1.7) * 0.25; this.armR.rotation.z = 1.2 + Math.sin(t * 1.5 + 1) * 0.25;
        this.legL.rotation.x = 0.35 + Math.sin(t * 1.4) * 0.2; this.legR.rotation.x = -0.25 + Math.sin(t * 1.2 + 2) * 0.2;
        this.legL.rotation.z = -0.15; this.legR.rotation.z = 0.15;
        break;
      }
      case "flip_upside_down": {
        b.position.y = 0.9 + Math.sin(t * 1.3) * 0.05;
        b.rotation.z = Math.PI * easeInOut(lp);
        this.armL.rotation.z = -1.0; this.armR.rotation.z = 1.0;
        this.legL.rotation.x = 0.2; this.legR.rotation.x = -0.2;
        break;
      }
      default: b.position.y = breathe;
    }
  }

  dispose(): void {
    this.root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    this.materials.forEach(m => m.dispose());
    this.face.dispose();
  }
}
