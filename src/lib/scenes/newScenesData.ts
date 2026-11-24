import type { GravityTrainOptions } from "./GravityTrain";
import type { KolaOptions } from "./KolaBorehole";
import type { GravityRoomOptions } from "./GravityRoom";
/* Dữ liệu 3 bối cảnh mới (NewScenes.ts): tên cảnh, góc máy, tuỳ chọn trong beat JSON.
   Tách riêng file này để cameraPresets.ts import được mà không bị vòng lặp import. */

export type NewSceneId = "moon_surface" | "earth_moon_space" | "deep_sea"
  | "tokyo_glass_street" | "tokyo_deep_infra" | "tokyo_strata_onsen"
  | "space_elevator" | "solar_system" | "sky_mountain" | "typhoon_eye"
  | "ocean_world" | "sea_level_city" | "whale_inside" | "space_stairs"
  | "gravity_train" | "kola_borehole" | "gravity_room";

export type NewCameraPreset =
  | "moon_wide" | "moon_close" | "moon_earthrise"
  | "em_wide" | "em_earth" | "em_moon" | "em_follow"
  | "sea_wide" | "sea_close" | "sea_up" | "sea_whale"
  | "glass_wide" | "glass_close" | "glass_under"
  | "infra_wide" | "infra_follow" | "infra_kai"
  | "strata_wide" | "strata_follow" | "strata_top"
  | "elev_wide" | "elev_cabin" | "elev_down" | "elev_ground"
  | "solar_wide" | "solar_earth" | "solar_venus"
  | "mt_wide" | "mt_summit" | "mt_climb"
  | "ty_space" | "ty_wide" | "ty_eye" | "ty_up"
  | "ow_wide" | "ow_pacific" | "ow_close"
  | "flood_wide" | "flood_street" | "flood_tower"
  | "wi_wide" | "wi_heart" | "wi_kai"
  | "st_kai" | "st_wide" | "st_down" | "st_up"
  | "gt_wide" | "gt_tunnel" | "gt_follow"
  | "kola_site" | "kola_cap" | "kola_section" | "kola_deep"
  | "grav_kai" | "grav_scale" | "grav_wide" | "grav_jump";

