"use client";
import type { RefObject } from "react";
import type { CharacterId } from "@/lib/types";

interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  ready: boolean;
  loadingText: string;
  playing: boolean;
  time: number;
  total: number;
  showHud: boolean;
  showSubs: boolean;
  onPlay(): void;
  onPause(): void;
  onSeek(t: number): void;
  onHud(v: boolean): void;
  onSubs(v: boolean): void;
  beatLabel: string;
  character: CharacterId;
  onCharacter(id: CharacterId): void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function PreviewPanel({ canvasRef, ready, loadingText, playing, time, total, showHud, showSubs, onPlay, onPause, onSeek, onHud, onSubs, beatLabel, character, onCharacter }: Props) {
  return (
    <section className="panel">
      <h2 className="panel-title">2. Màn hình xem trước (16:9)</h2>
      <div className="relative overflow-hidden rounded-lg bg-black">
        <canvas ref={canvasRef} className="block aspect-video w-full" />
        {!ready && <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-studio-muted">{loadingText}</div>}
      </div>
      <input type="range" min={0} max={Math.max(0.1, total)} step={0.01} value={Math.min(time, total)} className="mt-2 w-full" disabled={!ready} onChange={e => onSeek(Number(e.target.value))} />
      <div className="flex flex-wrap items-center gap-3">
        {playing ? <button className="btn" onClick={onPause}>⏸ Dừng</button> : <button className="btn" disabled={!ready} onClick={onPlay}>▶ Phát</button>}
        <span className="font-mono text-sm text-studio-muted">{fmt(time)} / {fmt(total)}</span>
        <span className="text-xs text-studio-muted">{beatLabel}</span>
        <label className="ml-auto flex items-center gap-1 text-sm">Nhân vật
          <select className="input w-auto py-1 text-sm" value={character} onChange={e => onCharacter(e.target.value as CharacterId)}>
            <option value="nv2">Kai-kun (mặc định)</option>
            <option value="nv1">NV1 – cũ</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={showHud} onChange={e => onHud(e.target.checked)} /> HUD</label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={showSubs} onChange={e => onSubs(e.target.checked)} /> Phụ đề</label>
      </div>
    </section>
  );
}
