import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../components/Toast.jsx";

const SUPPORTED = "showSaveFilePicker" in window && "showOpenFilePicker" in window;
const IDB_DB = "life-hub-fs";
const IDB_STORE = "handles";

// ---- IndexedDB nhỏ gọn để nhớ "tay cầm" file qua các phiên ----
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbSet(key, val) {
  const d = await idb();
  return new Promise((res, rej) => {
    const tx = d.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(key) {
  const d = await idb();
  return new Promise((res, rej) => {
    const tx = d.transaction(IDB_STORE, "readonly");
    const rq = tx.objectStore(IDB_STORE).get(key);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function idbDel(key) {
  const d = await idb();
  return new Promise((res) => {
    const tx = d.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = res;
  });
}

/**
 * useFileSync — đồng bộ dữ liệu với một file .json thật trên máy
 * (File System Access API). Tự lưu khi dữ liệu đổi & khi đóng app, tự nạp khi mở.
 */
export function useFileSync() {
  const store = useStore();
  const toast = useToast();
  const { db, dbRef, suppressSaveRef, replace, exportJSON } = store;

  const handleRef = useRef(null);
  const saveTimerRef = useRef(null);
  const didMountRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState("");

  const syncMeta = () => {
    setConnected(!!handleRef.current);
    setName(handleRef.current ? handleRef.current.name : "");
  };

  const ensurePermission = useCallback(async (mode) => {
    const handle = handleRef.current;
    if (!handle) return false;
    const opts = { mode };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    if ((await handle.requestPermission(opts)) === "granted") return true;
    return false;
  }, []);

  const save = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return;
    try {
      if (!(await ensurePermission("readwrite"))) return;
      const w = await handle.createWritable();
      await w.write(exportJSON());
      await w.close();
    } catch {
      /* im lặng — dữ liệu vẫn còn trong localStorage */
    }
  }, [ensurePermission, exportJSON]);

  const load = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return false;
    try {
      if (!(await ensurePermission("read"))) return false;
      const f = await handle.getFile();
      const txt = await f.text();
      if (txt && txt.trim()) {
        replace(JSON.parse(txt), true); // silent: không ghi ngược lại file
        return true;
      }
    } catch {
      /* bỏ qua */
    }
    return false;
  }, [ensurePermission, replace]);

  const connectNew = useCallback(async () => {
    if (!SUPPORTED) {
      toast("Trình duyệt không hỗ trợ lưu file. Dữ liệu vẫn lưu trong trình duyệt.", "err");
      return false;
    }
    try {
      handleRef.current = await window.showSaveFilePicker({
        suggestedName: "life-hub-data.json",
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      });
      await idbSet("data", handleRef.current);
      await save();
      syncMeta();
      toast("Đã kết nối file dữ liệu ✓");
      return true;
    } catch {
      return false;
    }
  }, [save, toast]);

  const openExisting = useCallback(async () => {
    if (!SUPPORTED) {
      toast("Trình duyệt không hỗ trợ.", "err");
      return false;
    }
    try {
      [handleRef.current] = await window.showOpenFilePicker({
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      });
      await idbSet("data", handleRef.current);
      syncMeta();
      if (await load()) toast("Đã nạp dữ liệu từ file ✓");
      return true;
    } catch {
      return false;
    }
  }, [load, toast]);

  const disconnect = useCallback(async () => {
    handleRef.current = null;
    await idbDel("data");
    syncMeta();
    toast("Đã ngắt kết nối file");
  }, [toast]);

  // Nạp handle đã lưu khi mở app + đăng ký lưu lúc đóng/ẩn trang.
  useEffect(() => {
    if (!SUPPORTED) return;
    let cancelled = false;

    (async () => {
      try {
        handleRef.current = (await idbGet("data")) || null;
      } catch {
        handleRef.current = null;
      }
      if (cancelled) return;
      syncMeta();
      if (handleRef.current) {
        const ok = await load();
        if (!ok) {
          // Quyền cần thao tác người dùng -> nạp ở lần bấm đầu tiên.
          const once = async () => {
            document.removeEventListener("pointerdown", once);
            if (await load()) toast("Đã nạp dữ liệu từ file ✓");
          };
          document.addEventListener("pointerdown", once, { once: true });
        }
      }
    })();

    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
      window.removeEventListener("beforeunload", save);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tự lưu (debounce) mỗi khi dữ liệu thay đổi — trừ lần mount & lần vừa nạp file.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (suppressSaveRef.current) {
      suppressSaveRef.current = false;
      return;
    }
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(save, 600);
    return () => clearTimeout(saveTimerRef.current);
  }, [db, save, suppressSaveRef]);

  return { connected, name, supported: SUPPORTED, connectNew, openExisting, disconnect, save };
}
