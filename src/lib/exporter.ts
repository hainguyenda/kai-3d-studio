import type { Episode, Timeline } from "./types";
import type { StudioEngine, RenderOptions } from "./engine";
import { createAmbience, getAudioContext } from "./audio";
import { LEAD } from "./timeline";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";

export interface PlaybackAudio {
  perBeat: (AudioBuffer | undefined)[];
  fullTrack?: AudioBuffer;
  bgm?: AudioBuffer;
  bgmVolume: number;
  sfx: boolean;
}

export interface PlaybackOptions extends RenderOptions {
  record: boolean;
  fps: 30 | 60;
  from?: number;
  onTime?: (t: number) => void;
}

export interface PlaybackHandle { stop(): void; done: Promise<Blob | null>; mime: string }

export function pickMime(): string {
  const list = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  if (typeof MediaRecorder === "undefined") return "";
  return list.find(m => MediaRecorder.isTypeSupported(m)) ?? "";
}

/** Phát (xem thử) hoặc ghi (xuất video) theo thời gian thật, đồng bộ theo đồng hồ âm thanh */
export async function startPlayback(engine: StudioEngine, ep: Episode, tl: Timeline, audio: PlaybackAudio, o: PlaybackOptions): Promise<PlaybackHandle> {
  // xuất video: dựng từng khung hình (không cần giữ tab) nếu trình duyệt có WebCodecs
  if (o.record && typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined") return exportOffline(engine, ep, tl, audio, o);
  const ac = getAudioContext(); await ac.resume();
  const from = o.record ? 0 : Math.max(0, Math.min(o.from ?? 0, tl.total - 0.1));
  const dest = ac.createMediaStreamDestination(), mix = ac.createGain(); mix.connect(dest); mix.connect(ac.destination);
  const t0 = ac.currentTime + 0.3 - from, nodes: AudioScheduledSourceNode[] = [];
  // đường riêng cho giọng đọc → AnalyserNode đo độ lớn để nhân vật nhép miệng
  const voiceBus = ac.createGain(); voiceBus.connect(mix);
  const analyser = ac.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.2; voiceBus.connect(analyser);
  const wave = new Float32Array(analyser.fftSize);
  const voiceLevel = (): number => {
    analyser.getFloatTimeDomainData(wave);
    let sum = 0; for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
    const rms = Math.sqrt(sum / wave.length);
    return Math.min(1, Math.max(0, (rms - 0.012) * 7));
  };
  const play = (buf: AudioBuffer, at: number, gain = 1): GainNode => {
    const n = ac.createBufferSource(), g = ac.createGain(); n.buffer = buf; g.gain.value = gain; n.connect(g); g.connect(voiceBus);
    const when = t0 + at;
    if (when + buf.duration < ac.currentTime) return g;
    if (when >= ac.currentTime) n.start(when); else n.start(ac.currentTime, ac.currentTime - when);
    nodes.push(n); return g;
  };
  if (audio.fullTrack) play(audio.fullTrack, LEAD);
  else audio.perBeat.forEach((b, i) => { if (b) play(b, tl.starts[i]); });
  if (audio.bgm) {
    const n = ac.createBufferSource(), g = ac.createGain(); n.buffer = audio.bgm; n.loop = true; g.gain.value = audio.bgmVolume;
    n.connect(g); g.connect(mix); n.start(ac.currentTime + 0.3, from % audio.bgm.duration); nodes.push(n);
    g.gain.setValueAtTime(audio.bgmVolume, t0 + tl.total - 1.5); g.gain.linearRampToValueAtTime(0, t0 + tl.total);
  }
  let wind: ReturnType<typeof createAmbience> | null = null, rumble: ReturnType<typeof createAmbience> | null = null;
  if (audio.sfx) {
    wind = createAmbience(ac, mix, "wind", 0); rumble = createAmbience(ac, mix, "rumble", 0);
    wind.source.start(); rumble.source.start(); nodes.push(wind.source, rumble.source);
  }

  let rec: MediaRecorder | null = null; const chunks: Blob[] = [];
  const mime = o.record ? pickMime() : "";
  if (o.record) {
    if (!mime) throw new Error("Trình duyệt này không hỗ trợ ghi video. Hãy dùng Chrome hoặc Edge bản mới.");
    const stream = new MediaStream([...engine.out.captureStream(o.fps).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: engine.out.width >= 1920 ? 14_000_000 : 8_000_000, audioBitsPerSecond: 192_000 });
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.start(1000);
  }

  let stopped = false, resolveDone: (b: Blob | null) => void = () => undefined;
  const done = new Promise<Blob | null>(r => { resolveDone = r; });
  const finish = () => {
    if (stopped) return; stopped = true;
    nodes.forEach(n => { try { n.stop(); } catch { /* đã dừng */ } });
    mix.disconnect();
    if (rec) { const r = rec; r.onstop = () => resolveDone(new Blob(chunks, { type: mime.split(";")[0] })); r.stop(); }
    else resolveDone(null);
  };
  const frameInterval = 1 / o.fps; let lastDraw = -1;
  const tick = () => {
    if (stopped) return;
    const t = ac.currentTime - t0;
    if (t - lastDraw >= frameInterval * 0.9 || lastDraw < 0) {
      // beat đang phát có file giọng → dùng độ lớn thật; không có → để trống (nhép theo nhịp âm tiết)
      const bi = Math.max(0, tl.starts.findIndex((s, k) => t >= s && t < s + tl.durs[k]));
      const hasVoice = !!audio.fullTrack || !!audio.perBeat[bi];
      engine.renderAt(ep, tl, Math.max(0, t), { showHud: o.showHud, showSubs: o.showSubs, voiceLevel: hasVoice ? voiceLevel() : undefined }); lastDraw = t;
      if (wind && rumble) {
        const i = Math.max(0, tl.starts.findIndex((s, k) => t >= s && t < s + tl.durs[k])), b = ep.beats[i];
        wind.gain.gain.value = b?.scene === "japanese_street" ? 0.05 : 0;
        rumble.gain.gain.value = b?.scene === "underground_tunnel" ? 0.09 : 0;
      }
      o.onTime?.(t);
    }
    if (t >= tl.total) finish(); else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return { stop: finish, done, mime };
}

/* ───────── Xuất nền: dựng từng khung hình + mã hoá bằng WebCodecs, chạy được khi chuyển sang tab khác ───────── */

const SR = 48000;
/** nhường luồng mà không dùng setTimeout (tab ẩn bị hãm setTimeout, MessageChannel thì không) */
let yieldCh: MessageChannel | null = null; const yieldQ: (() => void)[] = [];
const yieldTask = () => new Promise<void>(r => {
  if (!yieldCh) { yieldCh = new MessageChannel(); yieldCh.port1.onmessage = () => yieldQ.shift()?.(); }
  yieldQ.push(r); yieldCh.port2.postMessage(0);
});

async function videoConfig(w: number, h: number, fps: number): Promise<VideoEncoderConfig> {
  for (const codec of ["avc1.640033", "avc1.640028", "avc1.4d0033", "avc1.42e033"]) {
    const cfg: VideoEncoderConfig = { codec, width: w, height: h, framerate: fps, bitrate: w >= 1920 ? 9_000_000 : 5_000_000, latencyMode: "quality", avc: { format: "avc" } };
    if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg;
  }
  throw new Error("Trình duyệt không mã hoá được H.264. Hãy dùng Chrome hoặc Edge bản mới.");
}

/** trộn toàn bộ âm thanh trước (giọng + nhạc nền + tiếng gió/rung), và riêng đường giọng để nhép miệng */
async function renderAudio(ep: Episode, tl: Timeline, audio: PlaybackAudio): Promise<{ mix: AudioBuffer; voice: Float32Array }> {
  const len = Math.ceil(tl.total * SR) + SR;
  const build = async (voiceOnly: boolean) => {
    const ac = new OfflineAudioContext(voiceOnly ? 1 : 2, len, SR), out = ac.createGain(); out.connect(ac.destination);
    const put = (buf: AudioBuffer, at: number) => { const n = ac.createBufferSource(); n.buffer = buf; n.connect(out); n.start(Math.max(0, at)); };
    if (audio.fullTrack) put(audio.fullTrack, LEAD); else audio.perBeat.forEach((b, i) => { if (b) put(b, tl.starts[i]); });
    if (!voiceOnly && audio.bgm) {
      const n = ac.createBufferSource(), g = ac.createGain(); n.buffer = audio.bgm; n.loop = true; g.gain.value = audio.bgmVolume;
      n.connect(g); g.connect(out); n.start(0);
      g.gain.setValueAtTime(audio.bgmVolume, Math.max(0, tl.total - 1.5)); g.gain.linearRampToValueAtTime(0, tl.total);
    }
    if (!voiceOnly && audio.sfx) {
      const wind = createAmbience(ac, out, "wind", 0), rumble = createAmbience(ac, out, "rumble", 0);
      ep.beats.forEach((b, i) => {
        wind.gain.gain.setValueAtTime(b.scene === "japanese_street" ? 0.05 : 0, tl.starts[i]);
        rumble.gain.gain.setValueAtTime(b.scene === "underground_tunnel" ? 0.09 : 0, tl.starts[i]);
      });
      wind.source.start(0); rumble.source.start(0);
    }
    return ac.startRendering();
  };
  const [mix, voice] = await Promise.all([build(false), build(true)]);
  return { mix, voice: voice.getChannelData(0) };
}

async function exportOffline(engine: StudioEngine, ep: Episode, tl: Timeline, audio: PlaybackAudio, o: PlaybackOptions): Promise<PlaybackHandle> {
  let cancelled = false, resolveDone: (b: Blob | null) => void = () => undefined, rejectDone: (e: unknown) => void = () => undefined;
  const done = new Promise<Blob | null>((res, rej) => { resolveDone = res; rejectDone = rej; });
  const run = async () => {
    await engine.ready;
    const W = engine.out.width, H = engine.out.height, fps = o.fps;
    const vcfg = await videoConfig(W, H, fps);
    let acodec: "aac" | "opus" = "aac";
    let acfg: AudioEncoderConfig = { codec: "mp4a.40.2", sampleRate: SR, numberOfChannels: 2, bitrate: 192_000 };
    if (!(await AudioEncoder.isConfigSupported(acfg)).supported) { acodec = "opus"; acfg = { codec: "opus", sampleRate: SR, numberOfChannels: 2, bitrate: 192_000 }; }
    const { mix, voice } = await renderAudio(ep, tl, audio);

    const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: "avc", width: W, height: H, frameRate: fps }, audio: { codec: acodec, numberOfChannels: 2, sampleRate: SR }, fastStart: false, firstTimestampBehavior: "offset" });
    let err: unknown = null;
    const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { err = e; } });
    venc.configure(vcfg);
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => { err = e; } });
    aenc.configure(acfg);

    // âm thanh: chia khối 1024 mẫu
    const total = Math.min(mix.length, Math.ceil(tl.total * SR)), L = mix.getChannelData(0), R = mix.getChannelData(1);
    for (let s = 0; s < total && !cancelled; s += 1024) {
      const n = Math.min(1024, total - s), data = new Float32Array(n * 2);
      data.set(L.subarray(s, s + n), 0); data.set(R.subarray(s, s + n), n);
      const ad = new AudioData({ format: "f32-planar", sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((s / SR) * 1e6), data });
      aenc.encode(ad); ad.close();
      if (aenc.encodeQueueSize > 64) await yieldTask();
    }

    // độ lớn giọng tại giây t (giống AnalyserNode lúc phát: cửa sổ 1024 mẫu ngay trước t)
    const level = (t: number): number => {
      const e = Math.min(voice.length, Math.floor(t * SR)), b = Math.max(0, e - 1024); if (e <= b) return 0;
      let sum = 0; for (let i = b; i < e; i++) sum += voice[i] * voice[i];
      return Math.min(1, Math.max(0, (Math.sqrt(sum / (e - b)) - 0.012) * 7));
    };

    const frames = Math.ceil(tl.total * fps), dur = Math.round(1e6 / fps);
    for (let i = 0; i < frames && !cancelled; i++) {
      if (err) throw err;
      const t = i / fps;
      const bi = Math.max(0, tl.starts.findIndex((s, k) => t >= s && t < s + tl.durs[k]));
      const hasVoice = !!audio.fullTrack || !!audio.perBeat[bi];
      engine.renderAt(ep, tl, t, { showHud: o.showHud, showSubs: o.showSubs, voiceLevel: hasVoice ? level(t) : undefined });
      const vf = new VideoFrame(engine.out, { timestamp: i * dur, duration: dur });
      venc.encode(vf, { keyFrame: i % (fps * 2) === 0 }); vf.close();
      while (venc.encodeQueueSize > 6) await yieldTask();
      if (i % 5 === 0) { o.onTime?.(t); await yieldTask(); }
    }
    if (cancelled) { venc.close(); aenc.close(); resolveDone(null); return; }
    await venc.flush(); await aenc.flush();
    if (err) throw err;
    muxer.finalize();
    o.onTime?.(tl.total);
    resolveDone(new Blob([(muxer.target as ArrayBufferTarget).buffer], { type: "video/mp4" }));
  };
  // giữ khoá Web Lock trong lúc xuất: Chrome không "đóng băng" tab đang giữ khoá
  const job = () => run().catch(e => rejectDone(e));
  if (navigator.locks) void navigator.locks.request("kai-3d-export", () => job()); else void job();
  return { stop: () => { cancelled = true; }, done, mime: "video/mp4" };
}
