"use client";
import { useEffect, useRef } from "react";
import type { AspectRatio, Episode } from "@/lib/types";
import { fmtTime } from "@/lib/chapters";

interface Props {
  episode: Episode;
  ready: boolean;
  exporting: boolean;
  progress: number;
  resolution: number;
  aspect: AspectRatio;
  onAspect(a: AspectRatio): void;
  fps: 30 | 60;
  sfx: boolean;
  thumbBeat: number;
  onResolution(v: number): void;
  onFps(v: 30 | 60): void;
  onSfx(v: boolean): void;
  onThumbBeat(v: number): void;
  onExport(): void;
  onCancel(): void;
  onThumbnail(): void;
  videoUrl: string | null;
  videoName: string;
  thumbUrl: string | null;
  status: string;
  missingAudio: number;
  /** tổng thời lượng (giây) */
  total: number;
  /** mục lục 目次 dựng từ beat có "chapter" ("" nếu chưa đủ 3 mốc) */
  chapters: string;
  /** credit giọng đọc bắt buộc, ví dụ "VOICEVOX:青山龍星" */
  credit: string;
}

export default function ExportPanel(p: Props) {
  const y = p.episode.youtube;
  const copy = (t: string) => { navigator.clipboard?.writeText(t).catch(() => undefined); };
  // mô tả = mô tả gốc + mục lục (目次) + credit giọng đọc
  const description = [y?.description ?? "", p.chapters && `▼ もくじ\n${p.chapters}`, p.credit && `▼ 音声\n${p.credit}`].filter(Boolean).join("\n\n").trim();
  const items: [string, string][] = y
    ? [["Tiêu đề", y.titles.join("\n")], ["Mô tả", description], ["Tags", y.tags.join(", ")]]
    : description ? [["Mô tả (mục lục + credit)", description]] : [];
  const hasChapterField = p.episode.beats.some(b => b.chapter?.trim());
  const lengthNote = p.aspect === "9:16"
    ? (p.total > 180 ? { ok: false, text: "dài hơn 3 phút – YouTube không nhận là Short" } : { ok: true, text: "hợp lệ cho Shorts (≤ 3 phút)" })
    : (p.total >= 480 ? { ok: true, text: "đủ 8:00 – khi đăng nhớ bật quảng cáo giữa video" } : { ok: true, text: `dưới 8:00 nên không chèn được quảng cáo giữa video (không bắt buộc – kể hay quan trọng hơn dài)` });
  // tên tab hiện % khi đang xuất; xuất xong thì tự tải file về
  const lastUrl = useRef<string | null>(null);
  useEffect(() => {
    if (p.exporting) document.title = `⏳ ${Math.round(p.progress * 100)}% – Kai 3D Studio`;
    else if (p.videoUrl) document.title = "✅ Video xong – Kai 3D Studio";
  }, [p.exporting, p.progress, p.videoUrl]);
  useEffect(() => {
    if (!p.videoUrl || p.videoUrl === lastUrl.current) return;
    lastUrl.current = p.videoUrl;
    const a = document.createElement("a"); a.href = p.videoUrl; a.download = p.videoName; a.click();
  }, [p.videoUrl, p.videoName]);
  const dims = (long: number) => { const short = Math.round((long * 9) / 16); return p.aspect === "9:16" ? `${short}x${long}` : `${long}x${short}`; };
  const status = p.status.replace(/\s*[–-]?\s*giữ tab này mở\.?/, " – có thể chuyển sang tab khác, đừng đóng tab này.");
  return (
    <section className="panel">
      <h2 className="panel-title">4. Xuất video MP4</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label><span className="label">Tỉ lệ</span>
          <select className="input" value={p.aspect} disabled={p.exporting} onChange={e => p.onAspect(e.target.value === "9:16" ? "9:16" : "16:9")}>
            <option value="16:9">16:9 ngang – YouTube</option><option value="9:16">9:16 dọc – Shorts / Reels / TikTok</option></select></label>
        <label><span className="label">Độ phân giải</span>
          <select className="input" value={p.resolution} disabled={p.exporting} onChange={e => p.onResolution(Number(e.target.value))}>
            <option value={1920}>1080p ({dims(1920)})</option><option value={1280}>720p ({dims(1280)}, máy yếu)</option></select></label>
        <label><span className="label">Khung hình</span>
          <select className="input" value={p.fps} disabled={p.exporting} onChange={e => p.onFps(Number(e.target.value) === 60 ? 60 : 30)}>
            <option value={30}>30 fps</option><option value={60}>60 fps</option></select></label>
        <label className="flex items-end gap-1 pb-2 text-sm"><input type="checkbox" checked={p.sfx} onChange={e => p.onSfx(e.target.checked)} /> Tiếng gió / rung nền</label>
      </div>
      {p.aspect === "9:16" && <p className="mt-2 text-xs text-studio-muted">Khung dọc: HUD thu nhỏ góc trên, thẻ biểu đồ lên nửa trên, phụ đề nằm trên vùng tên kênh / mô tả của Shorts. Shorts tối đa 3 phút, Reels / TikTok tuỳ nền tảng.</p>}
      <p className={`mt-2 text-xs ${lengthNote.ok ? "text-studio-muted" : "text-yellow-300"}`}>⏱ Độ dài {fmtTime(p.total)} – {lengthNote.text}{p.missingAudio > 0 ? " (ước tính, còn beat chưa có giọng)" : ""}</p>
      {p.missingAudio > 0 && <p className="mt-2 text-xs text-yellow-300">⚠ Còn {p.missingAudio} beat chưa có giọng – các đoạn đó sẽ im lặng.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {p.exporting ? <button className="btn" onClick={p.onCancel}>■ Huỷ xuất</button> : <button className="btn" disabled={!p.ready} onClick={p.onExport}>⏺ Xuất video MP4</button>}
        <select className="input w-auto" value={p.thumbBeat} onChange={e => p.onThumbBeat(Number(e.target.value))}>
          {p.episode.beats.map((b, i) => <option key={b.id + i} value={i}>Thumbnail từ beat {i + 1}</option>)}
        </select>
        <button className="btn-ghost" disabled={!p.ready || p.exporting} onClick={p.onThumbnail}>🖼 Tải Thumbnail {p.aspect === "9:16" ? "dọc 1080x1920" : "1080p"}</button>
      </div>
      {p.exporting && <div className="mt-3 h-2 overflow-hidden rounded bg-studio-line"><div className="h-full bg-studio-accent" style={{ width: `${Math.round(p.progress * 100)}%` }} /></div>}
      {status && <p className="mt-2 text-xs text-studio-muted">{status}</p>}
      <div className="mt-2 flex flex-wrap gap-4 text-sm font-bold">
        {p.videoUrl && <a className="text-studio-accent underline" href={p.videoUrl} download={p.videoName}>⬇ Tải video ({p.videoName})</a>}
        {p.thumbUrl && <a className="text-studio-accent underline" href={p.thumbUrl} download={p.aspect === "9:16" ? "thumbnail-9x16.png" : "thumbnail-1080p.png"}>⬇ Tải thumbnail</a>}
      </div>
      <p className="mt-2 text-xs text-studio-muted">Bấm xuất xong có thể chuyển sang tab khác – app tự dựng từng khung hình, xong sẽ tự tải file MP4 về (tên tab hiện % tiến độ). Đừng đóng tab hoặc tắt máy. Cần Chrome/Edge bản mới.</p>
      {items.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-studio-line pt-3">
          <h3 className="text-sm font-bold">Thông tin đăng YouTube</h3>
          {p.aspect === "16:9" && !p.chapters && (
            <p className="text-xs text-studio-muted">{hasChapterField ? "Mục lục cần ít nhất 3 chương, mỗi chương ≥ 10 giây." : "Gợi ý: ghi \"Chương\" ở vài beat (thẻ kịch bản) để app tự tạo mục lục もくじ có mốc thời gian."}</p>
          )}
          {items.map(([k, v]) => (
            <div key={k}>
              <div className="flex items-center justify-between"><span className="text-xs text-studio-muted">{k}</span><button className="btn-ghost px-2 py-0.5 text-xs" onClick={() => copy(v)}>Copy</button></div>
              <pre className="ja mt-1 whitespace-pre-wrap rounded-lg border border-studio-line bg-[#0b0d12] p-2 text-xs">{v}</pre>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
