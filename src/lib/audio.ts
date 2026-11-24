let shared: AudioContext | null = null;
export const getAudioContext = (): AudioContext => {
  if (!shared) shared = new AudioContext();
  return shared;
};

export async function decodeAudio(data: ArrayBuffer): Promise<AudioBuffer> {
  return await getAudioContext().decodeAudioData(data.slice(0));
}

/** Tìm chỗ ngắt câu trong 1 file đọc cả bài: chia theo số chữ rồi "hút" vào khoảng lặng gần nhất */
export function snapBounds(buf: AudioBuffer, weights: number[]): number[] {
  const data = buf.getChannelData(0), sr = buf.sampleRate, hop = Math.round(sr * 0.02), n = Math.floor(data.length / hop);
  const rms = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < hop; j++) { const v = data[i * hop + j]; s += v * v; } rms[i] = Math.sqrt(s / hop); }
  const sorted = Float32Array.from(rms).sort(), thr = Math.max(sorted[Math.floor(n * 0.95)] * 0.06, 1e-4);
  let a = 0; while (a < n && rms[a] < thr) a++;
  let b = n - 1; while (b > a && rms[b] < thr) b--;
  const t0 = a * 0.02, t1 = (b + 1) * 0.02, tot = weights.reduce((x, y) => x + y, 0);
  const bounds = [t0]; let acc = 0;
  for (let i = 0; i < weights.length - 1; i++) {
    acc += weights[i];
    const guess = t0 + ((t1 - t0) * acc) / tot, lo = Math.max(a, Math.floor((guess - 1.6) / 0.02)), hi = Math.min(b, Math.ceil((guess + 1.6) / 0.02));
    let best: { mid: number; score: number } | null = null, runStart = -1;
    for (let f = lo; f <= hi + 1; f++) {
      const silent = f <= hi && rms[f] < thr;
      if (silent && runStart < 0) runStart = f;
      if (!silent && runStart >= 0) {
        const len = f - runStart, mid = ((runStart + f) / 2) * 0.02, score = len - Math.abs(mid - guess) * 6;
        if (len >= 6 && (!best || score > best.score)) best = { mid, score };
        runStart = -1;
      }
    }
    bounds.push(Math.max(bounds[bounds.length - 1] + 0.5, best ? best.mid : guess));
  }
  bounds.push(t1);
  return bounds;
}

/** tiếng gió/rung nhẹ tự tạo (nhiễu lọc thấp) */
export function createAmbience(ac: BaseAudioContext, out: AudioNode, kind: "wind" | "rumble", gain: number): { source: AudioBufferSourceNode; gain: GainNode } {
  const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
  const filter = ac.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = kind === "wind" ? 900 : 160;
  const g = ac.createGain(); g.gain.value = gain;
  src.connect(filter); filter.connect(g); g.connect(out);
  return { source: src, gain: g };
}
