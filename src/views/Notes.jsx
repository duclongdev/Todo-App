import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../store/StoreContext.jsx";
import PageHead from "../components/PageHead.jsx";
import { uid } from "../lib/utils.js";

const TYPES = [
  { type: "text", icon: "¶", label: "Văn bản", hint: "Đoạn văn thường", kw: "text van ban paragraph p" },
  { type: "h1", icon: "H₁", label: "Tiêu đề 1", hint: "Lớn", kw: "h1 heading tieu de lon" },
  { type: "h2", icon: "H₂", label: "Tiêu đề 2", hint: "Vừa", kw: "h2 heading tieu de" },
  { type: "h3", icon: "H₃", label: "Tiêu đề 3", hint: "Nhỏ", kw: "h3 heading tieu de nho" },
  { type: "bullet", icon: "•", label: "Danh sách", hint: "Gạch đầu dòng", kw: "bullet list danh sach" },
  { type: "number", icon: "1.", label: "Danh sách số", hint: "Đánh số", kw: "number list so danh sach" },
  { type: "todo", icon: "☑", label: "To-do", hint: "Ô đánh dấu", kw: "todo checkbox check viec" },
  { type: "toggle", icon: "▸", label: "Toggle", hint: "Thu gọn được", kw: "toggle thu gon collapse" },
  { type: "quote", icon: "❝", label: "Trích dẫn", hint: "Quote", kw: "quote trich dan" },
  { type: "divider", icon: "―", label: "Đường kẻ", hint: "Phân cách", kw: "divider duong ke line hr" },
];
const LIST_TYPES = ["bullet", "number", "todo"];

const placeholderOf = (b) =>
  b.type === "h1"
    ? "Tiêu đề 1"
    : b.type === "h2"
    ? "Tiêu đề 2"
    : b.type === "h3"
    ? "Tiêu đề 3"
    : b.type === "quote"
    ? "Trích dẫn"
    : b.type === "toggle"
    ? "Toggle"
    : "Gõ '/' để chọn kiểu, hoặc nhập văn bản...";

const previewOf = (n) => (n.blocks || []).map((b) => b.text).filter(Boolean).join(" · ").slice(0, 90);