/** tuỳ chọn trong beat JSON (thêm vào interface Beat) */
export interface NewBeatFields {
  moon?: {
    /** đêm trên Mặt Trăng: Mặt Trời tắt, chỉ còn ánh Trái Đất xanh */
    night?: boolean;
    /** hiện dấu chân phía sau Kai (mặc định: bật) */
    footprints?: boolean;
    /** ẩn Trái Đất trên trời */
    hideEarth?: boolean;
  };
  route?: {
    /** 0..1 vị trí chấm trên đường Trái Đất → Mặt Trăng. Bỏ trống = dùng hudEnd.progress (HUD) */
    progress?: number;
    /** nhãn đi kèm chấm, vd "歩いて 3年目" */
    label?: string;
    /** hiện nhãn 地球 / 月 / 38万km (mặc định: bật) */
    showNames?: boolean;
    /** Mặt Trăng biến mất: mờ dần trong beat này rồi mất hẳn */
    moonGone?: boolean;
    /** độ hiện của Mặt Trăng 0..1 (đặt cố định; 0 = đã biến mất) */
    moonOpacity?: number;
    /** hiện lớp nước thuỷ triều phồng về phía Mặt Trăng (phóng đại cho dễ thấy). Mặt Trăng mất → còn ~1/3 */
    tide?: boolean;
  };
  sea?: {
    /** độ sâu (mét). Bỏ trống = lấy từ HUD depthKm × 1000 */
    depthM?: number;
    /** hiện cá voi xanh bơi ngang (≈25 m, đúng tỉ lệ với Kai 1,7 m) */
    whale?: boolean;
    whaleLabel?: string;
    /** hiện đáy biển ngay dưới chân (mặc định: tự bật khi sâu ≥ 3.000 m) */
    floor?: boolean;
    /** vách đá rãnh Mariana hai bên */
    trench?: boolean;
    /** rút cạn nước: trời sáng, Kai đứng trên đáy biển khô (vịnh Tokyo / biển biến mất) */
    drained?: boolean;
    /** (khi drained) đường hầm 東京湾アクアライン nằm lộ trên đáy vịnh */
    aqualine?: boolean;
    /** (khi drained) xác tàu đắm trên đáy */
    wreck?: boolean;
  };
  /** space_elevator: độ cao cabin (km) chạy từ altKmFrom → altKmTo trong beat */
  elevator?: { altKmFrom?: number; altKmTo?: number; label?: string };
  /** solar_system: khoảng cách Trái Đất – Mặt Trời (AU, 1 = hiện tại), zone = vùng sống được */
  solar?: { earthAU?: number; earthAUFrom?: number; zone?: boolean; label?: string };
  /** sky_mountain: núi, phố Tokyo dưới chân, biển mây, độ cao (m) quyết định màu trời */
  sky?: { mountain?: "fuji" | "everest"; city?: boolean; clouds?: boolean; altitudeM?: number; altitudeFrom?: number; altitudeTo?: number; showNames?: boolean };
  /** typhoon_eye: nhãn chữ */
  typhoon?: { label?: string };
  /** ocean_world: quả địa cầu; water = lượng nước biển còn lại (1 = như bây giờ, 0 = cạn hết, lộ đáy đại dương) */
  world?: { water?: number; waterFrom?: number; waterTo?: number; label?: string; showNames?: boolean };
  /** sea_level_city: mực nước dâng (m) ngập thành phố, chạy levelFrom → levelTo trong beat */
  flood?: { levelM?: number; levelFrom?: number; levelTo?: number; label?: string; showNames?: boolean };
  /** whale_inside: bên trong thân cá voi xanh; heart = tim đập (mặc định bật), bpm = nhịp tim */
  whaleIn?: { heart?: boolean; bpm?: number; label?: string; showNames?: boolean };
  /** space_stairs: cầu thang lên vũ trụ; độ cao (km) chạy altKmFrom → altKmTo; showSteps = hiện số bậc */
  stairs?: { altKm?: number; altKmFrom?: number; altKmTo?: number; label?: string; showSteps?: boolean };
  /** gravity_train: đường hầm thẳng xuyên lòng đất; vị trí tàu = hud.progress (0 điểm đi → 1 điểm đến) */
  gtrain?: GravityTrainOptions;
  /** kola_borehole: giếng khoan Kola; chấm vị trí ở độ sâu hud.depthKm (0 → 12,262) */
  kola?: KolaOptions;
  /** gravity_room: phòng + cân; số kg = weightKg × g (g chạy gFrom → g) */
  grav?: GravityRoomOptions;
}

type V3 = [number, number, number];
interface Shot { from: V3; to: V3; look: V3; fov: number }

