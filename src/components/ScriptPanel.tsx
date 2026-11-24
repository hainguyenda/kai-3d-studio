"use client";
import { useState } from "react";
import type { Beat, CameraPreset, CharacterAction, Emotion, Episode, HudState, SceneId, Timeline } from "@/lib/types";
import { EMOTIONS, inferEmotion } from "@/lib/emotion";
import { CAMERA_PRESETS } from "@/lib/scenes/cameraPresets";
import { buildIntroBeat, buildOutroBeats } from "@/lib/introOutro";
import type { BeatAudio } from "./studioTypes";

const SCENES: { id: SceneId; vi: string }[] = [
  { id: "japanese_street", vi: "Phố Nhật" }, { id: "underground_tunnel", vi: "Đường hầm lòng đất" }, { id: "earth_globe", vi: "Trái Đất (vũ trụ)" },
  { id: "earth_cutaway", vi: "Trái Đất bổ đôi (lõi)" }, { id: "ocean_surface", vi: "Mặt biển" },
  { id: "stage_studio", vi: "Sân khấu giải thích (biểu đồ)" },
  { id: "city_ny", vi: "Phố New York (đêm)" },
  { id: "wind_storm_street", vi: "Phố Nhật giữa bão" }, { id: "mega_tsunami_coast", vi: "Bờ biển sóng thần" },
  { id: "arctic_pole", vi: "Bắc Cực" }, { id: "space_iss_orbit", vi: "Quỹ đạo ISS" },
  { id: "extreme_climate_zone", vi: "Khí hậu cực đoan" }, { id: "science_museum_pendulum", vi: "Con lắc Foucault" },
  { id: "moon_surface", vi: "Mặt Trăng (mới)" }, { id: "earth_moon_space", vi: "Trái Đất ↔ Mặt Trăng (mới)" }, { id: "deep_sea", vi: "Biển sâu (mới)" },
  { id: "tokyo_glass_street", vi: "Tokyo: mặt đường kính (mới)" }, { id: "tokyo_deep_infra", vi: "Tokyo: lát cắt 0–60 m (mới)" },
  { id: "tokyo_strata_onsen", vi: "Tokyo: địa tầng + suối nóng 3 km (mới)" },
  { id: "space_elevator", vi: "Thang máy vũ trụ (mới)" }, { id: "solar_system", vi: "Hệ Mặt Trời (mới)" },
  { id: "sky_mountain", vi: "Núi Phú Sĩ / Everest + biển mây (mới)" }, { id: "typhoon_eye", vi: "Mắt bão (mới)" },
  { id: "ocean_world", vi: "Địa cầu rút cạn nước biển (mới)" }, { id: "sea_level_city", vi: "Thành phố + nước biển dâng (mới)" },
  { id: "whale_inside", vi: "Bên trong cá voi xanh (mới)" }, { id: "space_stairs", vi: "Cầu thang lên vũ trụ (mới)" },
  { id: "gravity_train", vi: "Tàu trọng lực xuyên lòng đất (mới)" },
  { id: "kola_borehole", vi: "Giếng khoan siêu sâu Kola 12 km (mới)" },
  { id: "gravity_room", vi: "Phòng + cân: trọng lực thay đổi (mới)" },
];
const ACTIONS: { id: CharacterAction; vi: string }[] = [
  { id: "idle", vi: "Đứng yên" }, { id: "idle_wave", vi: "Vẫy tay" }, { id: "look_down", vi: "Nhìn xuống" },
  { id: "jump_in", vi: "Nhảy xuống hố" }, { id: "freefall_float", vi: "Lơ lửng" }, { id: "flip_upside_down", vi: "Lộn ngược" },
  { id: "heavy_crouch", vi: "Khom người (trọng lực nặng)" }, { id: "blown_wind", vi: "Chống gió bão" }, { id: "jump_low", vi: "Nhảy thấp" },
  { id: "shiver", vi: "Run rét" }, { id: "point_explain", vi: "Chỉ tay giải thích" },
  { id: "slam_land", vi: "Rơi từ trên cao xuống – ĐÙNG (gag)" }, { id: "faceplant", vi: "Ngã sấp mặt (gag)" }, { id: "struggle_up", vi: "Cố đứng dậy không nổi (gag)" },
];

