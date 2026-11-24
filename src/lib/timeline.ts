import type { Episode, FrameCtx, HudState, Timeline } from "./types";
import { clamp, lerp, parseHudTime } from "./math";

export const LEAD = 0.4, TAIL = 1.6, PAUSE = 0.3;

export const estimateDuration = (text: string): number => Math.max(2.5, [...text].length * 0.155 + 0.5);

/** durations[i] = độ dài file giọng của beat i (giây) nếu có */
export function buildTimeline(ep: Episode, durations: (number | undefined)[], fullTrack?: { duration: number; bounds: number[] }): Timeline {
  const starts: number[] = [], durs: number[] = [];
  if (fullTrack && fullTrack.bounds.length === ep.beats.length + 1) {
    ep.beats.forEach((_, i) => { starts.push(LEAD + fullTrack.bounds[i]); durs.push(Math.max(0.5, fullTrack.bounds[i + 1] - fullTrack.bounds[i])); });
    return { starts, durs, total: LEAD + fullTrack.duration + TAIL };
  }
  let t = LEAD;
  ep.beats.forEach((b, i) => {
    const a = durations[i], d = a !== undefined ? a + PAUSE : estimateDuration(b.ja_narration);
    starts.push(t); durs.push(d); t += d;
  });
  return { starts, durs, total: t + TAIL };
}

const lerpHud = (a: HudState, b: HudState, p: number): HudState => ({
  time: p < 0.5 ? a.time : b.time,
  depthKm: lerp(a.depthKm, b.depthKm, p),
  speedKmh: lerp(a.speedKmh, b.speedKmh, p),
  progress: lerp(a.progress, b.progress, p),
});

export interface Frame { ctx: FrameCtx; fade: number }

export function frameAt(ep: Episode, tl: Timeline, tRaw: number): Frame {
  const t = clamp(tRaw, 0, tl.total), n = ep.beats.length;
  let i = 0;
  while (i < n - 1 && t >= tl.starts[i + 1]) i++;
  const beat = ep.beats[i], lt = Math.max(0, t - tl.starts[i]), dur = tl.durs[i], lp = clamp(lt / dur);
  const hud = lerpHud(beat.hudStart, beat.hudEnd, lp);
  const hudSeconds = lerp(parseHudTime(beat.hudStart.time), parseHudTime(beat.hudEnd.time), lp);
  // màn đen khi mở đầu, kết thúc và khi đổi cảnh
  let fade = 0;
  if (t < LEAD) fade = 1 - t / LEAD;
  const prev = ep.beats[i - 1], next = ep.beats[i + 1];
  if (prev && prev.scene !== beat.scene) fade = Math.max(fade, 1 - lt / 0.35);
  if (next && next.scene !== beat.scene) fade = Math.max(fade, 1 - (dur - lt) / 0.25);
  const end = tl.starts[n - 1] + tl.durs[n - 1];
  if (t > end) fade = Math.max(fade, (t - end) / (tl.total - end));
  return { ctx: { t, beat, index: i, lt, lp, hud, hudSeconds }, fade: clamp(fade) };
}
