"use client";
/**
 * Outbox offline: request ghi chưa gửi được (mất mạng / server 5xx) được lưu vào IndexedDB
 * và gửi lại THEO ĐÚNG THỨ TỰ khi có mạng. Mỗi request mang opId nên server tự bỏ bản trùng.
 */
const DB = "cbcc";
const STORE = "outbox";

export interface OutboxItem {
  seq?: number;
  url: string;
  body: unknown;
  createdAt: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "seq", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const enqueue = (item: Omit<OutboxItem, "seq" | "createdAt">) =>
  tx("readwrite", (s) => s.add({ ...item, createdAt: new Date().toISOString() }));

export const pending = () => tx<OutboxItem[]>("readonly", (s) => s.getAll() as IDBRequest<OutboxItem[]>);

const remove = (seq: number) => tx("readwrite", (s) => s.delete(seq));

let flushing: Promise<number> | null = null;

/** Gửi lần lượt. Dừng ở lỗi mạng/5xx (giữ thứ tự); 4xx = request hỏng vĩnh viễn => bỏ. Trả về số còn lại. */
export function flush(): Promise<number> {
  flushing ??= (async () => {
    try {
      for (const item of await pending()) {
        let res: Response;
        try {
          res = await fetch(item.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(item.body) });
        } catch {
          break;
        }
        if (res.status >= 500) break;
        await remove(item.seq!);
      }
      return (await pending()).length;
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/** Thử POST ngay; mất mạng thì xếp vào outbox. Trả về Response hoặc null nếu đã xếp hàng. */
export async function postOrQueue(url: string, body: unknown): Promise<Response | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueue({ url, body });
    return null;
  }
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.status >= 500) {
      await enqueue({ url, body });
      return null;
    }
    return res;
  } catch {
    await enqueue({ url, body });
    return null;
  }
}
