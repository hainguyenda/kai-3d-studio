"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AspectRatio, Beat, CharacterId, Episode } from "@/lib/types";
import { aspectOf } from "@/lib/types";
import { DEMO_EPISODE } from "@/lib/demoEpisode";
import { buildTimeline, frameAt } from "@/lib/timeline";
import { decodeAudio, getAudioContext, snapBounds } from "@/lib/audio";
import { clearAudio, deleteAudio, FULL_TRACK_KEY, loadAllAudio, narrationSignature, putAudio } from "@/lib/audioStore";
import type { StudioEngine } from "@/lib/engine";
import { startPlayback, type PlaybackHandle } from "@/lib/exporter";
import ScriptPanel from "@/components/ScriptPanel";
import VoicePanel from "@/components/VoicePanel";
import PreviewPanel from "@/components/PreviewPanel";
import ExportPanel from "@/components/ExportPanel";
import { DEFAULT_VOICE, type BeatAudio, type VoiceSettings } from "@/components/studioTypes";

const LS_EPISODE = "moshimo.episode.v1", LS_VOICE = "moshimo.voice.v1", LS_CHAR = "moshimo.character.v1";
const load = <T,>(key: string, fallback: T): T => {
  try { const s = localStorage.getItem(key); return s ? { ...fallback, ...JSON.parse(s) } : fallback; } catch { return fallback; }
};
/** sửa lỗi tiêu đề gợi ý thiếu số ngày ở tập mẫu cũ đã lưu trong trình duyệt */
const fixEpisode = (ep: Episode): Episode => {
  const titles = ep.youtube?.titles;
  if (!titles?.some(t => t.includes("…日半の"))) return ep;
  return { ...ep, youtube: { ...ep.youtube!, titles: titles.map(t => t.replace("…日半の", "…3日半の")) } };
};
const save = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* bộ nhớ đầy hoặc bị chặn */ } };

