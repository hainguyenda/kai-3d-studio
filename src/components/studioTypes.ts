import type { LocalEngine } from "@/lib/localVoice";

export type VoiceMode = "local" | "edge" | "eleven" | "upload";

export interface VoiceSettings {
  mode: VoiceMode;
  edgeVoice: "ja-JP-KeitaNeural" | "ja-JP-NanamiNeural";
  speed: number;
  elevenKey: string;
  elevenVoice: string;
  elevenModel: string;
  /** VOICEVOX / AivisSpeech chạy trên máy */
  localEngine: LocalEngine;
  localUrl: string;
  /** id kiểu giọng (style id) */
  localSpeaker: number;
  /** tên nhân vật – để ghi credit trong mô tả */
  localCharacter: string;
  localStyle: string;
  /** mật khẩu studio (chỉ cần khi server đặt STUDIO_PASSWORD) */
  studioPassword?: string;
}

export interface BeatAudio { buffer: AudioBuffer; url: string; source: "voicevox" | "edge" | "eleven" | "upload" }

export const DEFAULT_VOICE: VoiceSettings = {
  mode: "edge",
  edgeVoice: "ja-JP-KeitaNeural",
  speed: 1,
  elevenKey: "",
  elevenVoice: "l3wUf9BndyIs5OPGxQB4", // Subaru – Calm & Deep Narration
  elevenModel: "eleven_multilingual_v2",
  localEngine: "voicevox",
  localUrl: "http://127.0.0.1:50021",
  localSpeaker: 13, // VOICEVOX 青山龍星 ノーマル – giọng nam trầm, hợp giải thích khoa học
  localCharacter: "青山龍星",
  localStyle: "ノーマル",
};
