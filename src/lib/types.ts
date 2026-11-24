import type * as THREE from "three";
import type { BeatEnv, BeatImageOverlay, BeatVisual, ExtraCharacterAction } from "./visualTypes";
export type { BeatEnv, BeatImageOverlay, BeatVisual } from "./visualTypes";
import type { BrandOverlayData } from "./introOutro";
import type { ExtraCameraPreset, ExtraSceneId } from "./scenes/extraScenesData";
import type { NewBeatFields, NewCameraPreset, NewSceneId } from "./scenes/newScenesData";

export type SceneId = "japanese_street" | "underground_tunnel" | "earth_globe" | "earth_cutaway" | "ocean_surface" | "stage_studio" | "city_ny"
  | ExtraSceneId | NewSceneId;

export type CameraPreset =
  | "front_medium" | "front_close" | "wide_street" | "hole_topdown" | "side_low"
  | "tunnel_follow" | "tunnel_top" | "core_orbit"
  | "globe_wide" | "globe_close" | "globe_focus"
  | "cut_side" | "cut_front" | "cut_wide" | "cut_follow"
  | "ocean_wide" | "ocean_close" | "ocean_far"
  | "studio_front" | "studio_close"
  | "ny_wide" | "ny_close" | "ny_street"
  | ExtraCameraPreset | NewCameraPreset;

export type CharacterAction =
  | "idle" | "idle_wave" | "look_down" | "jump_in" | "freefall_float" | "flip_upside_down"
  | ExtraCharacterAction;

/** cảm xúc khuôn mặt (chỉ nhân vật 2). Bỏ trống thì app tự đoán từ lời đọc */
export type Emotion = "neutral" | "curious" | "excited" | "shocked" | "sweating";

/** nv1 = nhân vật cũ, nv2 = nhân vật mới (mặc định) */
export type CharacterId = "nv1" | "nv2";

export interface HudState {
  /** "12:00:00" hoặc "2 08:07:19" (số ngày sau khi xuất phát + giờ) */
  time: string;
  depthKm: number;
  speedKmh: number;
  /** 0 = 家, 0.5 = 中心, 1 = 反対側 */
  progress: number;
}

/** điểm trên Trái Đất: "home" (nhà – Tokyo), "antipode" (điểm đối diện) hoặc [vĩ độ, kinh độ] */
export type GeoPoint = "home" | "antipode" | [number, number];

/** tuỳ chọn cảnh earth_globe */
export interface GlobeOptions {
  /** điểm quay về phía camera */
  focus?: GeoPoint;
  /** nếu có: Trái Đất xoay từ điểm này sang focus trong beat */
  focusFrom?: GeoPoint;
  /** mũi tên chiều tự quay trên mặt đất */
  arrows?: boolean;
  /** đường đỏ xuyên tâm từ nhà (mặc định: bật khi không có focus) */
  path?: boolean;
  /** chấm vị trí nhân vật (cam, nhấp nháy) */
  marker?: { at: GeoPoint; color?: string; label?: string };
  /** chấm trắng + đường nét đứt tới điểm đất liền gần nhất */
  nearest?: { at: GeoPoint; label?: string };
  /** nhãn chữ gắn vào điểm bất kỳ */
  labels?: { at: GeoPoint; text: string }[];
}

/** tuỳ chọn cảnh earth_cutaway (Trái Đất bổ đôi) */
export interface CutawayOptions {
  /** lớp minh hoạ: mũi tên tốc độ quay / sóng địa chấn / từ trường */
  overlay?: "none" | "rotation" | "seismic" | "magnetic";
  /** nhãn chữ */
  label?: string;
  /** nhãn gắn ở đâu (mặc định: marker, hoặc sóng nếu overlay = seismic) */
  labelAt?: "marker" | "home" | "center" | "antipode" | "wave";
  /** ẩn chấm vị trí nhân vật */
  hideMarker?: boolean;
}

/** tuỳ chọn cảnh ocean_surface */
export interface OceanOptions {
  time?: "night" | "day";
}

