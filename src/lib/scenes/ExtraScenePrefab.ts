import * as THREE from "three";
import type { CharacterLike, FrameCtx, ScenePrefab } from "../types";
import { applyCameraPreset } from "./cameraPresets";
import { createExtraScene, type ExtraEnv, type ExtraScene } from "./extraScenes3d";
import { EXTRA_ANCHORS, type ExtraSceneId } from "./extraScenesData";

/** Bọc 1 bối cảnh của Gemini (extraScenes3d.ts) thành ScenePrefab của app.
    Thêm 1 đèn chiếu mặt Kai (vài cảnh của Gemini chiếu từ phía sau). Màu trời đổi mượt khi update trả về bgColor. */
export class ExtraScenePrefab implements ScenePrefab {
  root = new THREE.Group();
  private s: ExtraScene;
  private anchor: THREE.Vector3;
  private bg: THREE.Color;
  private target = new THREE.Color();
  private lastT = -1;
  /** cột thép chắc chắn để Kai bám khi bão (chỉ ở wind_storm_street) */
  private cling?: THREE.Group;
  private q = new THREE.Quaternion();
  private hand = new THREE.Vector3();
  private static Y = new THREE.Vector3(0, 1, 0);
  private static QZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);

  constructor(public id: ExtraSceneId) {
    this.s = createExtraScene(id);
    this.root.add(this.s.group);
    const a = EXTRA_ANCHORS[id];
    this.anchor = new THREE.Vector3(...a.position);
    this.bg = new THREE.Color(this.s.bgColor);
    const key = new THREE.DirectionalLight(0xfff1dc, id === "space_iss_orbit" ? 0 : 0.9);
    key.position.set(this.anchor.x - 2, 4, this.anchor.z + 6); key.target.position.copy(this.anchor);
    this.root.add(key, key.target);
    if (id === "wind_storm_street") {
      this.cling = new THREE.Group();
      const metal = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.6, roughness: 0.35 });
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.0, 12), metal); post.position.y = 1.5;
      const sign = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), new THREE.MeshStandardMaterial({ color: 0x2b6cd8, roughness: 0.5, side: THREE.DoubleSide }));
      sign.position.set(0, 2.75, 0.1);
      this.cling.add(post, sign); this.cling.position.set(this.anchor.x - 0.8, 0, this.anchor.z); this.cling.visible = false;
      this.root.add(this.cling);
    }
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = this.s.fog; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const a = EXTRA_ANCHORS[this.id];
    character.root.position.copy(this.anchor);
    character.root.rotation.set(0, a.rotationY, 0);
    if (!a.visible) character.root.visible = false;
    applyCameraPreset(camera, ctx.beat.cameraPreset, this.anchor, ctx.lp);
    const env = (ctx.beat.env ?? {}) as ExtraEnv;
    // env.clingPole = false → đứng chống gió như cũ
    const clinging = !!this.cling && ctx.beat.characterAction === "blown_wind" && (env as unknown as { clingPole?: boolean }).clingPole !== false;
    if (this.cling) this.cling.visible = clinging;
    if (clinging && this.cling) {
      // Kai nằm ngang theo gió như lá cờ (đầu phía cột, chân xuôi gió +X).
      // Đặt người sao cho 2 BÀN TAY nằm đúng trên cột: tay giơ lên–ra sau (rotation.x = 2.2) → bàn tay ở
      // toạ độ thân (±0.36, 1.58, -0.43) (vai y 1.27, bàn tay cách vai 0.53 – CharacterPrefab2). Với thân xoay 90° quanh Z,
      // trục x của thân trùng phương thẳng đứng → cả 2 bàn tay cùng nằm trên 1 cột đứng, cột đi sau gáy, không xuyên đầu.
      const t = ctx.t, g = this.cling.position;
      const sw = Math.sin(t * 9) * 0.22 + Math.sin(t * 23) * 0.06;           // người lắc quanh cột
      const gy = 2.0 + Math.sin(t * 17) * 0.03;
      this.q.setFromAxisAngle(ExtraScenePrefab.Y, sw).multiply(ExtraScenePrefab.QZ);
      this.hand.set(0, 1.582, -0.428).applyQuaternion(this.q);
      character.root.quaternion.copy(this.q);
      character.root.position.set(g.x - this.hand.x, gy - this.hand.y, g.z - this.hand.z);
      const rig = character as unknown as Partial<Record<"body" | "head" | "armL" | "armR" | "legL" | "legR", THREE.Object3D>>;
      rig.body?.rotation.set(0, 0, 0);
      rig.head?.rotation.set(0.15, 0.25, 0);
      rig.armL?.rotation.set(2.2, 0, 0);
      rig.armR?.rotation.set(2.2, 0, 0);
      rig.legL?.rotation.set(Math.sin(t * 22) * 0.5, 0, -0.12);
      rig.legR?.rotation.set(Math.sin(t * 22 + 2) * 0.5, 0, 0.12);
    }
    const res = this.s.update({ t: ctx.t, lt: ctx.lt, lp: ctx.lp }, env);
    // màu trời: chuyển mượt (~0,5 giây); tua/nhảy cảnh thì đặt ngay
    const dt = ctx.t - this.lastT; this.lastT = ctx.t;
    this.target.setHex(res && res.bgColor !== undefined ? res.bgColor : this.s.bgColor);
    if (dt <= 0 || dt > 0.5) this.bg.copy(this.target); else this.bg.lerp(this.target, 1 - Math.exp(-dt * 5));
  }

  dispose(): void {
    this.root.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material; if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else if (mat) mat.dispose();
    });
  }
}
