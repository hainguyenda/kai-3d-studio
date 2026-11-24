import type { Beat, Emotion } from "./types";

/**
 * Cảm xúc của beat: dùng `beat.emotion` nếu kịch bản có ghi,
 * nếu không thì đoán từ lời đọc tiếng Nhật và độ sâu (lòng đất nóng → toát mồ hôi).
 */
export function inferEmotion(beat: Beat, depthKm = 0): Emotion {
  if (beat.emotion) return beat.emotion;
  const t = beat.ja_narration ?? "";
  // nhiệt độ hàng nghìn độ, hoặc đang ở sâu trong lòng đất nóng
  const hot = /([1-9][0-9,]{3,})\s*℃|灼熱|熱い|溶け|ドロドロ|マグマ/.test(t) || (beat.scene === "underground_tunnel" && depthKm >= 30);
  if (/驚|！？|\?!|!\?|まさか|なんと|えっ/.test(t)) return "shocked";
  if (hot) return "sweating";
  if (/速い|最速|すごい|出発|ついに|！/.test(t)) return "excited";
  if (/[？?]|でしょうか|かな|どうなる|なぜ/.test(t)) return "curious";
  return "neutral";
}

export const EMOTIONS: { id: Emotion; vi: string }[] = [
  { id: "neutral", vi: "Bình thường" },
  { id: "curious", vi: "Tò mò" },
  { id: "excited", vi: "Hào hứng" },
  { id: "shocked", vi: "Bất ngờ" },
  { id: "sweating", vi: "Toát mồ hôi" },
];
