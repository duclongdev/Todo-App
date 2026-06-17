// filesync.js — Đồng bộ dữ liệu với một file .json thật trên máy
// Dùng File System Access API (Chrome/Edge). Tự lưu khi thay đổi & khi đóng app,
// tự nạp lại khi mở app. Lưu "tay cầm" file trong IndexedDB để nhớ qua các phiên.
window.FileSync = (function () {
  const supported = "showSaveFilePicker" in window && "showOpenFilePicker" in window;
  const IDB_DB = "life-hub-fs";
  const IDB_STORE = "handles";
  let handle = null;
  let saveTimer = null;
  let needPermission = false;

  // ---- IndexedDB nhỏ gọn để lưu file handle ----
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
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
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

  async function ensurePermission(mode) {
    if (!handle) return false;
    const opts = { mode };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    if ((await handle.requestPermission(opts)) === "granted") return true;
    return false;
  }

  async function save() {
    if (!handle) return;
    try {
      if (!(await ensurePermission("readwrite"))) { needPermission = true; return; }
      const w = await handle.createWritable();
      await w.write(Store.export());
      await w.close();
      needPermission = false;
    } catch (e) { /* im lặng, vẫn còn localStorage */ }
  }

  async function load() {
    if (!handle) return false;
    try {
      if (!(await ensurePermission("read"))) { needPermission = true; return false; }
      const f = await handle.getFile();
      const txt = await f.text();
      if (txt && txt.trim()) {
        Store.import(JSON.parse(txt), true); // silent: không ghi ngược
        needPermission = false;
        return true;
      }
    } catch (e) {}
    return false;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 600);
  }

  // Tạo file mới để lưu
  async function connectNew() {
    if (!supported) { U.toast("Trình duyệt không hỗ trợ lưu file. Dữ liệu vẫn lưu trong trình duyệt.", "err"); return false; }
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: "life-hub-data.json",
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      });
      await idbSet("data", handle);
      await save();
      U.toast("Đã kết nối file dữ liệu ✓");
      return true;
    } catch (e) { return false; }
  }

  // Mở file có sẵn (và nạp dữ liệu từ đó)
  async function openExisting() {
    if (!supported) { U.toast("Trình duyệt không hỗ trợ.", "err"); return false; }
    try {
      [handle] = await window.showOpenFilePicker({
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      });
      await idbSet("data", handle);
      const ok = await load();
      if (ok) { App.applyTheme(); App.rerender(); U.toast("Đã nạp dữ liệu từ file ✓"); }
      return true;
    } catch (e) { return false; }
  }

  async function disconnect() {
    handle = null;
    await idbDel("data");
    U.toast("Đã ngắt kết nối file");
  }

  async function init() {
    if (!supported) return;
    try { handle = (await idbGet("data")) || null; } catch (_) { handle = null; }

    // Đăng ký lưu khi dữ liệu đổi & khi đóng/ẩn app
    Store.onChange(scheduleSave);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") save(); });
    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);

    if (handle) {
      const ok = await load();
      if (ok) { App.applyTheme(); App.rerender(); }
      else if (needPermission) {
        // Quyền cần thao tác người dùng -> nạp ở lần click đầu tiên
        const once = async () => {
          document.removeEventListener("pointerdown", once);
          const done = await load();
          if (done) { App.applyTheme(); App.rerender(); U.toast("Đã nạp dữ liệu từ file ✓"); }
        };
        document.addEventListener("pointerdown", once, { once: true });
        U.toast("Bấm vào màn hình để nạp dữ liệu từ file đã lưu", "ok");
      }
    }
  }

  return {
    init, connectNew, openExisting, disconnect, save,
    get connected() { return !!handle; },
    get name() { return handle ? handle.name : ""; },
    get supported() { return supported; },
  };
})();
