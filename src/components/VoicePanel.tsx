"use client";
import type { VoiceSettings } from "./studioTypes";

interface Props {
  voice: VoiceSettings;
  onVoice(v: VoiceSettings): void;
  progress: { done: number; total: number; label: string } | null;
  message: { text: string; kind: "ok" | "err" | "info" } | null;
  onGenerateAll(): void;
  onUpload(files: FileList): void;
  onClear(): void;
  onBgm(file?: File): void;
  bgmVolume: number;
  onBgmVolume(v: number): void;
  hasFullTrack: boolean;
}

export default function VoicePanel({ voice, onVoice, progress, message, onGenerateAll, onUpload, onClear, onBgm, bgmVolume, onBgmVolume, hasFullTrack }: Props) {
  const set = (p: Partial<VoiceSettings>) => onVoice({ ...voice, ...p });
  const tab = (m: VoiceSettings["mode"], label: string) => (
    <button className={voice.mode === m ? "btn" : "btn-ghost"} onClick={() => set({ mode: m })}>{label}</button>
  );
  return (
    <section className="panel">
      <h2 className="panel-title">3. Giọng đọc tiếng Nhật (tự động)</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {tab("edge", "Edge miễn phí")}{tab("eleven", "ElevenLabs")}{tab("upload", "Tải file lên")}
      </div>

      {voice.mode === "edge" && (
        <div className="space-y-3">
          <label className="block"><span className="label">Giọng</span>
            <select className="input" value={voice.edgeVoice} onChange={e => set({ edgeVoice: e.target.value as VoiceSettings["edgeVoice"] })}>
              <option value="ja-JP-KeitaNeural">Keita – Nam Nhật</option>
              <option value="ja-JP-NanamiNeural">Nanami – Nữ Nhật</option>
            </select></label>
          <p className="rounded-lg border border-yellow-700/60 bg-yellow-900/20 p-2 text-xs text-yellow-200">
            ⚠ Giọng Edge là dịch vụ đọc của trình duyệt Microsoft Edge, không có giấy phép dùng cho video kiếm tiền và có thể ngừng hoạt động bất cứ lúc nào. Nên dùng ElevenLabs cho video đăng kênh.
          </p>
        </div>
      )}

      {voice.mode === "eleven" && (
        <div className="space-y-3">
          <label className="block"><span className="label">API key ElevenLabs (chỉ lưu trong trình duyệt của bạn)</span>
            <input className="input" type="password" value={voice.elevenKey} placeholder="sk_..." onChange={e => set({ elevenKey: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="label">Voice ID</span><input className="input" value={voice.elevenVoice} onChange={e => set({ elevenVoice: e.target.value })} /></label>
            <label><span className="label">Model</span>
              <select className="input" value={voice.elevenModel} onChange={e => set({ elevenModel: e.target.value })}>
                <option value="eleven_multilingual_v2">Multilingual v2</option>
                <option value="eleven_v3">Eleven v3</option>
                <option value="eleven_turbo_v2_5">Turbo v2.5 (rẻ, nhanh)</option>
              </select></label>
          </div>
          <p className="text-xs text-studio-muted">Mặc định: Subaru – Calm &amp; Deep Narration. Tạo giọng sẽ trừ credit ElevenLabs của bạn.</p>
        </div>
      )}

      {voice.mode === "upload" && (
        <div className="space-y-2 text-sm">
          <label className="block"><span className="label">Chọn nhiều file (01, 02… theo thứ tự beat) hoặc 1 file đọc cả bài</span>
            <input type="file" accept="audio/*" multiple className="text-xs" onChange={e => e.target.files && onUpload(e.target.files)} /></label>
          {hasFullTrack && <p className="text-xs text-green-300">Đang dùng 1 file cả bài – app tự dò khoảng lặng để chia câu.</p>}
        </div>
      )}

      {voice.mode !== "upload" && (
        <div className="mt-3">
          <label className="block"><span className="label">Tốc độ đọc: {voice.speed.toFixed(2)}x</span>
            <input type="range" min={0.9} max={1.2} step={0.05} value={voice.speed} className="w-full" onChange={e => set({ speed: Number(e.target.value) })} /></label>
          <button className="btn mt-2 w-full" disabled={!!progress} onClick={onGenerateAll}>🔊 Tạo toàn bộ giọng đọc (MP3)</button>
        </div>
      )}

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-studio-muted">Mật khẩu studio (nếu đã đặt trên Vercel)</summary>
        <input className="input mt-2" type="password" value={voice.studioPassword ?? ""} placeholder="Để trống nếu chưa đặt STUDIO_PASSWORD"
          onChange={e => set({ studioPassword: e.target.value })} />
      </details>

      {progress && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded bg-studio-line"><div className="h-full bg-studio-accent transition-all" style={{ width: `${(100 * progress.done) / Math.max(1, progress.total)}%` }} /></div>
          <p className="mt-1 text-xs text-studio-muted">{progress.label}</p>
        </div>
      )}
      {message && <p className={`mt-2 whitespace-pre-wrap text-xs ${message.kind === "err" ? "text-red-400" : message.kind === "ok" ? "text-green-300" : "text-studio-muted"}`}>{message.text}</p>}

      <div className="mt-4 border-t border-studio-line pt-3">
        <label className="block"><span className="label">Nhạc nền (tuỳ chọn)</span><input type="file" accept="audio/*" className="text-xs" onChange={e => onBgm(e.target.files?.[0])} /></label>
        <label className="mt-2 block"><span className="label">Âm lượng nhạc nền: {Math.round(bgmVolume * 100)}%</span>
          <input type="range" min={0} max={0.5} step={0.01} value={bgmVolume} className="w-full" onChange={e => onBgmVolume(Number(e.target.value))} /></label>
        <button className="btn-ghost mt-3 text-xs" onClick={onClear}>Xoá toàn bộ giọng đã tạo</button>
      </div>
    </section>
  );
}
