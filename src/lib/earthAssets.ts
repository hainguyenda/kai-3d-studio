import * as THREE from "three";
import type { GeoPoint } from "./types";

/** nhà (Tokyo) */
export const HOME_LATLON = { lat: 35.7, lon: 139.7 };

/** "home" | "antipode" | [lat, lon] → [lat, lon] */
export function resolveGeo(p: GeoPoint | undefined): [number, number] {
  if (Array.isArray(p) && p.length === 2) return [Number(p[0]), Number(p[1])];
  if (p === "antipode") { let lon = HOME_LATLON.lon - 180; if (lon < -180) lon += 360; return [-HOME_LATLON.lat, lon]; }
  return [HOME_LATLON.lat, HOME_LATLON.lon];
}

const BASE = "/tex/";

/** Ảnh bản đồ Trái Đất thật (NASA, phân phối kèm three.js). Tải 1 lần, dùng chung cho mọi cảnh. */
class EarthAssets {
  day: THREE.Texture | null = null;
  normal: THREE.Texture | null = null;
  clouds: THREE.Texture | null = null;
  loaded = false;
  ready: Promise<void>;
  private listeners: (() => void)[] = [];

  constructor() {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const load = (file: string, srgb: boolean) => new Promise<THREE.Texture | null>(res => {
      loader.load(BASE + file, t => {
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8; t.needsUpdate = true; res(t);
      }, undefined, () => res(null));
    });
    const all = (async () => {
      const [day, normal, clouds] = await Promise.all([
        load("earth_day_4096.jpg", true).then(t => t ?? load("earth_atmos_2048.jpg", true)),
        load("earth_normal_2048.jpg", false),
        load("earth_clouds_1024.png", true),
      ]);
      this.day = day; this.normal = normal; this.clouds = clouds;
    })();
    // không bao giờ treo app: tối đa 20 giây
    this.ready = Promise.race([all, new Promise<void>(r => setTimeout(r, 20000))]).then(() => {
      this.loaded = true;
      this.listeners.forEach(f => f()); this.listeners = [];
    });
  }

  /** gọi f khi ảnh đã tải xong (hoặc hết thời gian chờ) */
  onLoad(f: () => void): void { if (this.loaded) f(); else this.listeners.push(f); }
}

let inst: EarthAssets | null = null;
export const earthAssets = (): EarthAssets => (inst ??= new EarthAssets());