// ===================== LIST MODE =====================
function NotesList({ onOpen, onCreate }) {
  const { db, update } = useStore();
  const [query, setQuery] = useState("");

  let notes = [...db.notes];
  if (query.trim()) {
    const q = query.toLowerCase();
    notes = notes.filter((n) => (n.title + " " + previewOf(n)).toLowerCase().includes(q));
  }
  notes.sort((a, b) => b.pinned - a.pinned || b.updatedAt - a.updatedAt);

  const togglePin = (id) =>
    update((d) => {
      const x = d.notes.find((m) => m.id === id);
      if (x) x.pinned = !x.pinned;
    });
  const remove = (id) => {
    if (!confirm("Xóa ghi chú này?")) return;
    update((d) => (d.notes = d.notes.filter((m) => m.id !== id)));
  };

  return (
    <>
      <PageHead
        title="📝 Ghi chú"
        subtitle={'Soạn thảo dạng block — gõ "/" để thêm tiêu đề, to-do, toggle, trích dẫn...'}
      />
      <div className="row" style={{ marginBottom: 16 }}>
        <input
          className="input"
          placeholder="🔍 Tìm ghi chú..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={{ flex: "0 0 auto" }}>
          <button className="btn" onClick={onCreate}>
            ＋ Ghi chú mới
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="empty">{query ? "Không tìm thấy ghi chú." : "Chưa có ghi chú nào."}</p>
      ) : (
        <div className="grid grid--2">
          {notes.map((n) => (
            <div className="card notecard" key={n.id} style={{ cursor: "pointer" }} onClick={() => onOpen(n.id)}>
              <div className="notecard__title">{n.title || "(không tiêu đề)"}</div>
              <div className="notecard__body">{previewOf(n) || "Trống"}</div>
              <div className="notecard__foot">
                <span className="item__sub">{new Date(n.updatedAt).toLocaleDateString("vi-VN")}</span>
                <div>
                  <button
                    className="icon-btn"
                    title="Ghim"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(n.id);
                    }}
                  >
                    {n.pinned ? "📌" : "📍"}
                  </button>
                  <button
                    className="icon-btn"
                    title="Xóa"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(n.id);
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ===================== EDIT MODE =====================
function NotesEditor({ noteId, onBack }) {
  const { db, update, log } = useStore();
  const note = db.notes.find((n) => n.id === noteId);

  const inputRefs = useRef({}); // blockId -> input element
  const [focusReq, setFocusReq] = useState(null); // { id, caret? }
  const [slash, setSlash] = useState(null); // { blockId, query, active }

  // Đưa con trỏ tới block vừa tạo/gộp.
  useLayoutEffect(() => {
    if (!focusReq) return;
    const node = inputRefs.current[focusReq.id];
    if (node) {
      node.focus();
      const pos = focusReq.caret == null ? node.value.length : focusReq.caret;
      node.setSelectionRange(pos, pos);
    }
    setFocusReq(null);
  }, [focusReq]);

  if (!note) {
    onBack();
    return null;
  }

  const touch = (d) => {
    const n = d.notes.find((x) => x.id === noteId);
    if (n) n.updatedAt = Date.now();
  };
  const mutate = (fn) =>
    update((d) => {
      const n = d.notes.find((x) => x.id === noteId);
      if (n) {
        fn(n);
        n.updatedAt = Date.now();
      }
    });

  const setTitle = (val) => mutate((n) => (n.title = val));

  const setBlockText = (blockId, val, caret) => {
    mutate((n) => {
      const b = n.blocks.find((x) => x.id === blockId);
      if (b) b.text = val;
    });
    // Phát hiện slash menu: "/" + từ khóa ngay trước con trỏ.
    const before = caret == null ? val : val.slice(0, caret);
    const m = before.match(/(?:^|\s)\/([\p{L}\w]*)$/u);
    if (m) setSlash({ blockId, query: m[1], active: 0 });
    else setSlash(null);
  };

  const setBlockField = (blockId, patch) =>
    mutate((n) => {
      const b = n.blocks.find((x) => x.id === blockId);
      if (b) Object.assign(b, patch);
    });

  const removeBlock = (blockId) =>
    mutate((n) => {
      if (n.blocks.length <= 1) {
        n.blocks[0].text = "";
        n.blocks[0].type = "text";
      } else {
        n.blocks = n.blocks.filter((x) => x.id !== blockId);
      }
    });

  // Enter: tách block tại con trỏ.
  const splitBlock = (block, caret) => {
    const before = block.text.slice(0, caret);
    const after = block.text.slice(caret);
    if (!before && LIST_TYPES.includes(block.type)) {
      setBlockField(block.id, { type: "text" });
      setFocusReq({ id: block.id });
      return;
    }
    const carry = LIST_TYPES.includes(block.type) ? block.type : "text";
    const nb = { id: uid(), type: carry, text: after, checked: false };
    mutate((n) => {
      const b = n.blocks.find((x) => x.id === block.id);
      b.text = before;
      const idx = n.blocks.indexOf(b);
      n.blocks.splice(idx + 1, 0, nb);
    });
    setFocusReq({ id: nb.id, caret: 0 });
  };

  // Backspace ở đầu block: hạ kiểu hoặc gộp với block trước.
  const backspaceAtStart = (block) => {
    if (block.type !== "text") {
      setBlockField(block.id, { type: "text" });
      setFocusReq({ id: block.id, caret: 0 });
      return;
    }
    const idx = note.blocks.indexOf(note.blocks.find((x) => x.id === block.id));
    if (idx <= 0) return;
    const prev = note.blocks[idx - 1];
    if (prev.type === "divider") {
      mutate((n) => n.blocks.splice(idx - 1, 1));
      setFocusReq({ id: block.id, caret: 0 });
      return;
    }
    const caret = (prev.text || "").length;
    mutate((n) => {
      const p = n.blocks[idx - 1];
      const cur = n.blocks[idx];
      p.text = (p.text || "") + cur.text;
      n.blocks.splice(idx, 1);
    });
    setFocusReq({ id: prev.id, caret });
  };

  // Chọn kiểu từ slash menu.
  const filteredTypes = (q) => {
    const ql = (q || "").toLowerCase();
    return TYPES.filter((t) => !ql || (t.label + " " + t.kw).toLowerCase().includes(ql));
  };

  const selectType = (block, item) => {
    setSlash(null);
    // Bỏ phần "/query" trong text trước con trỏ.
    const node = inputRefs.current[block.id];
    const caret = node ? node.selectionStart : block.text.length;
    const before = block.text.slice(0, caret).replace(/(?:^|\s)\/[\p{L}\w]*$/u, (mm) => (mm[0] === " " ? " " : ""));
    const after = block.text.slice(caret);

    if (item.type === "divider") {
      const nb = { id: uid(), type: "text", text: "" };
      mutate((n) => {
        const b = n.blocks.find((x) => x.id === block.id);
        b.type = "divider";
        b.text = "";
        const idx = n.blocks.indexOf(b);
        n.blocks.splice(idx + 1, 0, nb);
      });
      setFocusReq({ id: nb.id });
    } else {
      mutate((n) => {
        const b = n.blocks.find((x) => x.id === block.id);
        b.text = before + after;
        b.type = item.type;
        if (item.type === "todo" && b.checked === undefined) b.checked = false;
        if (item.type === "toggle") {
          b.collapsed = false;
          if (b.content === undefined) b.content = "";
        }
      });
      setFocusReq({ id: block.id });
    }
    log("note_save", "Thêm block: " + item.label);
  };

  const onBlockKeyDown = (e, block) => {
    const node = e.target;
    if (slash && slash.blockId === block.id) {
      const items = filteredTypes(slash.query);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlash((s) => ({ ...s, active: (s.active + 1) % Math.max(1, items.length) }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlash((s) => ({ ...s, active: (s.active - 1 + items.length) % Math.max(1, items.length) }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (items[slash.active]) selectType(block, items[slash.active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      splitBlock(block, node.selectionStart);
    } else if (e.key === "Backspace" && node.selectionStart === 0 && node.selectionEnd === 0) {
      const idx = note.blocks.findIndex((x) => x.id === block.id);
      if (block.type !== "text" || idx > 0) {
        e.preventDefault();
        backspaceAtStart(block);
      }
    }
  };

  // Đánh số cho block "number".
  let numCount = 0;

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <button
          className="btn btn--sm btn--ghost"
          onClick={() => {
            setSlash(null);
            onBack();
          }}
        >
          ← Tất cả ghi chú
        </button>
      </div>

      <div className="card">
        <input
          className="input"
          placeholder="Tiêu đề ghi chú"
          value={note.title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ fontSize: "1.4rem", fontWeight: 800, border: "none", padding: "6px 2px", boxShadow: "none" }}
        />
        <div className="blocks">
          {note.blocks.map((b) => {
            if (b.type === "number") numCount++;
            else numCount = 0;

            if (b.type === "divider") {
              return (
                <div className="block block--divider" key={b.id}>
                  <button className="icon-btn block__handle" title="Xóa block" onClick={() => removeBlock(b.id)}>
                    ⋮⋮
                  </button>
                  <hr className="block__divider" />
                </div>
              );
            }

            const items = slash && slash.blockId === b.id ? filteredTypes(slash.query) : null;

            return (
              <div className={"block block--" + b.type} key={b.id} style={{ position: "relative" }}>
                <button className="icon-btn block__handle" title="Xóa block" onClick={() => removeBlock(b.id)}>
                  ⋮⋮
                </button>
                {b.type === "bullet" && <span className="block__bullet">•</span>}
                {b.type === "number" && <span className="block__bullet">{numCount}.</span>}
                {b.type === "todo" && (
                  <input
                    type="checkbox"
                    className="check"
                    style={{ flex: "0 0 20px", height: 20 }}
                    checked={!!b.checked}
                    onChange={(e) => setBlockField(b.id, { checked: e.target.checked })}
                  />
                )}
                {b.type === "toggle" && (
                  <button
                    className="block__toggle-btn"
                    onClick={() => setBlockField(b.id, { collapsed: !b.collapsed })}
                  >
                    {b.collapsed ? "▸" : "▾"}
                  </button>
                )}

                <input
                  ref={(node) => {
                    if (node) inputRefs.current[b.id] = node;
                    else delete inputRefs.current[b.id];
                  }}
                  className={"block__edit" + (b.type === "todo" && b.checked ? " checked" : "")}
                  placeholder={placeholderOf(b)}
                  value={b.text || ""}
                  onChange={(e) => setBlockText(b.id, e.target.value, e.target.selectionStart)}
                  onKeyDown={(e) => onBlockKeyDown(e, b)}
                  onBlur={() => setTimeout(() => setSlash((s) => (s && s.blockId === b.id ? null : s)), 150)}
                />

                {b.type === "toggle" && !b.collapsed && (
                  <div className="toggle-children">
                    <input
                      className="block__edit"
                      placeholder="Nội dung bên trong toggle..."
                      value={b.content || ""}
                      onChange={(e) => setBlockField(b.id, { content: e.target.value })}
                    />
                  </div>
                )}

                {items && (
                  <div className="slash-menu" style={{ position: "absolute", left: 28, top: "100%", zIndex: 50 }}>
                    <div className="slash-menu__group">Loại block</div>
                    {items.length === 0 ? (
                      <div className="slash-menu__item">Không có kết quả</div>
                    ) : (
                      items.map((it, i) => (
                        <div
                          key={it.type}
                          className={"slash-menu__item" + (i === slash.active ? " active" : "")}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectType(b, it);
                          }}
                        >
                          <span className="slash-menu__icon">{it.icon}</span>
                          <div>
                            <div className="slash-menu__label">{it.label}</div>
                            <div className="slash-menu__hint">{it.hint}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="stat__sub" style={{ marginTop: 10 }}>
        Mẹo: gõ "/" để chèn tiêu đề, danh sách, to-do, toggle... · Enter để xuống dòng mới.
      </p>
    </>
  );
}

// ===================== ENTRY =====================
export default function Notes() {
  const { db, update, log } = useStore();
  const [editId, setEditId] = useState(null);

  // Nếu note đang mở bị xóa nơi khác, quay về danh sách.
  useEffect(() => {
    if (editId && !db.notes.some((n) => n.id === editId)) setEditId(null);
  }, [editId, db.notes]);

  const create = () => {
    const id = uid();
    update((d) =>
      d.notes.unshift({
        id,
        title: "",
        blocks: [{ id: uid(), type: "text", text: "" }],
        pinned: false,
        updatedAt: Date.now(),
      })
    );
    log("note_save", "Tạo ghi chú mới");
    setEditId(id);
  };

  if (editId) return <NotesEditor noteId={editId} onBack={() => setEditId(null)} />;
  return <NotesList onOpen={setEditId} onCreate={create} />;
}
