/*
  Lưu giọng đã tạo vào IndexedDB của trình duyệt để tải lại trang không bị mất
  (localStorage quá nhỏ cho file MP3). Mỗi beat lưu kèm lời đọc lúc tạo giọng:
  nếu lời đọc đã đổi thì giọng cũ bị bỏ qua khi nạp lại.
*/
const DB_NAME = "kai3d.audio", STORE = "beats", VERSION = 1;
export const FULL_TRACK_KEY = "__full_track__";

export interface StoredAudio {
  data: ArrayBuffer;
  source: "edge" | "eleven" | "upload";
  /** lời đọc tiếng Nhật lúc tạo giọng (beat) hoặc chữ ký cả bài (file cả bài) */
  text: string;
  /** chỉ dùng cho file cả bài: các mốc ngắt câu */
  bounds?: number[];
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, mode), req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = tx.onabort = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}

export const putAudio = (key: string, v: StoredAudio) => run("readwrite", s => s.put(v, key)).then(() => undefined);
export const deleteAudio = (keys: string[]) => run("readwrite", s => { keys.forEach(k => s.delete(k)); }).then(() => undefined);
export const clearAudio = () => run("readwrite", s => s.clear()).then(() => undefined);

export async function loadAllAudio(): Promise<Record<string, StoredAudio>> {
  const db = await openDb();
  if (!db) return {};
  return new Promise(resolve => {
    const out: Record<string, StoredAudio> = {};
    try {
      const tx = db.transaction(STORE, "readonly"), req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out[String(c.key)] = c.value as StoredAudio; c.continue(); } };
      tx.oncomplete = () => resolve(out);
      tx.onerror = tx.onabort = () => resolve(out);
    } catch { resolve(out); }
  });
}

/** chữ ký lời đọc cả bài, để biết file cả bài còn khớp kịch bản không */
export const narrationSignature = (narrations: string[]) => narrations.join("\u0001");
