/*
  Giọng Nhật miễn phí chạy trên máy của bạn: VOICEVOX hoặc AivisSpeech.
  Cả hai đều miễn phí, được dùng cho video kiếm tiền (ghi credit trong mô tả video),
  và có cùng kiểu API: POST /audio_query → POST /synthesis → file WAV.
  Trình duyệt gọi thẳng tới app trên máy (127.0.0.1), không đi qua server Vercel.
*/
export type LocalEngine = "voicevox" | "aivis";

export const LOCAL_ENGINES: Record<LocalEngine, { label: string; url: string; credit: string; download: string }> = {
  voicevox: { label: "VOICEVOX", url: "http://127.0.0.1:50021", credit: "VOICEVOX", download: "https://voicevox.hiroshiba.jp/" },
  aivis: { label: "AivisSpeech", url: "http://127.0.0.1:10101", credit: "AivisSpeech", download: "https://aivis-project.com/" },
};

export interface LocalSpeaker {
  /** id giọng (style id) dùng cho /audio_query và /synthesis */
  id: number;
  /** tên nhân vật, dùng để ghi credit */
  character: string;
  /** kiểu giọng: ノーマル, ささやき… */
  style: string;
}

const clean = (base: string) => base.trim().replace(/\/+$/, "");

function connectError(base: string): Error {
  const origin = typeof location !== "undefined" ? location.origin : "trang này";
  return new Error(
    `Không kết nối được tới ${base}. Kiểm tra:\n` +
    `1) App VOICEVOX / AivisSpeech đang mở trên máy (không cần bấm gì trong app).\n` +
    `2) Đã cho phép trang này: mở ${base}/setting → mục CORS (許可するオリジン) thêm ${origin} → 保存 → tắt app mở lại.\n` +
    `3) Nếu Chrome hỏi "truy cập thiết bị trong mạng nội bộ" thì bấm Cho phép.`,
  );
}

async function call(url: string, init?: RequestInit): Promise<Response> {
  let r: Response;
  try { r = await fetch(url, init); } catch { throw connectError(new URL(url).origin); }
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`Giọng trên máy báo lỗi ${r.status}: ${detail.slice(0, 200)}`);
  }
  return r;
}

/** danh sách giọng (mỗi nhân vật × mỗi kiểu giọng) */
export async function listLocalSpeakers(base: string): Promise<LocalSpeaker[]> {
  const r = await call(`${clean(base)}/speakers`);
  const data = (await r.json()) as { name: string; styles: { name: string; id: number }[] }[];
  return data.flatMap(sp => sp.styles.map(st => ({ id: st.id, character: sp.name, style: st.name })));
}

/** tạo giọng cho 1 câu, trả về file WAV */
export async function synthLocal(base: string, speaker: number, text: string, speed: number): Promise<ArrayBuffer> {
  const b = clean(base);
  const q = await call(`${b}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`, { method: "POST" });
  const query = (await q.json()) as Record<string, unknown>;
  query.speedScale = Math.min(1.5, Math.max(0.5, speed || 1));
  // bớt khoảng lặng đầu / cuối: app đã tự chèn 0,3s nghỉ giữa các beat
  query.prePhonemeLength = 0.05;
  query.postPhonemeLength = 0.05;
  query.outputSamplingRate = 44100;
  const s = await call(`${b}/synthesis?speaker=${speaker}`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "audio/wav" }, body: JSON.stringify(query),
  });
  const data = await s.arrayBuffer();
  if (data.byteLength < 1000) throw new Error("Giọng trên máy trả về âm thanh rỗng");
  return data;
}

/** dòng credit bắt buộc ghi trong mô tả video, ví dụ "VOICEVOX:青山龍星" */
export const localCredit = (engine: LocalEngine, character: string) =>
  `${LOCAL_ENGINES[engine].credit}:${character || "(tên nhân vật)"}`;

/** loại file âm thanh theo phần đầu file (WAV của VOICEVOX hay MP3) */
export const audioMime = (data: ArrayBuffer) => {
  const h = new Uint8Array(data, 0, Math.min(4, data.byteLength));
  return h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 ? "audio/wav" : "audio/mpeg";
};
