import * as THREE from "three";
import type { CharacterAction, CharacterLike } from "../types";
import { easeInOut, easeOut, seg } from "../math";

const mat = (color: string, rough = 0.82): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });

/** Nhân vật chibi: đầu tròn, tóc bát úp, kính tròn, hoodie cam, quai balo xanh navy. Cao ~1.75 đơn vị. */
export class CharacterPrefab implements CharacterLike {
  root = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private helmet = new THREE.Group();
  private materials: THREE.Material[] = [];

  constructor() {
    const C = {
      skin: mat("#f6d2b8", 0.7), hair: mat("#3b2416", 0.75), hoodie: mat("#d96b27"), strap: mat("#1f3a52", 0.7),
      jeans: mat("#233952"), shoe: mat("#ecf0f1", 0.6), sole: mat("#b9c0c4"), black: mat("#151515", 0.4),
      blush: new THREE.MeshStandardMaterial({ color: "#f29a9a", roughness: 0.9, transparent: true, opacity: 0.55 }),
      buckle: mat("#f4f4f4", 0.4),
    };
    this.materials.push(...Object.values(C));
    const add = <T extends THREE.Object3D>(parent: THREE.Object3D, o: T): T => { parent.add(o); o.traverse(m => { if ((m as THREE.Mesh).isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
    const mesh = (geo: THREE.BufferGeometry, m: THREE.Material) => new THREE.Mesh(geo, m);
    this.root.add(this.body);

    // chân
    const leg = (g: THREE.Group, x: number) => {
      g.position.set(x, 0.74, 0); this.body.add(g);
      const thigh = add(g, mesh(new THREE.CapsuleGeometry(0.115, 0.42, 6, 16), C.jeans)); thigh.position.y = -0.3;
      const cuff = add(g, mesh(new THREE.CylinderGeometry(0.125, 0.13, 0.08, 18), C.jeans)); cuff.position.y = -0.58;
      const shoe = add(g, mesh(new THREE.CapsuleGeometry(0.1, 0.16, 6, 14), C.shoe)); shoe.rotation.x = Math.PI / 2; shoe.position.set(0, -0.67, 0.06);
      const sole = add(g, mesh(new THREE.BoxGeometry(0.21, 0.04, 0.38), C.sole)); sole.position.set(0, -0.74, 0.06);
    };
    leg(this.legL, -0.13); leg(this.legR, 0.13);

    // thân + hoodie
    const torso = add(this.body, mesh(new THREE.CapsuleGeometry(0.28, 0.32, 8, 24), C.hoodie)); torso.position.y = 1.03; torso.scale.set(1, 1, 0.8);
    const hem = add(this.body, mesh(new THREE.TorusGeometry(0.255, 0.04, 10, 28), C.hoodie)); hem.rotation.x = Math.PI / 2; hem.position.y = 0.8; hem.scale.set(1, 0.8, 1);
    const hood = add(this.body, mesh(new THREE.TorusGeometry(0.17, 0.065, 12, 28), C.hoodie)); hood.position.set(0, 1.36, -0.07); hood.rotation.x = Math.PI / 2.4;
    // quai balo + dây ngang ngực + khoá trắng
    for (const x of [-0.13, 0.13]) {
      const s = add(this.body, mesh(new THREE.BoxGeometry(0.06, 0.52, 0.03), C.strap)); s.position.set(x, 1.07, 0.225); s.rotation.x = -0.12;
      const top = add(this.body, mesh(new THREE.BoxGeometry(0.06, 0.03, 0.42), C.strap)); top.position.set(x, 1.33, 0.01);
    }
    const chest = add(this.body, mesh(new THREE.BoxGeometry(0.32, 0.035, 0.03), C.strap)); chest.position.set(0, 1.12, 0.24);
    const buckle = add(this.body, mesh(new THREE.BoxGeometry(0.06, 0.045, 0.035), C.buckle)); buckle.position.set(0, 1.12, 0.255);
    const pack = add(this.body, mesh(new THREE.BoxGeometry(0.44, 0.52, 0.2), C.strap)); pack.position.set(0, 1.05, -0.28);
    const packTop = add(this.body, mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.44, 16, 1, false, 0, Math.PI), C.strap)); packTop.rotation.z = Math.PI / 2; packTop.position.set(0, 1.31, -0.28);

    // tay
    const arm = (g: THREE.Group, x: number) => {
      g.position.set(x, 1.27, 0); this.body.add(g);
      const a = add(g, mesh(new THREE.CapsuleGeometry(0.075, 0.38, 6, 14), C.hoodie)); a.position.y = -0.26;
      const hand = add(g, mesh(new THREE.SphereGeometry(0.07, 16, 12), C.skin)); hand.position.y = -0.53;
    };
    arm(this.armL, -0.35); arm(this.armR, 0.35);

    // đầu
    this.head.position.y = 1.42; this.body.add(this.head);
    const face = add(this.head, mesh(new THREE.SphereGeometry(0.31, 40, 28), C.skin)); face.position.y = 0.31;
    const hair = add(this.head, mesh(new THREE.SphereGeometry(0.335, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), C.hair)); hair.position.y = 0.34; hair.rotation.x = -0.15;
    const fringe = add(this.head, mesh(new THREE.TorusGeometry(0.31, 0.045, 10, 40, Math.PI), C.hair)); fringe.position.set(0, 0.42, 0.04); fringe.rotation.x = -0.25; fringe.scale.set(1.04, 0.5, 1);
    const back = add(this.head, mesh(new THREE.SphereGeometry(0.32, 32, 16), C.hair)); back.position.set(0, 0.3, -0.06); back.scale.set(1.02, 0.95, 0.9);
    for (const x of [-0.105, 0.105]) {
      const eye = add(this.head, mesh(new THREE.SphereGeometry(0.03, 12, 10), C.black)); eye.position.set(x, 0.3, 0.28);
      const ring = add(this.head, mesh(new THREE.TorusGeometry(0.075, 0.009, 8, 32), C.black)); ring.position.set(x, 0.3, 0.295);
      const cheek = add(this.head, mesh(new THREE.CircleGeometry(0.045, 20), C.blush)); cheek.position.set(x * 1.55, 0.2, 0.268); cheek.rotation.y = x > 0 ? 0.5 : -0.5;
      const temple = add(this.head, mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), C.black)); temple.rotation.x = Math.PI / 2; temple.position.set(x * 2.55, 0.31, 0.2);
    }
    const bridge = add(this.head, mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.06, 6), C.black)); bridge.rotation.z = Math.PI / 2; bridge.position.set(0, 0.31, 0.3);
    const mouth = add(this.head, mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 16, Math.PI), C.black)); mouth.position.set(0, 0.17, 0.29); mouth.rotation.z = Math.PI;

    // mũ phi hành gia
    const glass = new THREE.MeshPhysicalMaterial({ color: "#dff3ff", roughness: 0.05, metalness: 0, transmission: 0.6, transparent: true, opacity: 0.35, thickness: 0.05 });
    const ringM = mat("#f2f2f2", 0.5); this.materials.push(glass, ringM);
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.46, 40, 28), glass); bubble.position.y = 1.74;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 14, 40), ringM); collar.rotation.x = Math.PI / 2; collar.position.y = 1.36;
    this.helmet.add(bubble, collar); this.helmet.visible = false; this.body.add(this.helmet);
  }

  setSpacesuit(on: boolean): void { this.helmet.visible = on; }

  /** đặt tư thế theo hành động. lt = giây trong beat, lp = 0..1, t = giây tổng */
  setAction(action: CharacterAction, lt: number, lp: number, t: number): void {
    const b = this.body, h = this.head;
    // tư thế gốc
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
        // ngồi xuống → bật lên → rơi xuống hố (y âm)
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
  }
}
