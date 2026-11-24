import * as THREE from "three";
import type { CharacterLike, FrameCtx, ScenePrefab } from "../types";
import { createStageStudioScene } from "./StageStudio";
import { applyCameraPreset } from "./cameraPresets";

const ANCHOR = new THREE.Vector3(0, 0, 0);

/** Sân khấu tối để nhân vật đứng giải thích cạnh thẻ biểu đồ (dùng sàn của Gemini – StageStudio.ts) */
export class StageStudioPrefab implements ScenePrefab {
  id = "stage_studio" as const;
  root = new THREE.Group();
  private studio = createStageStudioScene();
  private bg: THREE.CanvasTexture;
  private fog = new THREE.Fog(0x0d1322, 9, 17);
  private extra: THREE.Light[] = [];
  /** vòng sáng dưới chân (dời theo Kai) */
  private rings: THREE.Object3D[] = [];
  /** gậy chỉ: nằm trong root của sân khấu (ẩn khi đổi cảnh), mỗi khung hình đặt theo cánh tay phải của Kai */
  private pointer = new THREE.Group();
  private tmpS = new THREE.Vector3();

  constructor() {
    this.root.add(this.studio.group);
    // vòng sáng cam: đặt ngay dưới chân nhân vật (Gemini để lệch x = -1.35)
    this.studio.group.children.forEach(c => { if ((c as THREE.Mesh).geometry instanceof THREE.RingGeometry) { c.position.x = 0; this.rings.push(c); } });

    // PointLight của Gemini quá yếu với đơn vị ánh sáng vật lý của three r155+ → thêm đèn nền + đèn chính
    const hemi = new THREE.HemisphereLight(0xcfdcff, 0x1a2133, 1.15);
    const key = new THREE.DirectionalLight(0xfff1dc, 2.1);
    key.position.set(-2.5, 4.5, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
    key.shadow.camera.updateProjectionMatrix(); key.shadow.bias = -0.0005; key.shadow.radius = 5;
    const rim = new THREE.DirectionalLight(0x7fb8ff, 1.3); rim.position.set(-3, 3.5, -4);
    this.extra.push(hemi, key, rim);
    this.root.add(hemi, key, key.target, rim);

    // nền xanh đêm có quầng sáng phía sau nhân vật
    const c = document.createElement("canvas"); c.width = 1024; c.height = 576;
    const g = c.getContext("2d")!;
    g.fillStyle = "#0d1322"; g.fillRect(0, 0, 1024, 576);
    const r = g.createRadialGradient(400, 230, 20, 400, 230, 640);
    r.addColorStop(0, "#2c3b5a"); r.addColorStop(0.45, "#18223a"); r.addColorStop(1, "#0d1322");
    g.fillStyle = r; g.fillRect(0, 0, 1024, 576);
    this.bg = new THREE.CanvasTexture(c); this.bg.colorSpace = THREE.SRGBColorSpace;

    // gậy chỉ (toạ độ theo cánh tay: bàn tay ở y = -0.53, gậy chạy tiếp dọc theo tay)
    const wood = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.55 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x23272f, roughness: 0.7 });
    const tipM = new THREE.MeshStandardMaterial({ color: 0xff4d3d, emissive: 0xff2a1a, emissiveIntensity: 0.6, roughness: 0.4 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.85, 12), wood); rod.position.y = -0.53 - 0.425;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.16, 12), grip); handle.position.y = -0.55;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), tipM); tip.position.y = -1.39;
    this.pointer.add(rod, handle, tip); this.pointer.visible = false;
    this.root.add(this.pointer);
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = this.fog; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    const b = ctx.beat;
    // có thẻ giải thích bên phải + động tác point_explain → Kai lùi sang trái, cầm gậy chỉ vào thẻ
    const card = (b.visual && b.visual.position !== "full") || !!b.brandOverlay;
    const arm = (character as unknown as { armR?: THREE.Object3D }).armR;
    const pointing = card && b.characterAction === "point_explain" && !!arm;
    const dx = pointing ? -0.75 : 0; // đầu gậy vừa chạm mép trái thẻ
    character.root.position.set(ANCHOR.x + dx, ANCHOR.y, ANCHOR.z);
    character.root.rotation.set(0, 0, 0);
    this.rings.forEach(r => (r.position.x = dx));
    applyCameraPreset(camera, b.cameraPreset, ANCHOR, ctx.lp);
    this.pointer.visible = pointing;
    if (pointing && arm) {
      // tay phải đưa ngang sang phải, hơi chếch lên về phía giữa thẻ; khẽ nhịp gậy theo lời nói
      arm.rotation.set(-0.15, 0, 1.78 + Math.sin(ctx.t * 3) * 0.04);
      character.root.updateMatrixWorld(true);
      arm.matrixWorld.decompose(this.pointer.position, this.pointer.quaternion, this.tmpS);
    }
  }

  dispose(): void {
    this.pointer.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    this.studio.dispose(); this.bg.dispose(); this.extra.forEach(l => l.dispose()); }
}
