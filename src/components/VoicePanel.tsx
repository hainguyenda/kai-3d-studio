"use client";
import { useEffect, useState } from "react";
import type { VoiceSettings } from "./studioTypes";
import { LOCAL_ENGINES, listLocalSpeakers, localCredit, type LocalEngine, type LocalSpeaker } from "@/lib/localVoice";
import { formatReadings, parseReadings, type Readings } from "@/lib/readings";

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
  readings?: Readings;
  onReadings(r: Readings): void;
}

export default function VoicePanel({ voice, onVoice, progress, message, onGenerateAll, onUpload, onClear, onBgm, bgmVolume, onBgmVolume, hasFullTrack, readings, onReadings }: Props) {
  const set = (p: Partial<VoiceSettings>) => onVoice({ ...voice, ...p });
  const [speakers, setSpeakers] = useState<LocalSpeaker[]>([]);
  const [localMsg, setLocalMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [readText, setReadText] = useState(formatReadings(readings));
  useEffect(() => { setReadText(formatReadings(readings)); }, [readings]);
  const connectLocal = async () => {
    setLocalMsg({ text: "Đang kết nối…", err: false });
    try {
      const list = await listLocalSpeakers(voice.localUrl);
      setSpeakers(list);
      setLocalMsg({ text: `✓ Đã kết nối – ${list.length} giọng.`, err: false });
    } catch (e) { setSpeakers([]); setLocalMsg({ text: e instanceof Error ? e.message : String(e), err: true }); }
  };
  const pickEngine = (engine: LocalEngine) => {
    setSpeakers([]); setLocalMsg(null);
    set(engine === "voicevox"
      ? { localEngine: engine, localUrl: LOCAL_ENGINES.voicevox.url, localSpeaker: 13, localCharacter: "青山龍星", localStyle: "ノーマル" }
      : { localEngine: engine, localUrl: LOCAL_ENGINES.aivis.url, localSpeaker: 0, localCharacter: "", localStyle: "" });
  };
  const tab = (m: VoiceSettings["mode"], label: string) => (
    <button className={voice.mode === m ? "btn" : "btn-ghost"} onClick={() => set({ mode: m })}>{label}</button>
  );
  return (
    <section className="panel">
      <h2 className="panel-title">3. Giọng đọc tiếng Nhật (tự động)</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {tab("local", "VOICEVOX / AivisSpeech (miễn phí)")}{tab("edge", "Edge (thử nghiệm)")}{tab("eleven", "ElevenLabs")}{tab("upload", "Tải file lên")}
      </div>

      {voice.mode === "local" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label><span className="label">Phần mềm giọng</span>
              <select className="input" value={voice.localEngine} onChange={e => pickEngine(e.target.value === "aivis" ? "aivis" : "voicevox")}>
                <option value="voicevox">VOICEVOX (nhiều nhân vật)</option>
                <option value="aivis">AivisSpeech (giọng tự nhiên hơn)</option>
              </select></label>
            <label><span className="label">Địa chỉ</span>
              <input className="input" value={voice.localUrl} onChange={e => set({ localUrl: e.target.value })} /></label>
          </div>
          <button className="btn-ghost w-full" onClick={connectLocal}>🔌 Kết nối &amp; tải danh sách giọng</button>
          {speakers.length > 0 && (
            <label className="block"><span className="label">Giọng</span>
              <select className="input ja" value={voice.localSpeaker} onChange={e => {
                const sp = speakers.find(x => x.id === Number(e.target.value));
                if (sp) set({ localSpeaker: sp.id, localCharacter: sp.character, localStyle: sp.style });
              }}>
                {!speakers.some(x => x.id === voice.localSpeaker) && <option value={voice.localSpeaker}>— chọn giọng —</option>}
                {speakers.map(sp => <option key={sp.id} value={sp.id}>{sp.character}（{sp.style}）</option>)}
              </select></label>
          )}
          {localMsg && <p className={`whitespace-pre-wrap text-xs ${localMsg.err ? "text-red-400" : "text-green-300"}`}>{localMsg.text}</p>}
          <p className="ja text-xs text-studio-muted">Đang dùng: {voice.localCharacter || "(chưa chọn)"}{voice.localStyle ? `（${voice.localStyle}）` : ""} · id {voice.localSpeaker}</p>
          <p className="rounded-lg border border-sky-700/60 bg-sky-900/20 p-2 text-xs text-sky-100">
            Miễn phí, được dùng cho video kiếm tiền nếu ghi credit trong mô tả: <b className="ja">{localCredit(voice.localEngine, voice.localCharacter)}</b> – app tự thêm dòng này vào phần Mô tả ở mục 4.
            Mỗi nhân vật có điều khoản riêng, đọc trang của nhân vật đó trước khi đăng.
          </p>
          <details className="text-xs">
            <summary className="cursor-pointer text-studio-accent">Cài lần đầu (5 phút)</summary>
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-gray-300">
              <li>Tải và cài {LOCAL_ENGINES[voice.localEngine].label}: <a className="underline" href={LOCAL_ENGINES[voice.localEngine].download} target="_blank" rel="noreferrer">{LOCAL_ENGINES[voice.localEngine].download}</a>, rồi mở app (để chạy nền).</li>
              <li>Mở <a className="underline" href={`${voice.localUrl.replace(/\/+$/, "")}/setting`} target="_blank" rel="noreferrer">{voice.localUrl.replace(/\/+$/, "")}/setting</a> → mục CORS / 許可するオリジン thêm <code>{typeof location !== "undefined" ? location.origin : "https://kai-3d-studio.vercel.app"}</code> → 保存 → tắt app mở lại.</li>
              <li>Bấm &quot;Kết nối&quot; ở trên. Chrome hỏi quyền truy cập mạng nội bộ thì bấm Cho phép.</li>
              <li>Chọn giọng, bấm &quot;Tạo toàn bộ giọng đọc&quot;. Giọng tạo ngay trên máy bạn, không tốn tiền, không giới hạn.</li>
            </ol>
          </details>
        </div>
      )}

      {voice.mode === "edge" && (
        <div className="space-y-3">
          <label className="block"><span className="label">Giọng</span>
            <select className="input" value={voice.edgeVoice} onChange={e => set({ edgeVoice: e.target.value as VoiceSettings["edgeVoice"] })}>
              <option value="ja-JP-KeitaNeural">Keita – Nam Nhật</option>
              <option value="ja-JP-NanamiNeural">Nanami – Nữ Nhật</option>
            </select></label>
          <p className="rounded-lg border border-yellow-700/60 bg-yellow-900/20 p-2 text-xs text-yellow-200">
            ⚠ Giọng Edge là dịch vụ đọc của trình duyệt Microsoft Edge, không có giấy phép dùng cho video kiếm tiền và có thể ngừng hoạt động bất cứ lúc nào. Video đăng kênh nên dùng VOICEVOX / AivisSpeech (miễn phí) hoặc ElevenLabs.
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
          <button className="btn mt-2 w-full" disabled={!!progress} onClick={onGenerateAll}>🔊 Tạo toàn bộ giọng đọc</button>
        </div>
      )}

      <details className="mt-3 text-xs" open={!!readings && Object.keys(readings).length > 0}>
        <summary className="cursor-pointer text-studio-accent">🈁 Sửa cách đọc (読み){readings && Object.keys(readings).length ? ` – ${Object.keys(readings).length} từ` : ""}</summary>
        <p className="mt-1 text-studio-muted">Giọng đọc sai chữ Hán? Mỗi dòng 1 từ: <code className="ja">chữ=cách đọc</code>. Phụ đề vẫn giữ chữ Hán, chỉ giọng đọc đổi. Lưu cùng file JSON của tập. Sửa xong bấm tạo lại giọng cho beat có từ đó.</p>
        <textarea className="input ja mt-1 h-24 font-mono text-xs" spellCheck={false} value={readText}
          placeholder={"地殻=ちかく\n外核=がいかく\n360万気圧=さんびゃくろくじゅうまんきあつ"}
          onChange={e => setReadText(e.target.value)} onBlur={() => onReadings(parseReadings(readText))} />
      </details>

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
