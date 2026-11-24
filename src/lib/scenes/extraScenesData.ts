/* Dữ liệu 6 bối cảnh mới (Gemini – extra_scenes_3d.js): tên cảnh, chỗ đứng của Kai, góc camera.
   Camera của Gemini là toạ độ tuyệt đối {pos, target}; ở đây đổi sang dạng của app
   (from/to/look tương đối so với chỗ đứng của Kai, đẩy máy nhẹ 6% về phía target trong beat). */

export type ExtraSceneId =
  | "wind_storm_street" | "mega_tsunami_coast" | "arctic_pole"
  | "space_iss_orbit" | "extreme_climate_zone" | "science_museum_pendulum";

export type ExtraCameraPreset =
  | "storm_wide" | "storm_close" | "storm_low"
  | "tsunami_wide" | "tsunami_close" | "tsunami_high"
  | "pole_wide" | "pole_close" | "pole_axis"
  | "orbit_wide" | "orbit_iss" | "orbit_sat"
  | "climate_wide" | "climate_close" | "climate_horizon"
  | "pendulum_wide" | "pendulum_top" | "pendulum_close";

type V3 = [number, number, number];

export const EXTRA_ANCHORS: Record<ExtraSceneId, { position: V3; rotationY: number; visible: boolean }> = {
  wind_storm_street: { position: [-1.4, 0, 1.5], rotationY: 0.25, visible: true },
  mega_tsunami_coast: { position: [-2.4, 0, 4.6], rotationY: 0.35, visible: true }, // z 3.2 → 4.6: đứng trước dãy nhà ven biển, không kẹt vào nhà
  arctic_pole: { position: [-1.8, 0, 1.6], rotationY: 0.22, visible: true },
  space_iss_orbit: { position: [-3.2, 0.6, 2.2], rotationY: 0.4, visible: false },
  extreme_climate_zone: { position: [-1.6, 0, 1.4], rotationY: 0.2, visible: true },
  science_museum_pendulum: { position: [-3.0, 0, 2.2], rotationY: 0.45, visible: true },
};

const RAW: Record<ExtraCameraPreset, { scene: ExtraSceneId; pos: V3; target: V3; fov: number }> = {
  storm_wide: { scene: "wind_storm_street", pos: [0.5, 3.2, 11.5], target: [0.0, 1.8, 0.0], fov: 46 },
  storm_close: { scene: "wind_storm_street", pos: [-1.4, 2.0, 5.2], target: [0.0, 1.5, 0.0], fov: 42 },
  storm_low: { scene: "wind_storm_street", pos: [-3.2, 1.1, 6.4], target: [1.2, 2.2, 0.0], fov: 50 },
  tsunami_wide: { scene: "mega_tsunami_coast", pos: [0.0, 4.8, 16.5], target: [0.0, 4.2, -6.0], fov: 48 },
  tsunami_close: { scene: "mega_tsunami_coast", pos: [-2.2, 2.4, 8.8], target: [0.5, 3.5, -5.0], fov: 45 },
  tsunami_high: { scene: "mega_tsunami_coast", pos: [7.5, 9.5, 15.0], target: [0.0, 3.0, -5.0], fov: 44 },
  pole_wide: { scene: "arctic_pole", pos: [0.0, 3.6, 12.0], target: [0.0, 2.2, 0.0], fov: 45 },
  pole_close: { scene: "arctic_pole", pos: [-1.8, 2.0, 5.8], target: [0.0, 1.6, 0.0], fov: 40 },
  pole_axis: { scene: "arctic_pole", pos: [4.5, 5.2, 11.5], target: [0.0, 3.4, 0.0], fov: 46 },
  orbit_wide: { scene: "space_iss_orbit", pos: [0.0, 2.8, 14.0], target: [0.0, 0.4, 0.0], fov: 44 },
  orbit_iss: { scene: "space_iss_orbit", pos: [3.2, 1.8, 7.6], target: [0.0, 1.1, 0.0], fov: 40 },
  orbit_sat: { scene: "space_iss_orbit", pos: [-3.5, 2.2, 8.5], target: [0.6, 1.0, 0.0], fov: 42 },
  climate_wide: { scene: "extreme_climate_zone", pos: [0.0, 3.0, 11.5], target: [0.0, 1.8, -2.0], fov: 46 },
  climate_close: { scene: "extreme_climate_zone", pos: [-1.6, 2.0, 5.4], target: [0.0, 1.5, 0.0], fov: 40 },
  climate_horizon: { scene: "extreme_climate_zone", pos: [0.0, 2.2, 10.0], target: [0.0, 1.6, -18.0], fov: 48 },
  pendulum_wide: { scene: "science_museum_pendulum", pos: [0.0, 4.4, 11.5], target: [0.0, 2.4, 0.0], fov: 44 },
  pendulum_top: { scene: "science_museum_pendulum", pos: [0.0, 10.5, 4.2], target: [0.0, 0.4, 0.0], fov: 42 },
  pendulum_close: { scene: "science_museum_pendulum", pos: [2.8, 2.2, 5.8], target: [0.0, 1.3, 0.0], fov: 40 },
};

export const EXTRA_SHOTS = Object.fromEntries(
  (Object.keys(RAW) as ExtraCameraPreset[]).map(k => {
    const r = RAW[k], a = EXTRA_ANCHORS[r.scene].position;
    const from: V3 = [r.pos[0] - a[0], r.pos[1] - a[1], r.pos[2] - a[2]];
    const to: V3 = [0, 1, 2].map(i => from[i] + (r.target[i] - r.pos[i]) * 0.06) as V3;
    const look: V3 = [r.target[0] - a[0], r.target[1] - a[1], r.target[2] - a[2]];
    return [k, { from, to, look, fov: r.fov }];
  }),
) as Record<ExtraCameraPreset, { from: V3; to: V3; look: V3; fov: number }>;
