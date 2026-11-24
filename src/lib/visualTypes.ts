export type TimeOfDay = 'day' | 'sunset' | 'night' | 'scorching' | 'frozen';
export type WeatherType = 'clear' | 'wind_storm' | 'heavy_rain' | 'snow';

export interface BeatEnv {
  timeOfDay?: TimeOfDay;
  weather?: WeatherType;
  windSpeed?: number;   // 0.0 -> 2.0
  cameraShake?: number; // 0.0 -> 1.0
  showHole?: boolean;   // default true
  /** 6 bối cảnh mới (extraScenes3d.ts) */
  climate?: 'scorching' | 'frozen' | 'twilight';
  showRadiation?: boolean;
  earthStopped?: boolean;
  showAxis?: boolean;
  waveProgress?: number;
  windStrength?: number;
}

export type ExtraCharacterAction =
  | 'heavy_crouch'
  | 'blown_wind'
  | 'jump_low'
  | 'shiver'
  | 'point_explain';

export interface VisualItem {
  label: string;
  value: number;
  unit?: string;
  color?: string;
}

export interface BeatVisual {
  type: 'bar_compare' | 'gauge' | 'split_compare' | 'jump_ruler' | 'fact_card' | 'depth_scale';
  position?: 'right' | 'full';
  title?: string;
  items?: VisualItem[];
  fromValue?: number;
  toValue?: number;
  unit?: string;
  leftTitle?: string;
  leftSub?: string;
  rightTitle?: string;
  rightSub?: string;
  highlightText?: string;
  subText?: string;
}

export type ImageOverlayMode = 'fullscreen_kenburns' | 'pip_right';

export interface BeatImageOverlay {
  src: string; // ObjectURL hoặc DataURL từ nút upload trên Beat Card
  mode?: ImageOverlayMode;
}
