export const clamp = (x: number, a = 0, b = 1): number => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;
export const easeInOut = (p: number): number => {
  const x = clamp(p);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOut = (p: number): number => 1 - Math.pow(1 - clamp(p), 3);
export const seg = (x: number, a: number, b: number): number => clamp((x - a) / (b - a));

/** bộ sinh số ngẫu nhiên có seed – kết quả lặp lại được */
export const rng = (seed = 1): (() => number) => {
  let s = seed >>> 0 || 1;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
};

/** "12:00:00" | "2 08:07:19" → giây */
export const parseHudTime = (s: string): number => {
  const m = String(s).trim().match(/^(?:(\d+)\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return 0;
  return (Number(m[1] || 0) * 24 + Number(m[2])) * 3600 + Number(m[3]) * 60 + Number(m[4] || 0);
};

/** giây → "12:00:00" hoặc "3日後 08:07" */
export const formatHudTime = (sec: number, startDayOffset = 0): string => {
  const total = Math.max(0, Math.floor(sec));
  const day = Math.floor(total / 86400) - startDayOffset;
  const h = Math.floor((total % 86400) / 3600), mi = Math.floor((total % 3600) / 60), se = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return day > 0 ? `${day}日後 ${p(h)}:${p(mi)}:${p(se)}` : `${p(h)}:${p(mi)}:${p(se)}`;
};

export const formatDepth = (km: number): string => {
  if (km < 1) return `${Math.round(km * 1000).toLocaleString("ja-JP")} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString("ja-JP")} km`;
};

export const formatSpeed = (kmh: number): string => `時速 ${Math.round(kmh).toLocaleString("ja-JP")} km`;
