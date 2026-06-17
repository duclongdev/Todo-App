import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { DB_KEY, defaultDB, loadDB, migrate } from "./db.js";
import { uid } from "../lib/utils.js";

const StoreContext = createContext(null);

/**
 * StoreProvider — toàn bộ dữ liệu app nằm trong React state (useState).
 * Mọi thay đổi đi qua `update(fn)`: ta clone state, áp dụng mutator (giữ
 * nguyên phong cách mutate của bản gốc), rồi setState — React tự render lại.
 */
export function StoreProvider({ children }) {
  const [db, setDb] = useState(loadDB);

  // Ref luôn trỏ tới state mới nhất — phục vụ FileSync đọc dữ liệu hiện hành.
  const dbRef = useRef(db);
  dbRef.current = db;

  // Khi nạp dữ liệu từ file, bỏ qua một lần auto-save để tránh ghi ngược.
  const suppressSaveRef = useRef(false);

  const persist = (next) => localStorage.setItem(DB_KEY, JSON.stringify(next));

  const update = useCallback((fn) => {
    setDb((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      persist(draft);
      return draft;
    });
  }, []);

  const set = useCallback((key, val) => update((d) => (d[key] = val)), [update]);

  const log = useCallback(
    (type, detail) =>
      update((d) => {
        d.activity.push({ id: uid(), ts: Date.now(), type, detail: detail || "" });
        if (d.activity.length > 4000) d.activity = d.activity.slice(-4000);
      }),
    [update]
  );

  // Thay toàn bộ dữ liệu (dùng cho nhập file / nạp từ file đồng bộ).
  const replace = useCallback((obj, silent) => {
    setDb(() => {
      const next = migrate(Object.assign(defaultDB(), obj));
      persist(next);
      if (silent) suppressSaveRef.current = true;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setDb(() => {
      const next = defaultDB();
      persist(next);
      return next;
    });
  }, []);

  const exportJSON = useCallback(() => JSON.stringify(dbRef.current, null, 2), []);

  const value = useMemo(
    () => ({ db, dbRef, suppressSaveRef, update, set, log, replace, reset, exportJSON }),
    [db, update, set, log, replace, reset, exportJSON]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
}
