import * as THREE from "three";
import type { CameraPreset } from "../types";
import { easeInOut, lerp } from "../math";
import { EXTRA_SHOTS } from "./extraScenesData";
import { NEW_SHOTS } from "./newScenesData";

interface Shot { from: [number, number, number]; to: [number, number, number]; look: [number, number, number]; fov: number }

/** vị trí camera tương đối so với điểm neo (nhân vật). from → to là chuyển động chậm trong beat */
const SHOTS: Record<CameraPreset, Shot> = {
  front_medium: { from: [0.6, 1.6, 5.4], to: [0.35, 1.55, 4.3], look: [0, 1.25, 0], fov: 38 },
  front_close: { from: [0.45, 1.75, 2.6], to: [0.3, 1.7, 2.2], look: [0, 1.55, 0], fov: 36 },
  wide_street: { from: [-4.5, 3.2, 10], to: [-3.5, 2.8, 8.5], look: [0.5, 1.2, -4], fov: 44 },
  hole_topdown: { from: [0.4, 6.5, 3.6], to: [0.3, 5.2, 2.8], look: [0, 0, 1.2], fov: 42 },
  side_low: { from: [3.6, 0.9, 1.6], to: [3.1, 1.0, 0.9], look: [0, 1.2, 0], fov: 40 },
  tunnel_follow: { from: [0.3, 2.6, 3.4], to: [0.2, 2.3, 2.9], look: [0, 0.9, 0], fov: 50 },
  tunnel_top: { from: [0.01, 6.5, 0.2], to: [0.01, 5.6, 0.15], look: [0, 0, 0], fov: 55 },
  core_orbit: { from: [3.2, 1.6, 2.2], to: [-2.2, 1.9, 3.2], look: [0, 1.2, 0], fov: 46 },
  globe_wide: { from: [0, 0.6, 13], to: [0, 0.9, 11.5], look: [0, 0, 0], fov: 38 },
  globe_close: { from: [1.2, 1.6, 8], to: [0.6, 1.4, 6.6], look: [0, 0.2, 0], fov: 38 },
  globe_focus: { from: [0, 0, 7.6], to: [0, 0, 6.7], look: [0, 0, 0], fov: 38 },
  cut_side: { from: [9.6, 2.4, 6.8], to: [8.6, 2.0, 6.0], look: [0, 0.2, 0], fov: 38 },
  cut_front: { from: [0, 0, 11.6], to: [0, 0, 10.2], look: [0, 0, 0], fov: 38 },
  cut_wide: { from: [0, 0, 21.5], to: [0, 0, 19.5], look: [0, 0, 0], fov: 38 },
  cut_follow: { from: [0.5, 0.3, 4.4], to: [0.25, 0.2, 3.5], look: [0, 0, 0], fov: 40 },
  ocean_wide: { from: [0.4, 2.5, 9.6], to: [0.2, 2.2, 8.2], look: [0, 0.5, 0], fov: 38 },
  ocean_close: { from: [1.0, 1.7, 4.7], to: [0.6, 1.55, 3.9], look: [0, 0.9, 0], fov: 36 },
  ocean_far: { from: [-7, 6, 24], to: [-6, 5, 20], look: [0, 0, 0], fov: 34 },
  studio_front: { from: [0, 1.4, 5.8], to: [0, 1.35, 5.1], look: [0, 1.05, 0], fov: 36 },
  studio_close: { from: [0.15, 1.6, 3.2], to: [0.1, 1.55, 2.7], look: [0, 1.35, 0], fov: 36 },
  // phố New York (CityNY.ts): vị trí của Gemini + đẩy máy nhẹ trong beat
  ny_wide: { from: [0, 2.35, 7.6], to: [0, 2.25, 6.9], look: [0, 1.85, -5], fov: 40 },
  ny_close: { from: [0.35, 1.65, 4.1], to: [0.3, 1.6, 3.6], look: [0, 1.35, 0], fov: 36 },
  ny_street: { from: [-3.1, 2.15, 6.4], to: [-2.8, 2.05, 5.8], look: [0.4, 1.55, -3], fov: 40 },
  // 6 bối cảnh mới (extraScenesData.ts)
  ...EXTRA_SHOTS,
  // 3 bối cảnh mới (newScenesData.ts)
  ...NEW_SHOTS,
};

export function applyCameraPreset(cam: THREE.PerspectiveCamera, preset: CameraPreset, anchor: THREE.Vector3, lp: number): void {
  const s = SHOTS[preset] ?? SHOTS.front_medium, e = easeInOut(lp);
  cam.position.set(anchor.x + lerp(s.from[0], s.to[0], e), anchor.y + lerp(s.from[1], s.to[1], e), anchor.z + lerp(s.from[2], s.to[2], e));
  cam.lookAt(anchor.x + s.look[0], anchor.y + s.look[1], anchor.z + s.look[2]);
  if (cam.fov !== s.fov) { cam.fov = s.fov; cam.updateProjectionMatrix(); }
}

export const CAMERA_PRESETS = Object.keys(SHOTS) as CameraPreset[];