export interface Beat extends NewBeatFields {
  id: string;
  scene: SceneId;
  cameraPreset: CameraPreset;
  characterAction: CharacterAction;
  spacesuit?: boolean;
  /** hiện bệ thang máy dưới chân nhân vật trong đường hầm */
  platform?: boolean;
  vi_note: string;
  ja_narration: string;
  /** chữ lớn giữa màn hình (tuỳ chọn) */
  caption?: string;
  /** cảm xúc nhân vật 2 (tuỳ chọn) */
  emotion?: Emotion;
  /** dòng chữ nhỏ dưới phụ đề (nguồn số liệu, chú thích) */
  note?: string;
  globe?: GlobeOptions;
  cutaway?: CutawayOptions;
  ocean?: OceanOptions;
  /** thời tiết / giờ trong ngày (phố Nhật, sân khấu) */
  env?: BeatEnv;
  /** thẻ biểu đồ 2D (bar_compare, gauge, split_compare, jump_ruler, fact_card) */
  visual?: BeatVisual;
  /** ảnh tải lên cho beat (chỉ sống trong phiên trình duyệt) */
  imageOverlay?: BeatImageOverlay;
  /** thẻ Intro / Outro của kênh (introOutro.ts) – ẩn HUD trong beat này */
  brandOverlay?: BrandOverlayData;
  /** true = ẩn HUD góc trên-trái trong beat này (đồng hồ hành trình) */
  hideHud?: boolean;
  hudStart: HudState;
  hudEnd: HudState;
}

/** tỉ lệ khung hình: "16:9" = YouTube ngang (mặc định), "9:16" = Shorts / Reels / TikTok dọc */
export type AspectRatio = "16:9" | "9:16";

/** đọc tỉ lệ từ JSON (chấp nhận "9:16" hoặc "9/16"); thiếu / sai thì là 16:9 */
export const aspectOf = (ep: { aspect?: string }): AspectRatio =>
  String(ep.aspect ?? "").replace(/\s/g, "").replace("/", ":") === "9:16" ? "9:16" : "16:9";

export interface Episode {
  title: string;
  /** "16:9" (mặc định) hoặc "9:16" cho video dọc */
  aspect?: AspectRatio;
  title_vi?: string;
  thumbnailText?: string;
  beats: Beat[];
  youtube?: { titles: string[]; description: string; tags: string[] };
}

export interface FrameCtx {
  t: number;
  beat: Beat;
  index: number;
  /** giây kể từ đầu beat */
  lt: number;
  /** 0..1 tiến độ trong beat */
  lp: number;
  hud: HudState;
  /** giây (tổng) của đồng hồ HUD, dùng để vẽ */
  hudSeconds: number;
}

export interface SceneLabel { pos: THREE.Vector3; text: string }

export interface ScenePrefab {
  id: SceneId;
  root: THREE.Group;
  /** đặt nhân vật, camera, hiệu ứng cho khung hình */
  update(ctx: FrameCtx, character: CharacterLike, camera: THREE.PerspectiveCamera): void;
  /** nhãn chữ gắn vào điểm 3D (tuỳ chọn) */
  labels?(camera: THREE.PerspectiveCamera): SceneLabel[];
  /** nền & sương mù khi cảnh hoạt động */
  apply(scene: THREE.Scene): void;
  dispose(): void;
}

/** dữ liệu cho khuôn mặt động mỗi khung hình */
export interface FaceInput {
  t: number;
  lt: number;
  lp: number;
  emotion: Emotion;
  /** 0..1 độ lớn giọng đọc thật (AnalyserNode). undefined = không có tiếng → nhép miệng theo nhịp âm tiết */
  voiceLevel?: number;
  /** beat có lời đọc hay không */
  speaking: boolean;
}

export interface CharacterLike {
  root: THREE.Group;
  setAction(action: CharacterAction, lt: number, lp: number, t: number): void;
  setSpacesuit(on: boolean): void;
  /** khuôn mặt động (nhân vật 2). Nhân vật 1 không có */
  setFace?(input: FaceInput): void;
  dispose(): void;
}

export interface Timeline {
  starts: number[];
  durs: number[];
  total: number;
}
