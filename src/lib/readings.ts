/*
  Từ điển cách đọc (読み) cho giọng đọc: phụ đề vẫn giữ chữ Hán,
  nhưng chữ gửi đi tạo giọng được thay bằng cách đọc đúng.
  Ví dụ "地殻=ちかく", "360万気圧=さんびゃくろくじゅうまんきあつ".
  Dùng được cho mọi giọng (VOICEVOX, AivisSpeech, Edge, ElevenLabs).
*/
export type Readings = Record<string, string>;

/** mỗi dòng "chữ=cách đọc" (chấp nhận cả dấu ＝ hoặc →) */
export function parseReadings(text: string): Readings {
  const out: Readings = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(.+?)\s*(?:=|＝|→)\s*(.+?)\s*$/);
    if (m && m[1] && m[2] && m[1] !== m[2]) out[m[1]] = m[2];
  }
  return out;
}

export const formatReadings = (r?: Readings) => Object.entries(r ?? {}).map(([k, v]) => `${k}=${v}`).join("\n");

/** thay chữ theo từ điển, từ dài trước để "地球の中心" thắng "地球" */
export function applyReadings(text: string, r?: Readings): string {
  const keys = Object.keys(r ?? {}).sort((a, b) => b.length - a.length);
  if (!keys.length) return text;
  let out = text;
  for (const k of keys) out = out.split(k).join(r![k]);
  return out;
}
