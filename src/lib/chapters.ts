import type { Episode, Timeline } from "./types";

/** 75 → "1:15", 3725 → "1:02:05" */
export function fmtTime(sec: number, long = false): string {
  const s = Math.max(0, Math.floor(sec)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const ss = String(r).padStart(2, "0");
  return h || long ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/*
  Mục lục (目次) cho mô tả YouTube, lấy từ các beat có "chapter".
  Luật của YouTube: mốc đầu phải là 0:00, ít nhất 3 mốc, mỗi chương dài ít nhất 10 giây.
  Trả về "" nếu không đủ điều kiện.
*/
export function buildChapters(ep: Episode, tl: Timeline): string {
  const marks: { t: number; name: string }[] = [];
  ep.beats.forEach((b, i) => {
    const name = b.chapter?.trim();
    if (!name) return;
    const t = marks.length ? tl.starts[i] ?? 0 : 0;
    if (marks.length && t - marks[marks.length - 1].t < 10) return;
    if (tl.total - t < 10) return;
    marks.push({ t, name });
  });
  if (marks.length < 3) return "";
  const long = tl.total >= 3600;
  return marks.map(m => `${fmtTime(m.t, long)} ${m.name}`).join("\n");
}
