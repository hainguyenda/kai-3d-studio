import * as THREE from "three";
import type { CharacterLike, FrameCtx, ScenePrefab } from "../types";
import { createCityNYScene } from "./CityNY";
import { applyCameraPreset } from "./cameraPresets";
import { createSkyTexture } from "../textures";

const ANCHOR = new THREE.Vector3(0, 0, 0);

/** Phố New York ban đêm (dựng từ CityNY.ts của Gemini). Ánh sáng do bộ thời tiết điều khiển, mặc định "night". */
export class CityNYPrefab implements ScenePrefab {
  id = "city_ny" as const;
  root = new THREE.Group();
  sun = new THREE.DirectionalLight(0x8fb8ff, 0.6);
  hemi = new THREE.HemisphereLight(0x9fb8ff, 0x1a1d2b, 0.9);
  holeObjects: THREE.Object3D[];
  windowMaterials: THREE.MeshStandardMaterial[];
  private ny = createCityNYScene();
  /** đèn chiếu mặt nhân vật – PointLight của Gemini quá yếu với đơn vị ánh sáng của three r155+ */
  private key = new THREE.DirectionalLight(0xffe2b0, 1.5);
  private bg = createSkyTexture("#050a17", "#1c2c4c");
  private fog = new THREE.Fog(0x0d1629, 30, 95);
  private lastT = 0;

  constructor() {
    this.root.add(this.ny.group);
    this.holeObjects = this.ny.holeObjects;
    this.windowMaterials = this.ny.windowMaterials;
    this.sun.position.set(10, 18, -12);
    this.key.position.set(-3, 5, 7); this.key.castShadow = true; this.key.shadow.mapSize.set(1024, 1024);
    Object.assign(this.key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
    this.key.shadow.camera.updateProjectionMatrix(); this.key.shadow.bias = -0.0005;
    this.root.add(this.sun, this.sun.target, this.hemi, this.key, this.key.target);
  }

  apply(scene: THREE.Scene): void { scene.background = this.bg; scene.fog = this.fog; }

  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void {
    character.root.position.copy(ANCHOR);
    character.root.rotation.set(0, 0, 0);
    applyCameraPreset(camera, ctx.beat.cameraPreset, ANCHOR, ctx.lp);
    const dt = Math.min(0.1, Math.max(0, ctx.t - this.lastT)); this.lastT = ctx.t;
    this.ny.update(dt, ctx.t);
    this.ny.setLocalTime(ctx.hudSeconds);
  }

  dispose(): void { this.ny.dispose(); this.bg.dispose(); }
}
