export type VoiceMode = "edge" | "eleven" | "upload";

export interface VoiceSettings {
  mode: VoiceMode;
  edgeVoice: "ja-JP-KeitaNeural" | "ja-JP-NanamiNeural";
  speed: number;
  elevenKey: string;
  elevenVoice: string;
  elevenModel: string;
  /** mật khẩu studio (chỉ cần khi server đặt STUDIO_PASSWORD) */
  studioPassword?: string;
}

export interface BeatAudio { buffer: AudioBuffer; url: string; source: "edge" | "eleven" | "upload" }

export const DEFAULT_VOICE: VoiceSettings = {
  mode: "edge",
  edgeVoice: "ja-JP-KeitaNeural",
  speed: 1,
  elevenKey: "",
  elevenVoice: "l3wUf9BndyIs5OPGxQB4", // Subaru – Calm & Deep Narration
  elevenModel: "eleven_multilingual_v2",
};