/** góc máy tương đối so với điểm neo (giống cameraPresets.ts). Ghép vào SHOTS bằng ...NEW_SHOTS */
export const NEW_SHOTS: Record<NewCameraPreset, Shot> = {
  // Mặt Trăng: neo = chỗ Kai đứng
  moon_wide: { from: [2.2, 2.4, 9.5], to: [1.6, 2.1, 8.2], look: [0, 1.6, -2], fov: 42 },
  moon_close: { from: [0.6, 1.7, 3.0], to: [0.4, 1.65, 2.5], look: [0, 1.45, 0], fov: 36 },
  moon_earthrise: { from: [3.4, 0.5, 3.6], to: [3.0, 0.55, 3.2], look: [-9, 9.5, -33], fov: 50 },
  // Trái Đất – Mặt Trăng: neo tự đổi theo góc máy (giữa đường / Trái Đất / Mặt Trăng / chấm)
  em_wide: { from: [0, 22, 118], to: [0, 20, 108], look: [0, 0, 0], fov: 32 },
  em_earth: { from: [1.2, 1.0, 5.2], to: [0.9, 0.8, 4.4], look: [0, 0, 0], fov: 36 },
  em_moon: { from: [-0.6, 0.4, 2.0], to: [-0.4, 0.3, 1.6], look: [0, 0, 0], fov: 36 },
  em_follow: { from: [-3, 2.5, 9], to: [-2.5, 2.2, 8], look: [0, 0, 0], fov: 40 },
  // Biển sâu: neo = Kai lơ lửng
  sea_wide: { from: [1.5, 1.6, 9.5], to: [1.1, 1.4, 8.3], look: [0, 0.6, 0], fov: 42 },
  sea_close: { from: [0.7, 1.6, 4.8], to: [0.5, 1.55, 4.2], look: [0, 1.25, 0], fov: 38 },
  sea_up: { from: [0.8, -1.6, 3.2], to: [0.6, -1.3, 2.8], look: [0, 3, -1], fov: 48 },
  sea_whale: { from: [6, 2.5, 16], to: [4.5, 2.2, 14], look: [-2, 1, -16], fov: 48 },
  // Tokyo – mặt đường kính (neo = Kai)
  glass_wide: { from: [9, 6, 13], to: [8, 5.5, 11.5], look: [0, -3, 0], fov: 45 },
  glass_close: { from: [0.6, 1.7, 3.2], to: [0.4, 1.6, 2.7], look: [0, 1.3, 0], fov: 38 },
  glass_under: { from: [2.5, -5, 6], to: [2, -4.6, 5], look: [0, -0.5, 0], fov: 50 },
  // Tokyo – lát cắt 0–60 m (neo tự đổi: giữa lát cắt / vạch độ sâu / Kai)
  infra_wide: { from: [0, 4, 92], to: [0, 3, 84], look: [0, 0, 0], fov: 42 },
  infra_follow: { from: [10, 6, 58], to: [8, 5, 50], look: [4, -2, 0], fov: 45 },
  infra_kai: { from: [0.6, 1.7, 4], to: [0.4, 1.6, 3.4], look: [0, 1.2, 0], fov: 38 },
  // Tokyo – lát cắt 0–3.000 m (1 đơn vị = 10 m)
  strata_wide: { from: [0, 0, 470], to: [0, 0, 440], look: [0, 0, 0], fov: 40 },
  strata_follow: { from: [30, 20, 250], to: [25, 16, 220], look: [0, -4, 0], fov: 42 },
  strata_top: { from: [0, 30, 160], to: [0, 25, 140], look: [0, 15, 0], fov: 42 },
  // thang máy vũ trụ (1 đơn vị = 1.000 km)
  elev_wide: { from: [25, 8, 75], to: [22, 8, 68], look: [0, 0, 0], fov: 45 },
  elev_cabin: { from: [0.9, 0.3, 1.4], to: [0.7, 0.25, 1.1], look: [0, 0, 0], fov: 40 },
  elev_down: { from: [0.4, 0.6, 0.5], to: [0.35, 0.5, 0.4], look: [0, -8, 0], fov: 60 },
  elev_ground: { from: [0.35, 0.08, 0.6], to: [0.3, 0.1, 0.5], look: [0, 3, 0], fov: 60 },
  // Hệ Mặt Trời (1 AU = 20 đơn vị)
  solar_wide: { from: [0, 55, 62], to: [0, 50, 56], look: [0, 0, 0], fov: 45 },
  solar_earth: { from: [3, 2, 6], to: [2.5, 1.6, 5], look: [0, 0, 0], fov: 40 },
  solar_venus: { from: [3, 2, 6], to: [2.5, 1.6, 5], look: [0, 0, 0], fov: 40 },
  // núi (1 đơn vị = 10 m)
  mt_wide: { from: [700, 120, 850], to: [620, 110, 760], look: [0, 0, 0], fov: 40 },
  mt_summit: { from: [3, 3, 7], to: [2.5, 2.8, 6], look: [0, 0.6, 0], fov: 42 },
  mt_climb: { from: [300, 80, 500], to: [260, 70, 440], look: [0, 0, 0], fov: 45 },
  // mắt bão
  ty_space: { from: [0, 1300, 200], to: [0, 1150, 180], look: [0, 0, 0], fov: 45 },
  ty_wide: { from: [0, 260, 420], to: [0, 230, 380], look: [0, 20, 0], fov: 50 },
  ty_eye: { from: [3, 2, 7], to: [2.5, 1.9, 6], look: [0, 6, -10], fov: 55 },
  ty_up: { from: [1.5, 0.6, 3], to: [1.2, 0.7, 2.6], look: [0, 40, 0], fov: 70 },
  // quả địa cầu không nước (bán kính 10, mặt hướng về camera là rãnh Mariana)
  ow_wide: { from: [0, 5, 36], to: [0, 4, 32], look: [0, 0, 0], fov: 40 },
  ow_pacific: { from: [3, 4, 21], to: [2.4, 3.2, 18.5], look: [0, 0.5, 8], fov: 40 },
  ow_close: { from: [0.8, 3.2, 18], to: [0.6, 2.8, 16.5], look: [0, 0.5, 9], fov: 40 },
  // thành phố ngập (1 đơn vị = 1 m)
  flood_wide: { from: [420, 240, 620], to: [380, 215, 560], look: [0, 40, -120], fov: 45 },
  flood_street: { from: [4, 2.6, 9], to: [3.4, 2.3, 7.8], look: [0, -1.5, -8], fov: 50 },
  flood_tower: { from: [320, 160, 520], to: [280, 150, 460], look: [0, 240, 0], fov: 45 },
  // bên trong cá voi xanh (1 đơn vị = 1 m)
  wi_wide: { from: [1.1, 1.7, 5], to: [0.9, 1.6, 4.2], look: [0, 1.3, -9], fov: 55 },
  wi_heart: { from: [2.0, 0.5, 5.2], to: [1.7, 0.45, 4.5], look: [0, 0.1, 0], fov: 45 },
  wi_kai: { from: [0.6, 1.6, 3], to: [0.5, 1.55, 2.6], look: [0, 1.25, 0], fov: 38 },
  // cầu thang lên vũ trụ (neo = Kai)
  st_kai: { from: [2.4, 1.5, -1.3], to: [2.1, 1.45, -1.1], look: [0, 1.0, 0], fov: 42 },
  st_wide: { from: [5.5, 3.5, 8.5], to: [4.6, 3, 7.4], look: [-0.7, 0.5, 0], fov: 50 },
  st_down: { from: [0.9, 2.4, 1.0], to: [0.8, 2.2, 0.9], look: [-0.7, -30, 0], fov: 60 },
  // tàu trọng lực (GravityTrain.ts): gt_wide = cả Trái Đất, gt_tunnel = cận đường hầm, gt_follow = bám theo tàu
  gt_wide: { from: [0, 0.2, 10.4], to: [0, 0.2, 9.5], look: [0, 0.2, 0], fov: 38 },
  gt_tunnel: { from: [0, -0.6, 9.2], to: [0, -0.6, 8.6], look: [0, -0.6, 0], fov: 38 },
  gt_follow: { from: [0.35, 0.25, 3.4], to: [0.2, 0.15, 2.6], look: [0, 0, 0], fov: 40 },
  // giếng Kola (KolaBorehole.ts): site = hiện trường + Kai, cap = cận nắp hàn, section = cả cột đá 12 km, deep = bám chấm độ sâu
  kola_site: { from: [3.2, 2.4, 8.5], to: [2.6, 2.0, 7.2], look: [-0.5, 2.2, -2], fov: 42 },
  kola_cap: { from: [3.4, 1.9, 4.4], to: [2.9, 1.6, 3.7], look: [0.6, 0.55, 0.1], fov: 40 },
  kola_section: { from: [0, 0.6, 21], to: [0, 0.3, 19.5], look: [0, 0, 0], fov: 40 },
  // phòng trọng lực (GravityRoom.ts): kai = Kai trên cân, scale = cận mặt cân, wide = cả phòng, jump = cạnh thước đo nhảy
  grav_kai: { from: [1.1, 1.4, 4.2], to: [0.8, 1.2, 3.4], look: [0, 0.95, 0], fov: 40 },
  grav_scale: { from: [0.3, 1.45, 1.75], to: [0.15, 1.2, 1.45], look: [0, 0.12, 0.3], fov: 40 },
  grav_wide: { from: [2.6, 2.4, 6.2], to: [2.2, 2.2, 5.6], look: [-0.4, 1.1, -1], fov: 44 },
  grav_jump: { from: [2.2, 1.3, 3.0], to: [1.9, 1.2, 2.6], look: [-0.4, 1.0, 0], fov: 42 },
  kola_deep: { from: [0.6, 0.6, 6.5], to: [0.3, 0.2, 5.2], look: [0, 0, 0], fov: 40 },
  st_up: { from: [0.9, 0.4, 1.3], to: [0.8, 0.5, 1.1], look: [-0.7, 30, 0], fov: 65 },
};