export default function StudioPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<StudioEngine | null>(null);
  const playRef = useRef<PlaybackHandle | null>(null);
  const lastTimeUpdate = useRef(0);

  const [episode, setEpisode] = useState<Episode>(DEMO_EPISODE);
  const [voice, setVoice] = useState<VoiceSettings>(DEFAULT_VOICE);
  const [audios, setAudios] = useState<Record<string, BeatAudio>>({});
  const [fullTrack, setFullTrack] = useState<{ buffer: AudioBuffer; bounds: number[] } | null>(null);
  const [bgm, setBgm] = useState<AudioBuffer | null>(null);
  const [bgmVolume, setBgmVolume] = useState(0.1);
  const [ready, setReady] = useState(false);
  const [loadingText, setLoadingText] = useState("Đang dựng cảnh 3D…");
  const [time, setTime] = useState(1.2);
  const [playing, setPlaying] = useState(false);
  const [showHud, setShowHud] = useState(true);
  const [showSubs, setShowSubs] = useState(true);
  const [busyBeat, setBusyBeat] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [voiceMsg, setVoiceMsg] = useState<{ text: string; kind: "ok" | "err" | "info" } | null>(null);
  const [resolution, setResolution] = useState(1920);
  const [fps, setFps] = useState<30 | 60>(30);
  const [sfx, setSfx] = useState(true);
  const [thumbBeat, setThumbBeat] = useState(5);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");
  const [video, setVideo] = useState<{ url: string; name: string } | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [character, setCharacter] = useState<CharacterId>("nv2");

  // nạp dữ liệu đã lưu
  useEffect(() => {
    const ep = fixEpisode(load(LS_EPISODE, DEMO_EPISODE));
    setEpisode(ep); setVoice(load(LS_VOICE, DEFAULT_VOICE));
    // nạp lại giọng đã tạo từ IndexedDB (chỉ giữ beat có lời đọc chưa đổi)
    let cancelled = false;
    (async () => {
      const stored = await loadAllAudio();
      const restored: Record<string, BeatAudio> = {}, stale: string[] = [];
      for (const [key, v] of Object.entries(stored)) {
        if (key === FULL_TRACK_KEY) continue;
        const beat = ep.beats.find(b => b.id === key);
        if (!beat || beat.ja_narration !== v.text) { stale.push(key); continue; }
        try { restored[key] = { buffer: await decodeAudio(v.data), url: URL.createObjectURL(new Blob([v.data], { type: "audio/mpeg" })), source: v.source }; }
        catch { stale.push(key); }
      }
      let full: { buffer: AudioBuffer; bounds: number[] } | null = null;
      const f = stored[FULL_TRACK_KEY];
      if (f && f.bounds && f.text === narrationSignature(ep.beats.map(b => b.ja_narration))) {
        try { full = { buffer: await decodeAudio(f.data), bounds: f.bounds }; } catch { stale.push(FULL_TRACK_KEY); }
      } else if (f) stale.push(FULL_TRACK_KEY);
      if (stale.length) void deleteAudio(stale);
      if (cancelled) { Object.values(restored).forEach(a => URL.revokeObjectURL(a.url)); return; }
      const n = Object.keys(restored).length;
      if (n) setAudios(a => ({ ...restored, ...a }));
      if (full) setFullTrack(cur => cur ?? full);
      if (n || full) setVoiceMsg({ text: full ? "✓ Đã nạp lại file giọng cả bài đã lưu." : `✓ Đã nạp lại giọng đã lưu cho ${n} beat.`, kind: "info" });
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { save(LS_EPISODE, episode); }, [episode]);
  useEffect(() => { save(LS_VOICE, voice); }, [voice]);
  useEffect(() => { try { const c = localStorage.getItem(LS_CHAR); if (c === "nv1" || c === "nv2") setCharacter(c); } catch { /* bỏ qua */ } }, []);
  useEffect(() => { try { localStorage.setItem(LS_CHAR, character); } catch { /* bỏ qua */ } engineRef.current?.setCharacter(character); }, [character]);

  // tỉ lệ khung hình nằm trong kịch bản (JSON "aspect") để lưu / mở file giữ nguyên
  const aspect = aspectOf(episode);
  const onAspect = (a: AspectRatio) => setEpisode(ep => ({ ...ep, aspect: a }));

  const timeline = useMemo(
    () => buildTimeline(episode, episode.beats.map(b => audios[b.id]?.buffer.duration), fullTrack ? { duration: fullTrack.buffer.duration, bounds: fullTrack.bounds } : undefined),
    [episode, audios, fullTrack],
  );

  // khởi tạo bộ máy 3D
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        await Promise.all([document.fonts.load('900 60px "Noto Sans JP"'), document.fonts.load('500 26px "Noto Sans JP"')]).catch(() => undefined);
        setLoadingText("Đang dựng khu phố, đường hầm và Trái Đất… (lần đầu mất vài giây)");
        await new Promise(r => setTimeout(r, 30));
        const { StudioEngine } = await import("@/lib/engine");
        if (disposed || !canvasRef.current) return;
        engineRef.current = new StudioEngine(canvasRef.current, 1920, aspectOf(load(LS_EPISODE, DEMO_EPISODE)));
        setReady(true);
      } catch (e) { setLoadingText("Không khởi tạo được WebGL: " + (e instanceof Error ? e.message : String(e))); }
    })();
    return () => { disposed = true; playRef.current?.stop(); engineRef.current?.dispose(); engineRef.current = null; };
  }, []);

  // vẽ lại khi dừng (kéo thanh thời gian, sửa kịch bản)
  useEffect(() => {
    if (!ready || playing || exporting || !engineRef.current) return;
    engineRef.current.setCharacter(character);
    engineRef.current.renderAt(episode, timeline, time, { showHud, showSubs });
  }, [ready, playing, exporting, episode, timeline, time, showHud, showSubs, character]);

  const beatLabel = useMemo(() => {
    if (!episode.beats.length) return "";
    const { ctx } = frameAt(episode, timeline, time);
    return `Beat ${ctx.index + 1}/${episode.beats.length} · ${ctx.beat.vi_note.slice(0, 60)}${ctx.beat.vi_note.length > 60 ? "…" : ""}`;
  }, [episode, timeline, time]);

  /* ---------- giọng đọc ---------- */
  const fetchVoice = useCallback(async (text: string): Promise<{ data: ArrayBuffer; source: BeatAudio["source"] }> => {
    const isEleven = voice.mode === "eleven";
    if (isEleven && !voice.elevenKey) throw new Error("Chưa nhập API key ElevenLabs.");
    const r = await fetch(isEleven ? "/api/elevenlabs" : "/api/tts", {
      method: "POST", headers: { "Content-Type": "application/json", ...(voice.studioPassword ? { "x-studio-password": voice.studioPassword } : {}) },
      body: JSON.stringify(isEleven
        ? { apiKey: voice.elevenKey, voiceId: voice.elevenVoice, modelId: voice.elevenModel, text, speed: voice.speed }
        : { text, voice: voice.edgeVoice, rate: voice.speed }),
    });
    if (!r.ok) { const j = await r.json().catch(() => ({ error: r.statusText })); throw new Error((j as { error?: string }).error || `Lỗi ${r.status}`); }
    return { data: await r.arrayBuffer(), source: isEleven ? "eleven" : "edge" };
  }, [voice]);

  const generateBeat = useCallback(async (beat: Beat): Promise<BeatAudio> => {
    const { data, source } = await fetchVoice(beat.ja_narration);
    const buffer = await decodeAudio(data);
    const url = URL.createObjectURL(new Blob([data], { type: "audio/mpeg" }));
    const au: BeatAudio = { buffer, url, source };
    setAudios(a => { if (a[beat.id]) URL.revokeObjectURL(a[beat.id].url); return { ...a, [beat.id]: au }; });
    setFullTrack(null);
    void putAudio(beat.id, { data, source, text: beat.ja_narration });
    void deleteAudio([FULL_TRACK_KEY]);
    return au;
  }, [fetchVoice]);

  const playBuffer = (buf: AudioBuffer) => { const ac = getAudioContext(); void ac.resume(); const n = ac.createBufferSource(); n.buffer = buf; n.connect(ac.destination); n.start(); };

  const onGenerate = async (beat: Beat) => {
    if (voice.mode === "upload") { setVoiceMsg({ text: "Đang ở chế độ Tải file lên – chọn Edge hoặc ElevenLabs để tạo giọng.", kind: "info" }); return; }
    setBusyBeat(beat.id); setVoiceMsg(null);
    try { const au = await generateBeat(beat); playBuffer(au.buffer); setVoiceMsg({ text: `✓ Đã tạo giọng cho ${beat.id} (${au.buffer.duration.toFixed(1)}s)`, kind: "ok" }); }
    catch (e) { setVoiceMsg({ text: e instanceof Error ? e.message : String(e), kind: "err" }); }
    setBusyBeat(null);
  };
  const onListen = async (beat: Beat) => {
    const au = audios[beat.id];
    if (au) { playBuffer(au.buffer); return; }
    await onGenerate(beat);
  };
  const onGenerateAll = async () => {
    if (voice.mode === "upload") return;
    setVoiceMsg(null);
    const beats = episode.beats;
    for (let i = 0; i < beats.length; i++) {
      setGenProgress({ done: i, total: beats.length, label: `Đang tạo giọng beat ${i + 1}/${beats.length}…` });
      try { await generateBeat(beats[i]); }
      catch (e) { setVoiceMsg({ text: `Dừng ở beat ${i + 1}: ${e instanceof Error ? e.message : String(e)}`, kind: "err" }); setGenProgress(null); return; }
    }
    setGenProgress(null);
    setVoiceMsg({ text: `✓ Xong ${beats.length} beat. Thời lượng mỗi beat đã tự khớp theo giọng (+0,3s nghỉ).`, kind: "ok" });
  };
  const onUpload = async (files: FileList) => {
    const list = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    try {
      setVoiceMsg({ text: "Đang đọc file…", kind: "info" });
      if (list.length === 1 && episode.beats.length > 1) {
        const raw = await list[0].arrayBuffer();
        const buf = await decodeAudio(raw);
        const bounds = snapBounds(buf, episode.beats.map(b => [...b.ja_narration].length + 4));
        setFullTrack({ buffer: buf, bounds });
        void putAudio(FULL_TRACK_KEY, { data: raw, source: "upload", text: narrationSignature(episode.beats.map(b => b.ja_narration)), bounds });
        setVoiceMsg({ text: `✓ 1 file cả bài (${buf.duration.toFixed(1)}s). Bấm "xem" từng beat để kiểm tra phụ đề có khớp không.`, kind: "ok" });
      } else {
        const next: Record<string, BeatAudio> = {};
        for (let i = 0; i < list.length && i < episode.beats.length; i++) {
          const data = await list[i].arrayBuffer();
          const beat = episode.beats[i];
          next[beat.id] = { buffer: await decodeAudio(data), url: URL.createObjectURL(list[i]), source: "upload" };
          void putAudio(beat.id, { data, source: "upload", text: beat.ja_narration });
        }
        setFullTrack(null); void deleteAudio([FULL_TRACK_KEY]); setAudios(a => ({ ...a, ...next }));
        const warn = list.length !== episode.beats.length ? ` ⚠ Có ${list.length} file nhưng ${episode.beats.length} beat.` : "";
        setVoiceMsg({ text: `✓ Đã gắn ${Object.keys(next).length} file theo thứ tự tên.${warn}`, kind: warn ? "err" : "ok" });
      }
    } catch (e) { setVoiceMsg({ text: "Không đọc được file: " + (e instanceof Error ? e.message : String(e)), kind: "err" }); }
  };
  const onClear = () => { Object.values(audios).forEach(a => URL.revokeObjectURL(a.url)); setAudios({}); setFullTrack(null); void clearAudio(); setVoiceMsg({ text: "Đã xoá giọng.", kind: "info" }); };
  const onBgm = async (f?: File) => { if (!f) { setBgm(null); return; } try { setBgm(await decodeAudio(await f.arrayBuffer())); } catch { setVoiceMsg({ text: "Không đọc được nhạc nền", kind: "err" }); } };

  const onEpisodeChange = (ep: Episode) => {
    // giọng cũ không còn khớp nếu đổi lời đọc
    setAudios(a => {
      const keep: Record<string, BeatAudio> = {};
      ep.beats.forEach(b => { const old = episode.beats.find(x => x.id === b.id), au = a[b.id]; if (au && old && old.ja_narration === b.ja_narration) keep[b.id] = au; });
      const dropped = Object.keys(a).filter(k => !keep[k]);
      if (dropped.length) void deleteAudio(dropped);
      return keep;
    });
    if (fullTrack && narrationSignature(ep.beats.map(b => b.ja_narration)) !== narrationSignature(episode.beats.map(b => b.ja_narration))) {
      setFullTrack(null); void deleteAudio([FULL_TRACK_KEY]);
    }
    setEpisode(ep);
  };

  /* ---------- phát / xuất ---------- */
  const audioPayload = () => ({
    perBeat: episode.beats.map(b => audios[b.id]?.buffer), fullTrack: fullTrack?.buffer, bgm: bgm ?? undefined, bgmVolume, sfx,
  });
  // mỗi lần phát có 1 mã riêng, để lần phát cũ (bị dừng khi tua) không tắt trạng thái của lần phát mới
  const playSession = useRef(0);
  const seekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPlay = async (fromOverride?: number) => {
    const eng = engineRef.current; if (!eng) return;
    if (Math.max(eng.out.width, eng.out.height) !== 1920 || eng.aspect !== aspect) eng.setResolution(1920, aspect);
    const session = ++playSession.current;
    playRef.current?.stop();
    setPlaying(true);
    const start = fromOverride ?? time;
    const from = start >= timeline.total - 0.2 ? 0 : start;
    const h = await startPlayback(eng, episode, timeline, audioPayload(), {
      record: false, fps: 30, from, showHud, showSubs,
      onTime: t => { const now = performance.now(); if (now - lastTimeUpdate.current > 120) { lastTimeUpdate.current = now; setTime(t); } },
    });
    if (session !== playSession.current) { h.stop(); return; }
    playRef.current = h;
    await h.done;
    if (session !== playSession.current) return;
    playRef.current = null; setPlaying(false);
  };
  const onPause = () => { playSession.current++; if (seekTimer.current) clearTimeout(seekTimer.current); playRef.current?.stop(); playRef.current = null; setPlaying(false); };
  /** tua: đang phát thì dừng tạm, kéo xong 150 ms thì phát tiếp từ chỗ mới */
  const seekTo = (t: number) => {
    const wasPlaying = playing;
    lastTimeUpdate.current = performance.now() + 400; // chặn đồng hồ cũ ghi đè vị trí vừa tua
    setTime(t);
    if (!wasPlaying) return;
    engineRef.current?.renderAt(episode, timeline, t, { showHud, showSubs });
    playSession.current++; playRef.current?.stop(); playRef.current = null;
    if (seekTimer.current) clearTimeout(seekTimer.current);
    seekTimer.current = setTimeout(() => { void onPlay(t); }, 150);
  };
  const onSeekBeat = (i: number) => seekTo((timeline.starts[i] ?? 0) + 0.6);

  const onExport = async () => {
    const eng = engineRef.current; if (!eng) return;
    playRef.current?.stop();
    setExporting(true); setExportProgress(0); setExportStatus("Đang xuất… giữ tab này mở."); if (video) URL.revokeObjectURL(video.url); setVideo(null);
    try {
      eng.setResolution(resolution, aspect);
      const h = await startPlayback(eng, episode, timeline, audioPayload(), {
        record: true, fps, showHud, showSubs,
        onTime: t => { const now = performance.now(); if (now - lastTimeUpdate.current > 250) { lastTimeUpdate.current = now; setExportProgress(Math.min(1, t / timeline.total)); setExportStatus(`Đang xuất ${t.toFixed(0)}s / ${timeline.total.toFixed(0)}s – giữ tab này mở.`); } },
      });
      playRef.current = h;
      const blob = await h.done; playRef.current = null;
      if (blob && blob.size > 0) {
        const ext = h.mime.includes("mp4") ? "mp4" : "webm";
        setVideo({ url: URL.createObjectURL(blob), name: `${episode.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 40)}${aspect === "9:16" ? "-shorts-9x16" : ""}.${ext}` });
        setExportStatus(`✓ Xuất xong (${(blob.size / 1e6).toFixed(1)} MB, ${ext.toUpperCase()}).`);
      } else setExportStatus("Đã huỷ.");
    } catch (e) { setExportStatus("Lỗi xuất video: " + (e instanceof Error ? e.message : String(e))); }
    eng.setResolution(1920, aspect); setExporting(false); setExportProgress(1);
  };
  const onCancel = () => playRef.current?.stop();

  const onThumbnail = () => {
    const eng = engineRef.current; if (!eng) return;
    const i = Math.min(thumbBeat, episode.beats.length - 1);
    eng.setResolution(1920, aspect);
    eng.renderAt(episode, timeline, timeline.starts[i] + Math.min(2, timeline.durs[i] * 0.6), { showHud: true, showSubs: false });
    eng.compositor.thumbnailText(episode.thumbnailText || episode.title);
    eng.out.toBlob(b => { if (!b) return; if (thumbUrl) URL.revokeObjectURL(thumbUrl); setThumbUrl(URL.createObjectURL(b)); eng.renderAt(episode, timeline, time, { showHud, showSubs }); }, "image/png");
  };

  const missingAudio = fullTrack ? 0 : episode.beats.filter(b => !audios[b.id]).length;

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-5">
      <header className="mb-4 flex flex-wrap items-end gap-3">
        <h1 className="text-2xl font-black">🎬 Kai 3D Studio</h1>
        <p className="text-sm text-studio-muted">Kịch bản song ngữ → giọng Nhật tự động → hình 3D + HUD + phụ đề → MP4 1080p ngang 16:9 hoặc dọc 9:16 (Shorts / Reels / TikTok)</p>
        <button className="btn-ghost ml-auto text-xs" onClick={() => { onClear(); setEpisode(DEMO_EPISODE); setTime(1.2); }}>Nạp lại tập mẫu</button>
      </header>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <ScriptPanel episode={episode} timeline={timeline} audios={audios} busyBeat={busyBeat} onChange={onEpisodeChange} onGenerate={onGenerate} onListen={onListen} onSeekBeat={onSeekBeat} />
        </div>
        <div className="space-y-4">
          <PreviewPanel canvasRef={canvasRef} ready={ready} loadingText={loadingText} playing={playing} time={time} total={timeline.total}
            showHud={showHud} showSubs={showSubs} onPlay={() => void onPlay()} onPause={onPause} onSeek={seekTo} onHud={setShowHud} onSubs={setShowSubs} beatLabel={beatLabel}
            character={character} onCharacter={setCharacter} aspect={aspect} onAspect={onAspect} disabled={exporting} />
          <div className="grid gap-4 lg:grid-cols-2">
            <VoicePanel voice={voice} onVoice={setVoice} progress={genProgress} message={voiceMsg} onGenerateAll={onGenerateAll} onUpload={onUpload}
              onClear={onClear} onBgm={onBgm} bgmVolume={bgmVolume} onBgmVolume={setBgmVolume} hasFullTrack={!!fullTrack} />
            <ExportPanel episode={episode} ready={ready} exporting={exporting} progress={exportProgress} resolution={resolution} fps={fps} sfx={sfx} thumbBeat={thumbBeat}
              aspect={aspect} onAspect={onAspect} onResolution={setResolution} onFps={setFps} onSfx={setSfx} onThumbBeat={setThumbBeat} onExport={onExport} onCancel={onCancel} onThumbnail={onThumbnail}
              videoUrl={video?.url ?? null} videoName={video?.name ?? ""} thumbUrl={thumbUrl} status={exportStatus} missingAudio={missingAudio} />
          </div>
        </div>
      </div>
    </main>
  );
}