interface Props {
  episode: Episode;
  timeline: Timeline;
  audios: Record<string, BeatAudio>;
  busyBeat: string | null;
  onChange(ep: Episode): void;
  onGenerate(beat: Beat): void;
  onListen(beat: Beat): void;
  onSeekBeat(index: number): void;
}

export default function ScriptPanel({ episode, timeline, audios, busyBeat, onChange, onGenerate, onListen, onSeekBeat }: Props) {
  const [mode, setMode] = useState<"cards" | "json">("cards");
  const [json, setJson] = useState("");
  const [err, setErr] = useState("");
  const [io, setIo] = useState({ channel: "もしも検証ラボ", topicJa: "", topicVi: "", recapJa: "", recapVi: "", afterHook: true });

  /** chèn 1 beat Intro + 2 beat Outro; bấm lại thì thay, không nhân đôi */
  const insertIntroOutro = () => {
    const ja = io.topicJa || episode.title, vi = io.topicVi || episode.title_vi || "";
    const cfg = { channelName: io.channel || "もしも検証ラボ", topicJa: ja, topicVi: vi, recapJa: io.recapJa || ja, recapVi: io.recapVi || vi };
    const rest = episode.beats.filter(b => b.id !== "beat_intro" && !b.id.startsWith("beat_outro"));
    if (!rest.length) return;
    // Intro đặt sau câu mở đầu (giữ hook ở giây đầu) hoặc lên đầu video; dùng camera sân khấu và HUD liền mạch
    const at = io.afterHook ? 1 : 0, prevHud = at ? rest[0].hudEnd : rest[0].hudStart;
    const intro = { ...(buildIntroBeat(cfg) as unknown as Beat), cameraPreset: "studio_front" as CameraPreset, hudStart: prevHud, hudEnd: prevHud };
    const outro = (buildOutroBeats(cfg, rest[rest.length - 1].hudEnd) as unknown as Beat[]).map(b => ({ ...b, cameraPreset: "studio_front" as CameraPreset }));
    onChange({ ...episode, beats: [...rest.slice(0, at), intro, ...rest.slice(at), ...outro] });
  };
  const hasIntro = episode.beats.some(b => b.id === "beat_intro");

  const setBeat = (i: number, patch: Partial<Beat>) => {
    const beats = episode.beats.map((b, k) => (k === i ? { ...b, ...patch } : b));
    onChange({ ...episode, beats });
  };
  const setHud = (i: number, key: "hudStart" | "hudEnd", f: keyof HudState, v: string) => {
    const cur = episode.beats[i][key];
    setBeat(i, { [key]: { ...cur, [f]: f === "time" ? v : Number(v) } } as Partial<Beat>);
  };
  const openJson = () => { setJson(JSON.stringify(episode, null, 2)); setErr(""); setMode("json"); };
  const applyJson = () => {
    try {
      const ep = JSON.parse(json) as Episode;
      if (!ep || !Array.isArray(ep.beats) || !ep.beats.length) throw new Error("JSON phải có mảng \"beats\".");
      ep.beats.forEach((b, i) => { if (!b.id) b.id = `beat_${String(i + 1).padStart(2, "0")}`; if (!b.hudStart || !b.hudEnd) throw new Error(`Beat ${i + 1} thiếu hudStart / hudEnd`); });
      onChange(ep); setErr(""); setMode("cards");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  const loadFile = async (f?: File) => { if (!f) return; setJson(await f.text()); setMode("json"); };
  const saveFile = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(episode, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `${episode.beats.length}-beats-episode.json`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <section className="panel">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="panel-title mb-0 mr-auto">1. Kịch bản song ngữ (Việt – Nhật)</h2>
        <button className={mode === "cards" ? "btn" : "btn-ghost"} onClick={() => setMode("cards")}>Thẻ</button>
        <button className={mode === "json" ? "btn" : "btn-ghost"} onClick={openJson}>JSON</button>
        <label className="btn-ghost cursor-pointer">Mở file<input type="file" accept=".json,application/json" className="hidden" onChange={e => loadFile(e.target.files?.[0])} /></label>
        <button className="btn-ghost" onClick={saveFile}>Lưu JSON</button>
      </div>
      <div className="mb-3">
        <input className="input ja text-base font-bold" value={episode.title} onChange={e => onChange({ ...episode, title: e.target.value })} />
        {episode.title_vi && <p className="mt-1 text-xs text-studio-muted">{episode.title_vi}</p>}
      </div>

      <details className="mb-3 rounded-lg border border-studio-line bg-[#12151d] p-2 text-xs">
        <summary className="cursor-pointer font-bold text-studio-accent">🎬 Tự chèn Intro &amp; Outro chuẩn kênh {hasIntro && <span className="ml-1 font-normal text-green-300">(đã có)</span>}</summary>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <label><span className="label">Tên kênh</span><input className="input ja" value={io.channel} onChange={e => setIo({ ...io, channel: e.target.value })} /></label>
          <label className="flex items-end gap-1 pb-2 text-gray-300"><input type="checkbox" checked={io.afterHook} onChange={e => setIo({ ...io, afterHook: e.target.checked })} /> Đặt Intro sau câu mở đầu (giữ người xem tốt hơn)</label>
          <label><span className="label">Chủ đề hôm nay (Nhật)</span><input className="input ja" placeholder={episode.title} value={io.topicJa} onChange={e => setIo({ ...io, topicJa: e.target.value })} /></label>
          <label><span className="label">Chủ đề hôm nay (Việt)</span><input className="input" placeholder={episode.title_vi ?? ""} value={io.topicVi} onChange={e => setIo({ ...io, topicVi: e.target.value })} /></label>
          <label><span className="label">Tóm tắt đã xong (Nhật)</span><input className="input ja" placeholder={episode.title} value={io.recapJa} onChange={e => setIo({ ...io, recapJa: e.target.value })} /></label>
          <label><span className="label">Tóm tắt đã xong (Việt)</span><input className="input" placeholder={episode.title_vi ?? ""} value={io.recapVi} onChange={e => setIo({ ...io, recapVi: e.target.value })} /></label>
        </div>
        <button className="btn mt-2 px-3 py-1 text-xs" onClick={insertIntroOutro}>Chèn Intro + Outro</button>
        <span className="ml-2 text-studio-muted">Ô trống = lấy theo tiêu đề tập. Bấm lại sẽ thay, không bị nhân đôi.</span>
      </details>

      {mode === "json" ? (
        <div>
          <textarea className="input h-[560px] font-mono text-xs" value={json} onChange={e => setJson(e.target.value)} spellCheck={false} />
          {err && <p className="mt-2 text-sm text-red-400">Lỗi: {err}</p>}
          <div className="mt-2 flex gap-2"><button className="btn" onClick={applyJson}>Áp dụng JSON</button><button className="btn-ghost" onClick={() => setMode("cards")}>Huỷ</button></div>
        </div>
      ) : (
        <div className="max-h-[640px] space-y-3 overflow-y-auto pr-1">
          {episode.beats.map((b, i) => {
            const au = audios[b.id];
            return (
              <div key={b.id + i} className="rounded-lg border border-studio-line bg-[#12151d] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <button className="font-bold text-studio-accent hover:underline" onClick={() => onSeekBeat(i)}>#{String(i + 1).padStart(2, "0")} ▶ xem</button>
                  <span className="text-studio-muted">{timeline.starts[i]?.toFixed(1)}s · {timeline.durs[i]?.toFixed(1)}s</span>
                  {au ? <span className="rounded bg-green-900/60 px-1.5 py-0.5 text-green-300">🔊 {au.buffer.duration.toFixed(1)}s ({au.source})</span> : <span className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-400">chưa có giọng</span>}
                  {b.env && <span className="rounded bg-sky-900/60 px-1.5 py-0.5 text-sky-200" title="Thời tiết / giờ trong ngày">🌦 {b.env.timeOfDay ?? "day"}{b.env.weather && b.env.weather !== "clear" ? ` · ${b.env.weather}` : ""}</span>}
                  {b.visual && <span className="rounded bg-orange-900/60 px-1.5 py-0.5 text-orange-200" title={b.visual.title}>📊 {b.visual.type}</span>}
                  <label className="btn-ghost cursor-pointer px-2 py-1 text-xs" title="Ảnh tải lên chỉ dùng được trong phiên này; tải lại trang thì phải chọn lại ảnh">📷 Ảnh beat
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setBeat(i, { imageOverlay: { src: URL.createObjectURL(f), mode: b.imageOverlay?.mode ?? "fullscreen_kenburns" } }); e.target.value = ""; }} /></label>
                  {b.imageOverlay && (
                    <span className="flex items-center gap-1">
                      <select className="input w-auto py-0.5 text-xs" value={b.imageOverlay.mode ?? "fullscreen_kenburns"} onChange={e => setBeat(i, { imageOverlay: { ...b.imageOverlay!, mode: e.target.value as "fullscreen_kenburns" | "pip_right" } })}>
                        <option value="fullscreen_kenburns">Toàn màn hình (zoom chậm)</option><option value="pip_right">Khung nhỏ bên phải</option>
                      </select>
                      <button className="text-red-300 hover:underline" title="Bỏ ảnh" onClick={() => setBeat(i, { imageOverlay: undefined })}>✕</button>
                    </span>
                  )}
                  <span className="ml-auto flex gap-1.5">
                    <button className="btn-ghost px-2 py-1 text-xs" disabled={busyBeat !== null} onClick={() => onListen(b)}>Nghe thử</button>
                    <button className="btn px-2 py-1 text-xs" disabled={busyBeat !== null} onClick={() => onGenerate(b)}>{busyBeat === b.id ? "Đang tạo…" : "Tạo giọng Nhật"}</button>
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <span className="label">🇻🇳 Nghĩa tiếng Việt</span>
                    <textarea className="input h-20" value={b.vi_note} onChange={e => setBeat(i, { vi_note: e.target.value })} />
                  </div>
                  <div>
                    <span className="label">🇯🇵 Lời đọc tiếng Nhật (phụ đề)</span>
                    <textarea className="input ja h-20" value={b.ja_narration} onChange={e => setBeat(i, { ja_narration: e.target.value })} />
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <label><span className="label">Cảnh</span>
                    <select className="input" value={b.scene} onChange={e => setBeat(i, { scene: e.target.value as SceneId })}>{SCENES.map(s => <option key={s.id} value={s.id}>{s.vi}</option>)}</select></label>
                  <label><span className="label">Camera</span>
                    <select className="input" value={b.cameraPreset} onChange={e => setBeat(i, { cameraPreset: e.target.value as CameraPreset })}>{CAMERA_PRESETS.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
                  <label><span className="label">Hành động</span>
                    <select className="input" value={b.characterAction} onChange={e => setBeat(i, { characterAction: e.target.value as CharacterAction })}>{ACTIONS.map(a => <option key={a.id} value={a.id}>{a.vi}</option>)}</select></label>
                  <label><span className="label">Chữ lớn giữa màn hình</span>
                    <input className="input ja" value={b.caption ?? ""} onChange={e => setBeat(i, { caption: e.target.value || undefined })} /></label>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-300">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={!!b.spacesuit} onChange={e => setBeat(i, { spacesuit: e.target.checked })} /> Đồ phi hành gia</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={!!b.platform} onChange={e => setBeat(i, { platform: e.target.checked })} /> Bệ thang máy</label>
                  <label className="flex items-center gap-1">Cảm xúc (Kai)
                    <select className="input w-auto py-0.5 text-xs" value={b.emotion ?? ""} onChange={e => setBeat(i, { emotion: (e.target.value || undefined) as Emotion | undefined })}>
                      <option value="">Tự đoán ({EMOTIONS.find(x => x.id === inferEmotion({ ...b, emotion: undefined }, b.hudEnd.depthKm))?.vi})</option>
                      {EMOTIONS.map(x => <option key={x.id} value={x.id}>{x.vi}</option>)}
                    </select></label>
                </div>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-studio-muted">HUD (giờ · độ sâu km · tốc độ km/h · tiến trình 0–1)</summary>
                  {(["hudStart", "hudEnd"] as const).map(key => (
                    <div key={key} className="mt-1 grid grid-cols-5 items-center gap-1.5">
                      <span className="text-studio-muted">{key === "hudStart" ? "Đầu beat" : "Cuối beat"}</span>
                      {(["time", "depthKm", "speedKmh", "progress"] as const).map(f => (
                        <input key={f} className="input py-1 text-xs" value={String(b[key][f])} onChange={e => setHud(i, key, f, e.target.value)} />
                      ))}
                    </div>
                  ))}
                </details>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
