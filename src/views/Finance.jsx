import { useState } from "react";
import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../components/Toast.jsx";
import PageHead from "../components/PageHead.jsx";
import Modal from "../components/Modal.jsx";
import { fmtVN, formatMoney, pad, parseAmount, today, uid } from "../lib/utils.js";

const ICONS = ["💵", "🏦", "💳", "📱", "🐷", "💰", "🪙", "🏠", "🚗", "🍜", "🛍️", "🎁", "📈", "🎮", "💊", "📚", "🧾", "✈️", "📦"];
const TABS = [
  ["overview", "Tổng quan"],
  ["tx", "Giao dịch"],
  ["budget", "Ngân sách"],
  ["accounts", "Tài khoản"],
  ["savings", "Tiết kiệm"],
];

function monthInfo(off) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + off);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return { key: `${y}-${pad(m)}`, label: `Tháng ${m}/${y}` };
}

// ---- Tính toán dựa trên dữ liệu finance ----
const useFinanceHelpers = () => {
  const { db } = useStore();
  const fin = db.finance;
  const cur = db.settings.currency || "₫";
  const fmt = (n) => formatMoney(n, cur);
  const accountById = (id) => fin.accounts.find((a) => a.id === id);
  const catById = (id) => fin.categories.find((c) => c.id === id);
  const txOfMonth = (key) => fin.tx.filter((t) => t.date && t.date.slice(0, 7) === key);
  const accountBalance = (id) => {
    const a = accountById(id);
    if (!a) return 0;
    let bal = a.initial || 0;
    fin.tx.forEach((t) => {
      if (t.type === "income" && t.accountId === id) bal += t.amount;
      else if (t.type === "expense" && t.accountId === id) bal -= t.amount;
      else if (t.type === "transfer") {
        if (t.accountId === id) bal -= t.amount;
        if (t.toAccountId === id) bal += t.amount;
      }
    });
    return bal;
  };
  const netWorth = () => fin.accounts.reduce((s, a) => s + accountBalance(a.id), 0);
  return { fin, cur, fmt, accountById, catById, txOfMonth, accountBalance, netWorth };
};

function Tile({ icon, label, value, cls = "neutral" }) {
  return (
    <div className="stat">
      <div className="stat__label">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={"stat__value amount--" + cls} style={{ fontSize: "1.4rem" }}>
        {value}
      </div>
    </div>
  );
}

function MonthNav({ monthOffset, setMonthOffset }) {
  const info = monthInfo(monthOffset);
  return (
    <div className="weeknav">
      <button className="weeknav__btn" onClick={() => setMonthOffset(monthOffset - 1)}>
        ◀
      </button>
      <div className="weeknav__label">{info.label}</div>
      <button className="weeknav__btn" onClick={() => setMonthOffset(monthOffset + 1)}>
        ▶
      </button>
      {monthOffset !== 0 && (
        <button className="btn btn--sm btn--ghost" onClick={() => setMonthOffset(0)}>
          Tháng này
        </button>
      )}
    </div>
  );
}

function TxItem({ t, onOpen }) {
  const { accountById, catById, fmt } = useFinanceHelpers();
  const acc = accountById(t.accountId);
  let icon, title, amtCls, sign;
  if (t.type === "transfer") {
    const to = accountById(t.toAccountId);
    icon = "🔄";
    title = `${acc ? acc.name : "?"} → ${to ? to.name : "?"}`;
    amtCls = "amount--neutral";
    sign = "";
  } else {
    const c = catById(t.categoryId) || { icon: "📦", name: "Khác" };
    icon = c.icon;
    title = c.name;
    amtCls = t.type === "income" ? "amount--in" : "amount--out";
    sign = t.type === "income" ? "+" : "−";
  }
  const sub = `${fmtVN(t.date)}${acc ? " · " + acc.name : ""}${t.note ? " · " + t.note : ""}`;
  return (
    <li className="item" style={{ cursor: "pointer" }} onClick={() => onOpen(t)}>
      <span style={{ fontSize: "1.2rem" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="item__text">{title}</div>
        <div className="item__sub">{sub}</div>
      </div>
      <span className={"amount " + amtCls}>{sign + fmt(t.amount).replace("−", "")}</span>
    </li>
  );
}

// ===================== EDIT TX MODAL =====================
function TxModal({ tx, onClose }) {
  const { fin, fmt } = useFinanceHelpers();
  const { update, log } = useStore();
  const toast = useToast();
  const accounts = fin.accounts;
  const [amount, setAmount] = useState(tx.amount);
  const [date, setDate] = useState(tx.date);
  const [note, setNote] = useState(tx.note || "");
  const [accountId, setAccountId] = useState(tx.accountId);
  const [toAccountId, setToAccountId] = useState(tx.toAccountId);
  const [categoryId, setCategoryId] = useState(tx.categoryId);
  const cats = fin.categories.filter((c) => c.kind === tx.type);

  const save = () => {
    const amt = parseAmount(amount);
    if (amt <= 0) return toast("Số tiền không hợp lệ", "err");
    update((d) => {
      const x = d.finance.tx.find((q) => q.id === tx.id);
      if (x) {
        x.amount = amt;
        x.date = date;
        x.note = note.trim();
        if (tx.type === "transfer") {
          x.accountId = accountId;
          x.toAccountId = toAccountId;
          x.categoryId = null;
        } else {
          x.accountId = accountId;
          x.toAccountId = null;
          x.categoryId = categoryId;
        }
      }
    });
    log("finance_tx_edit", "Sửa giao dịch " + fmt(amt));
    onClose();
  };
  const remove = () => {
    if (!confirm("Xóa giao dịch này?")) return;
    update((d) => (d.finance.tx = d.finance.tx.filter((q) => q.id !== tx.id)));
    log("finance_tx_delete", "Xóa giao dịch");
    onClose();
  };

  return (
    <Modal title="Chi tiết giao dịch" onClose={onClose}>
      <div className="field" style={{ margin: 0, flex: 1 }}>
        <label>Số tiền</label>
        <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label>Ngày</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {tx.type === "transfer" ? (
          <>
            <div className="field" style={{ margin: 0, flex: 1 }}>
              <label>Từ</label>
              <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon + " " + a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0, flex: 1 }}>
              <label>Đến</label>
              <select className="select" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon + " " + a.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="field" style={{ margin: 0, flex: 1 }}>
              <label>Danh mục</label>
              <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon + " " + c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0, flex: 1 }}>
              <label>Tài khoản</label>
              <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon + " " + a.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>
      <div className="field" style={{ marginTop: 10, flex: 1 }}>
        <label>Ghi chú</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <div style={{ flex: "0 0 auto" }}>
          <button className="btn" onClick={save}>
            Lưu
          </button>
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <button className="btn btn--danger" onClick={remove}>
            Xóa
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ===================== OVERVIEW =====================
function Overview({ monthOffset, setMonthOffset, setTab, onOpenTx }) {
  const { fin, fmt, catById, txOfMonth, netWorth } = useFinanceHelpers();
  const info = monthInfo(monthOffset);
  const monthTx = txOfMonth(info.key);
  const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const byCat = {};
  monthTx.filter((t) => t.type === "expense").forEach((t) => (byCat[t.categoryId] = (byCat[t.categoryId] || 0) + t.amount));
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  const months = [];
  for (let i = 5; i >= 0; i--) months.push(monthInfo(monthOffset - i));
  const series = months.map((m) => {
    const tx = txOfMonth(m.key);
    return {
      label: m.label.replace("Tháng ", "T"),
      in: tx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
      out: tx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    };
  });
  const max = Math.max(1, ...series.flatMap((s) => [s.in, s.out]));
  const recent = [...monthTx].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 6);

  return (
    <>
      <MonthNav monthOffset={monthOffset} setMonthOffset={setMonthOffset} />
      <div className="grid grid--stats">
        <Tile icon="📥" label="Thu nhập" value={fmt(income)} cls="in" />
        <Tile icon="📤" label="Chi tiêu" value={fmt(expense)} cls="out" />
        <Tile icon="⚖️" label="Chênh lệch" value={fmt(income - expense)} cls={income - expense >= 0 ? "in" : "out"} />
        <Tile icon="🏦" label="Tổng tài sản" value={fmt(netWorth())} cls="neutral" />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__title">📊 Chi tiêu theo danh mục</div>
        {cats.length === 0 ? (
          <p className="empty">Chưa có chi tiêu trong tháng này.</p>
        ) : (
          cats.map(([cid, amt]) => {
            const c = catById(cid) || { icon: "📦", name: "Khác" };
            const pct = Math.round((amt / expense) * 100);
            return (
              <div className="fin-bar" key={cid}>
                <span className="fin-bar__icon">{c.icon}</span>
                <div className="fin-bar__main">
                  <div className="fin-bar__top">
                    <span>{`${c.name} · ${pct}%`}</span>
                    <span className="amount amount--out">{fmt(amt)}</span>
                  </div>
                  <div className="progress">
                    <div className="progress__bar" style={{ width: pct + "%", background: "var(--danger)" }} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__title">📈 Thu chi 6 tháng</div>
        <div className="fin-chart">
          {series.map((s, i) => (
            <div className="fin-chart__col" key={i}>
              <div className="fin-chart__bars">
                <div
                  className="fin-chart__bar in"
                  style={{ height: `${Math.round((s.in / max) * 100)}%` }}
                  title={"Thu: " + fmt(s.in)}
                />
                <div
                  className="fin-chart__bar out"
                  style={{ height: `${Math.round((s.out / max) * 100)}%` }}
                  title={"Chi: " + fmt(s.out)}
                />
              </div>
              <div className="fin-chart__label">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="legend">
          <span>
            <span className="dot dot--in" />
            Thu nhập
          </span>
          <span>
            <span className="dot dot--out" />
            Chi tiêu
          </span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__title">
          <span>🧾 Giao dịch gần đây</span>
          <button className="btn btn--sm btn--ghost" onClick={() => setTab("tx")}>
            Xem tất cả
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="empty">Chưa có giao dịch.</p>
        ) : (
          <ul className="list">
            {recent.map((t) => (
              <TxItem key={t.id} t={t} onOpen={onOpenTx} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ===================== TRANSACTIONS =====================
function Transactions({ monthOffset, setMonthOffset, onOpenTx }) {
  const { fin, fmt, txOfMonth } = useFinanceHelpers();
  const { update, log } = useStore();
  const toast = useToast();
  const accounts = fin.accounts;

  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const cats = fin.categories.filter((c) => c.kind === type);
  const [categoryId, setCategoryId] = useState(cats[0]?.id || "");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [fromId, setFromId] = useState(accounts[0]?.id || "");
  const [toId, setToId] = useState(accounts[1]?.id || accounts[0]?.id || "");
  const [filter, setFilter] = useState({ type: "all", cat: "all", acc: "all", q: "" });

  const changeType = (newType) => {
    setType(newType);
    if (newType !== "transfer") {
      const first = fin.categories.find((c) => c.kind === newType);
      setCategoryId(first?.id || "");
    }
  };

  const addTx = (e) => {
    e.preventDefault();
    const amt = parseAmount(amount);
    if (amt <= 0) return toast("Nhập số tiền hợp lệ", "err");
    if (type === "transfer" && fromId === toId) return toast("Hai tài khoản phải khác nhau", "err");
    update((d) =>
      d.finance.tx.push({
        id: uid(),
        type,
        amount: amt,
        accountId: type === "transfer" ? fromId : accountId,
        toAccountId: type === "transfer" ? toId : null,
        categoryId: type === "transfer" ? null : categoryId,
        date: date || today(),
        note: note.trim(),
        createdAt: Date.now(),
      })
    );
    log("finance_tx_add", `${type === "income" ? "Thu" : type === "expense" ? "Chi" : "Chuyển"} ${fmt(amt)}`);
    setAmount("");
    setNote("");
    toast("Đã thêm giao dịch");
  };

  const info = monthInfo(monthOffset);
  let rows = txOfMonth(info.key);
  if (filter.type !== "all") rows = rows.filter((t) => t.type === filter.type);
  if (filter.cat !== "all") rows = rows.filter((t) => t.categoryId === filter.cat);
  if (filter.acc !== "all") rows = rows.filter((t) => t.accountId === filter.acc || t.toAccountId === filter.acc);
  if (filter.q.trim()) rows = rows.filter((t) => (t.note || "").toLowerCase().includes(filter.q.toLowerCase()));
  rows = rows.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

  const tin = rows.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const tout = rows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <form className="card" onSubmit={addTx}>
        <div className="seg" style={{ marginBottom: 14 }}>
          {[
            ["expense", "Chi", "out"],
            ["income", "Thu", "in"],
            ["transfer", "Chuyển khoản", ""],
          ].map(([v, label, cls]) => (
            <button
              type="button"
              key={v}
              className={"seg__btn " + cls + (type === v ? " is-active" : "")}
              onClick={() => changeType(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="row">
          <div className="field" style={{ margin: 0, flex: 1 }}>
            <label>Số tiền</label>
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              placeholder="Số tiền"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="field" style={{ margin: 0, flex: 1 }}>
            <label>Ngày</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          {type === "transfer" ? (
            <>
              <div className="field" style={{ margin: 0, flex: 1 }}>
                <label>Từ tài khoản</label>
                <select className="select" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.icon + " " + a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ margin: 0, flex: 1 }}>
                <label>Đến tài khoản</label>
                <select className="select" value={toId} onChange={(e) => setToId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.icon + " " + a.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="field" style={{ margin: 0, flex: 1 }}>
                <label>Danh mục</label>
                <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon + " " + c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ margin: 0, flex: 1 }}>
                <label>Tài khoản</label>
                <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.icon + " " + a.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
        <div className="field" style={{ marginTop: 10, flex: 1 }}>
          <label>Ghi chú</label>
          <input className="input" placeholder="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn" type="submit">
            Thêm giao dịch
          </button>
        </div>
      </form>

      <MonthNav monthOffset={monthOffset} setMonthOffset={setMonthOffset} />

      <div className="card">
        <div className="row">
          <select
            className="select"
            value={filter.type}
            onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="all">Tất cả loại</option>
            <option value="expense">Chi</option>
            <option value="income">Thu</option>
            <option value="transfer">Chuyển khoản</option>
          </select>
          <select
            className="select"
            value={filter.cat}
            onChange={(e) => setFilter((f) => ({ ...f, cat: e.target.value }))}
          >
            <option value="all">Tất cả danh mục</option>
            {fin.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon + " " + c.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={filter.acc}
            onChange={(e) => setFilter((f) => ({ ...f, acc: e.target.value }))}
          >
            <option value="all">Tất cả tài khoản</option>
            {fin.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon + " " + a.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 10 }}>
          <input
            className="input"
            placeholder="🔍 Tìm theo ghi chú..."
            value={filter.q}
            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid--stats" style={{ marginTop: 16 }}>
        <Tile icon="📥" label="Thu (lọc)" value={fmt(tin)} cls="in" />
        <Tile icon="📤" label="Chi (lọc)" value={fmt(tout)} cls="out" />
        <Tile icon="🧮" label="Số giao dịch" value={String(rows.length)} cls="neutral" />
      </div>

      {rows.length === 0 ? (
        <p className="empty">Không có giao dịch phù hợp.</p>
      ) : (
        <ul className="list" style={{ marginTop: 16 }}>
          {rows.map((t) => (
            <TxItem key={t.id} t={t} onOpen={onOpenTx} />
          ))}
        </ul>
      )}
    </>
  );
}

// ===================== BUDGET =====================
function Budget({ monthOffset, setMonthOffset }) {
  const { fin, fmt, txOfMonth } = useFinanceHelpers();
  const { update, log } = useStore();
  const info = monthInfo(monthOffset);
  const monthTx = txOfMonth(info.key);
  const spentByCat = {};
  monthTx.filter((t) => t.type === "expense").forEach((t) => (spentByCat[t.categoryId] = (spentByCat[t.categoryId] || 0) + t.amount));
  const cats = fin.categories.filter((c) => c.kind === "expense");
  const budgets = fin.budgets;
  const totalBudget = cats.reduce((s, c) => s + (budgets[c.id] || 0), 0);
  const totalSpent = cats.reduce((s, c) => s + (spentByCat[c.id] || 0), 0);
  const pct = totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const setBudget = (catId, val, catName) => {
    const v = parseAmount(val);
    update((d) => {
      if (v > 0) d.finance.budgets[catId] = v;
      else delete d.finance.budgets[catId];
    });
    log("finance_budget", `Ngân sách ${catName}: ${fmt(v)}`);
  };

  return (
    <>
      <MonthNav monthOffset={monthOffset} setMonthOffset={setMonthOffset} />
      <div className="card">
        <div className="card__title">
          <span>Tổng ngân sách tháng</span>
          <span className="amount">{fmt(totalSpent) + " / " + fmt(totalBudget)}</span>
        </div>
        <div className="progress">
          <div
            className="progress__bar"
            style={{ width: Math.min(100, pct) + "%", background: pct > 100 ? "var(--danger)" : "var(--primary)" }}
          />
        </div>
        <p className="stat__sub" style={{ marginTop: 8 }}>
          {totalBudget
            ? pct > 100
              ? `Vượt ngân sách ${pct - 100}%`
              : `Đã dùng ${pct}%`
            : "Đặt ngân sách cho từng danh mục bên dưới."}
        </p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__title">Ngân sách theo danh mục</div>
        {cats.map((c) => {
          const budget = budgets[c.id] || 0;
          const spent = spentByCat[c.id] || 0;
          const p = budget ? Math.round((spent / budget) * 100) : 0;
          return (
            <div className="fin-bar" key={c.id}>
              <span className="fin-bar__icon">{c.icon}</span>
              <div className="fin-bar__main">
                <div className="fin-bar__top">
                  <span>{c.name}</span>
                  <span className={"amount " + (p > 100 ? "amount--out" : "amount--neutral")}>
                    {fmt(spent) + (budget ? " / " + fmt(budget) : "")}
                  </span>
                </div>
                {budget ? (
                  <div className="progress">
                    <div
                      className="progress__bar"
                      style={{
                        width: Math.min(100, p) + "%",
                        background: p > 100 ? "var(--danger)" : p > 80 ? "var(--warn)" : "var(--success)",
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <input
                className="input"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                style={{ maxWidth: 140 }}
                defaultValue={budget || ""}
                onBlur={(e) => setBudget(c.id, e.target.value, c.name)}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

// ===================== ACCOUNTS =====================
function AccountModal({ account, onClose }) {
  const { update, log } = useStore();
  const [name, setName] = useState(account.name);
  const [icon, setIcon] = useState(account.icon);
  const [initial, setInitial] = useState(account.initial);
  const save = () => {
    if (!name.trim()) return;
    update((d) => {
      const x = d.finance.accounts.find((q) => q.id === account.id);
      if (x) {
        x.name = name.trim();
        x.icon = icon;
        x.initial = parseAmount(initial);
      }
    });
    log("finance_account", "Sửa tài khoản: " + name.trim());
    onClose();
  };
  return (
    <Modal title="Sửa tài khoản" onClose={onClose}>
      <div className="field" style={{ margin: 0, flex: 1 }}>
        <label>Tên</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label>Biểu tượng</label>
          <select className="select" value={icon} onChange={(e) => setIcon(e.target.value)}>
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label>Số dư ban đầu</label>
          <input className="input" type="number" step="any" value={initial} onChange={(e) => setInitial(e.target.value)} />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <button className="btn" onClick={save}>
          Lưu
        </button>
      </div>
    </Modal>
  );
}

function Accounts() {
  const { fin, fmt, accountBalance, netWorth } = useFinanceHelpers();
  const { update, log } = useStore();
  const toast = useToast();
  const [editAccount, setEditAccount] = useState(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [initial, setInitial] = useState("");

  const addAccount = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    update((d) =>
      d.finance.accounts.push({
        id: uid(),
        name: name.trim(),
        icon,
        type: "other",
        initial: parseAmount(initial),
        createdAt: Date.now(),
      })
    );
    log("finance_account", "Thêm tài khoản: " + name.trim());
    setName("");
    setInitial("");
  };

  const removeAccount = (a) => {
    if (fin.tx.some((t) => t.accountId === a.id || t.toAccountId === a.id))
      return toast("Tài khoản đang có giao dịch, không thể xóa", "err");
    if (fin.accounts.length <= 1) return toast("Phải còn ít nhất 1 tài khoản", "err");
    if (!confirm(`Xóa tài khoản "${a.name}"?`)) return;
    update((d) => (d.finance.accounts = d.finance.accounts.filter((x) => x.id !== a.id)));
  };

  return (
    <>
      <div className="card">
        <div className="card__title">
          <span>Tổng tài sản ròng</span>
          <span className="amount amount--in">{fmt(netWorth())}</span>
        </div>
      </div>

      <div className="grid grid--2" style={{ marginTop: 16 }}>
        {fin.accounts.map((a) => {
          const bal = accountBalance(a.id);
          return (
            <div className="fin-acc" key={a.id}>
              <span className="fin-acc__icon">{a.icon}</span>
              <div style={{ flex: 1 }}>
                <div className="fin-acc__name">{a.name}</div>
                <div className={"amount " + (bal >= 0 ? "amount--in" : "amount--out")}>{fmt(bal)}</div>
              </div>
              <button className="icon-btn" style={{ color: "var(--muted)" }} onClick={() => setEditAccount(a)}>
                ✏️
              </button>
              <button className="icon-btn" onClick={() => removeAccount(a)}>
                🗑️
              </button>
            </div>
          );
        })}
      </div>

      <form className="card" style={{ marginTop: 16 }} onSubmit={addAccount}>
        <div className="card__title">Thêm tài khoản / ví</div>
        <div className="row">
          <input
            className="input"
            placeholder="Tên tài khoản (vd: Vietcombank)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="select"
            style={{ maxWidth: 90, flex: "0 0 90px" }}
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
          >
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            step="any"
            placeholder="Số dư ban đầu"
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
          />
          <div style={{ flex: "0 0 auto" }}>
            <button className="btn" type="submit">
              Thêm
            </button>
          </div>
        </div>
      </form>

      {editAccount && <AccountModal account={editAccount} onClose={() => setEditAccount(null)} />}
    </>
  );
}

// ===================== SAVINGS =====================
function Savings() {
  const { fin, fmt } = useFinanceHelpers();
  const { update, log } = useStore();
  const toast = useToast();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🐷");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");

  const deposit = (s, delta) => {
    const v = parseAmount(prompt(delta > 0 ? `Số tiền nạp vào '${s.name}':` : `Số tiền rút khỏi '${s.name}':`, ""));
    if (v <= 0) return;
    update((d) => {
      const x = d.finance.savings.find((q) => q.id === s.id);
      if (x) x.saved = delta > 0 ? x.saved + v : Math.max(0, x.saved - v);
    });
    if (delta > 0) log("finance_saving", `Nạp ${fmt(v)} vào ${s.name}`);
  };

  const removeSaving = (s) => {
    if (!confirm("Xóa mục tiêu này?")) return;
    update((d) => (d.finance.savings = d.finance.savings.filter((q) => q.id !== s.id)));
  };

  const addSaving = (e) => {
    e.preventDefault();
    if (!name.trim() || parseAmount(target) <= 0) return toast("Nhập tên & số tiền mục tiêu", "err");
    update((d) =>
      d.finance.savings.push({
        id: uid(),
        name: name.trim(),
        icon,
        target: parseAmount(target),
        saved: 0,
        deadline: deadline || null,
        createdAt: Date.now(),
      })
    );
    log("finance_saving", "Thêm mục tiêu tiết kiệm: " + name.trim());
    setName("");
    setTarget("");
    setDeadline("");
  };

  return (
    <>
      {fin.savings.length === 0 && <p className="empty">Chưa có mục tiêu tiết kiệm nào.</p>}
      <div className="grid grid--2">
        {fin.savings.map((s) => {
          const pct = s.target ? Math.min(100, Math.round((s.saved / s.target) * 100)) : 0;
          return (
            <div className="card" key={s.id}>
              <div className="card__title">
                <span>{s.icon + " " + s.name}</span>
                <button className="icon-btn" onClick={() => removeSaving(s)}>
                  🗑️
                </button>
              </div>
              <div className="amount" style={{ marginBottom: 6 }}>
                {fmt(s.saved) + " / " + fmt(s.target)}
              </div>
              <div className="progress">
                <div className="progress__bar" style={{ width: pct + "%", background: "var(--success)" }} />
              </div>
              <p className="stat__sub" style={{ marginTop: 6 }}>
                {pct + "%" + (s.deadline ? " · hạn " + fmtVN(s.deadline) : "")}
              </p>
              <div className="row" style={{ marginTop: 10 }}>
                <div style={{ flex: "0 0 auto" }}>
                  <button className="btn btn--sm" onClick={() => deposit(s, 1)}>
                    ＋ Nạp
                  </button>
                </div>
                <div style={{ flex: "0 0 auto" }}>
                  <button className="btn btn--sm btn--ghost" onClick={() => deposit(s, -1)}>
                    － Rút
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form className="card" style={{ marginTop: 16 }} onSubmit={addSaving}>
        <div className="card__title">Thêm mục tiêu tiết kiệm</div>
        <div className="row">
          <input
            className="input"
            placeholder="Tên (vd: Mua laptop)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="select"
            style={{ maxWidth: 90, flex: "0 0 90px" }}
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
          >
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input
            className="input"
            type="number"
            step="any"
            placeholder="Mục tiêu (số tiền)"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <div style={{ flex: "0 0 auto" }}>
            <button className="btn" type="submit">
              Thêm
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

// ===================== ENTRY =====================
export default function Finance() {
  const [tab, setTab] = useState("overview");
  const [monthOffset, setMonthOffset] = useState(0);
  const [editTx, setEditTx] = useState(null);

  return (
    <>
      <PageHead
        title="💰 Tài chính"
        subtitle="Quản lý thu chi, tài khoản, ngân sách và tiết kiệm — kèm báo cáo chi tiết."
      />
      <div className="pills">
        {TABS.map(([id, label]) => (
          <button key={id} className={"pill" + (tab === id ? " is-active" : "")} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Overview
          monthOffset={monthOffset}
          setMonthOffset={setMonthOffset}
          setTab={setTab}
          onOpenTx={setEditTx}
        />
      )}
      {tab === "tx" && (
        <Transactions monthOffset={monthOffset} setMonthOffset={setMonthOffset} onOpenTx={setEditTx} />
      )}
      {tab === "budget" && <Budget monthOffset={monthOffset} setMonthOffset={setMonthOffset} />}
      {tab === "accounts" && <Accounts />}
      {tab === "savings" && <Savings />}

      {editTx && <TxModal tx={editTx} onClose={() => setEditTx(null)} />}
    </>
  );
}
