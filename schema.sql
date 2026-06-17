-- ============================================================================
--  Life Hub — Schema SQL (phiên bản quan hệ của kho dữ liệu JSON trong app)
-- ----------------------------------------------------------------------------
--  Tương thích PostgreSQL. Ghi chú cho SQLite/MySQL nằm ở cuối file.
--  Quy ước:
--    * id            : TEXT (chuỗi base36 + random do app sinh)
--    * *_at, ts      : BIGINT = epoch mili-giây (Date.now())
--    * *_date        : DATE 'YYYY-MM-DD'
--    * bedtime/...   : TIME 'HH:MM'
--    * tiền tệ       : NUMERIC(18,2)
--    * enum          : ràng buộc bằng CHECK cho dễ chuyển đổi (xem phần Postgres ENUM ở cuối)
-- ============================================================================

-- Xóa theo thứ tự phụ thuộc (tiện chạy lại)
DROP TABLE IF EXISTS activity_log     CASCADE;
DROP TABLE IF EXISTS budgets          CASCADE;
DROP TABLE IF EXISTS transactions     CASCADE;
DROP TABLE IF EXISTS savings_goals    CASCADE;
DROP TABLE IF EXISTS categories       CASCADE;
DROP TABLE IF EXISTS accounts         CASCADE;
DROP TABLE IF EXISTS journal_entries  CASCADE;
DROP TABLE IF EXISTS note_blocks      CASCADE;
DROP TABLE IF EXISTS notes            CASCADE;
DROP TABLE IF EXISTS work_sessions    CASCADE;
DROP TABLE IF EXISTS sleep_logs       CASCADE;
DROP TABLE IF EXISTS goal_subtasks    CASCADE;
DROP TABLE IF EXISTS goals            CASCADE;
DROP TABLE IF EXISTS habit_logs       CASCADE;
DROP TABLE IF EXISTS habits           CASCADE;
DROP TABLE IF EXISTS todo_history     CASCADE;
DROP TABLE IF EXISTS todos            CASCADE;
DROP TABLE IF EXISTS task_columns     CASCADE;
DROP TABLE IF EXISTS settings         CASCADE;

-- ============================ CÔNG VIỆC (KANBAN) ============================

CREATE TABLE task_columns (
    id        TEXT PRIMARY KEY,
    name      TEXT    NOT NULL,
    kind      TEXT    NOT NULL DEFAULT 'custom'
              CHECK (kind IN ('todo','doing','pending','done','cancel','custom')),
    is_done   BOOLEAN NOT NULL DEFAULT FALSE,
    position  INTEGER NOT NULL DEFAULT 0   -- thứ tự cột trên bảng
);

CREATE TABLE todos (
    id            TEXT PRIMARY KEY,
    text          TEXT    NOT NULL,
    description   TEXT    NOT NULL DEFAULT '',
    column_id     TEXT    NOT NULL REFERENCES task_columns(id) ON DELETE RESTRICT,
    done          BOOLEAN NOT NULL DEFAULT FALSE,
    priority      TEXT    NOT NULL DEFAULT 'med' CHECK (priority IN ('high','med','low')),
    due           TIMESTAMP,            -- hạn dự kiến (datetime-local)
    started_at    BIGINT,               -- mốc bắt đầu làm (ms)
    completed_at  BIGINT,               -- mốc hoàn thành (ms)
    cancelled_at  BIGINT,               -- mốc hủy (ms)
    created_at    BIGINT  NOT NULL
);
CREATE INDEX idx_todos_column ON todos(column_id);

-- Lịch sử MỌI lần đổi trạng thái của công việc
CREATE TABLE todo_history (
    id              TEXT PRIMARY KEY,
    todo_id         TEXT   NOT NULL REFERENCES todos(id)        ON DELETE CASCADE,
    from_column_id  TEXT            REFERENCES task_columns(id) ON DELETE SET NULL, -- NULL = tạo mới
    to_column_id    TEXT   NOT NULL REFERENCES task_columns(id) ON DELETE CASCADE,
    at              BIGINT NOT NULL
);
CREATE INDEX idx_todohist_todo ON todo_history(todo_id);

-- ================================ THÓI QUEN ================================

CREATE TABLE habits (
    id          TEXT PRIMARY KEY,
    name        TEXT   NOT NULL,
    icon        TEXT   NOT NULL DEFAULT '✅',
    note        TEXT   NOT NULL DEFAULT '',
    created_at  BIGINT NOT NULL
);

-- Mỗi lần tick một ngày (habitLogs[habitId][date] = true)
CREATE TABLE habit_logs (
    habit_id  TEXT    NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    log_date  DATE    NOT NULL,
    done      BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (habit_id, log_date)
);

-- ================================ MỤC TIÊU ================================

CREATE TABLE goals (
    id          TEXT PRIMARY KEY,
    title       TEXT    NOT NULL,
    scope       TEXT    NOT NULL CHECK (scope IN ('day','week','month','year')),
    period      TEXT    NOT NULL,   -- 'D:YYYY-MM-DD' | 'W:YYYY-MM-DD' | 'M:YYYY-MM' | 'Y:YYYY'
    done        BOOLEAN NOT NULL DEFAULT FALSE,
    progress    INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    created_at  BIGINT  NOT NULL
);
CREATE INDEX idx_goals_scope_period ON goals(scope, period);

CREATE TABLE goal_subtasks (
    id       TEXT PRIMARY KEY,
    goal_id  TEXT    NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    text     TEXT    NOT NULL,
    done     BOOLEAN NOT NULL DEFAULT FALSE,
    task_id  TEXT            REFERENCES todos(id) ON DELETE SET NULL  -- liên kết công việc thật
);
CREATE INDEX idx_subtasks_goal ON goal_subtasks(goal_id);

-- ============================== GIẤC NGỦ / LÀM VIỆC ==============================

CREATE TABLE sleep_logs (
    id        TEXT PRIMARY KEY,
    log_date  DATE    NOT NULL UNIQUE,   -- mỗi ngày 1 bản ghi
    bedtime   TIME    NOT NULL,
    waketime  TIME    NOT NULL,
    quality   INTEGER NOT NULL CHECK (quality BETWEEN 1 AND 5),
    note      TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE work_sessions (
    id          TEXT PRIMARY KEY,
    log_date    DATE    NOT NULL,
    minutes     INTEGER NOT NULL CHECK (minutes > 0),
    project     TEXT    NOT NULL DEFAULT 'Tập trung',
    note        TEXT    NOT NULL DEFAULT '',
    created_at  BIGINT  NOT NULL
);
CREATE INDEX idx_work_date ON work_sessions(log_date);

-- ================================ GHI CHÚ ================================

CREATE TABLE notes (
    id          TEXT PRIMARY KEY,
    title       TEXT    NOT NULL DEFAULT '',
    pinned      BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at  BIGINT  NOT NULL
);

CREATE TABLE note_blocks (
    id         TEXT PRIMARY KEY,
    note_id    TEXT    NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    position   INTEGER NOT NULL DEFAULT 0,   -- thứ tự block trong ghi chú
    type       TEXT    NOT NULL DEFAULT 'text'
               CHECK (type IN ('text','h1','h2','h3','bullet','number','todo','toggle','quote','divider')),
    text       TEXT    NOT NULL DEFAULT '',
    checked    BOOLEAN NOT NULL DEFAULT FALSE,  -- chỉ dùng cho type='todo'
    collapsed  BOOLEAN NOT NULL DEFAULT FALSE,  -- chỉ dùng cho type='toggle'
    content    TEXT    NOT NULL DEFAULT ''      -- chỉ dùng cho type='toggle'
);
CREATE INDEX idx_blocks_note ON note_blocks(note_id, position);

-- ================================ NHẬT KÝ ================================

CREATE TABLE journal_entries (
    entry_date  DATE PRIMARY KEY,                 -- 1 trang / ngày
    mood        TEXT NOT NULL DEFAULT '',         -- emoji: 😄 🙂 😐 😕 😢
    text        TEXT NOT NULL DEFAULT '',
    gratitude   TEXT NOT NULL DEFAULT ''
);

-- ================================ TÀI CHÍNH ================================

CREATE TABLE accounts (
    id          TEXT PRIMARY KEY,
    name        TEXT    NOT NULL,
    icon        TEXT    NOT NULL DEFAULT '💵',
    type        TEXT    NOT NULL DEFAULT 'other',  -- 'cash' | 'other' | ...
    initial     NUMERIC(18,2) NOT NULL DEFAULT 0,  -- số dư ban đầu
    created_at  BIGINT  NOT NULL
);

CREATE TABLE categories (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL,
    icon  TEXT NOT NULL DEFAULT '📦',
    kind  TEXT NOT NULL CHECK (kind IN ('expense','income'))
);

CREATE TABLE transactions (
    id             TEXT PRIMARY KEY,
    type           TEXT          NOT NULL CHECK (type IN ('income','expense','transfer')),
    amount         NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    account_id     TEXT          NOT NULL REFERENCES accounts(id)   ON DELETE RESTRICT,
    to_account_id  TEXT                   REFERENCES accounts(id)   ON DELETE RESTRICT, -- chỉ khi 'transfer'
    category_id    TEXT                   REFERENCES categories(id) ON DELETE SET NULL, -- NULL khi 'transfer'
    tx_date        DATE          NOT NULL,
    note           TEXT          NOT NULL DEFAULT '',
    created_at     BIGINT        NOT NULL,
    -- Bảo đảm tính nhất quán theo loại giao dịch
    CHECK ( (type = 'transfer' AND to_account_id IS NOT NULL AND category_id IS NULL)
         OR (type IN ('income','expense') AND to_account_id IS NULL AND category_id IS NOT NULL) ),
    CHECK (to_account_id IS NULL OR to_account_id <> account_id)
);
CREATE INDEX idx_tx_date     ON transactions(tx_date);
CREATE INDEX idx_tx_account  ON transactions(account_id);
CREATE INDEX idx_tx_category ON transactions(category_id);

-- Ngân sách tháng theo danh mục chi (budgets[categoryId] = amount)
CREATE TABLE budgets (
    category_id     TEXT PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
    monthly_amount  NUMERIC(18,2) NOT NULL CHECK (monthly_amount >= 0)
);

CREATE TABLE savings_goals (
    id          TEXT PRIMARY KEY,
    name        TEXT    NOT NULL,
    icon        TEXT    NOT NULL DEFAULT '🐷',
    target      NUMERIC(18,2) NOT NULL CHECK (target > 0),
    saved       NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (saved >= 0),
    deadline    DATE,
    created_at  BIGINT  NOT NULL
);

-- ============================ NHẬT KÝ HOẠT ĐỘNG ============================

CREATE TABLE activity_log (
    id      TEXT PRIMARY KEY,
    ts      BIGINT NOT NULL,
    type    TEXT   NOT NULL CHECK (type IN (
                'session_start','navigate',
                'task_add','task_move','task_edit','task_delete','column_add','column_delete',
                'habit_add','habit_edit','habit_tick',
                'goal_add','goal_complete','goal_subtask_add',
                'sleep_log','focus_log','journal_save','note_save',
                'finance_tx_add','finance_tx_edit','finance_tx_delete',
                'finance_budget','finance_account','finance_saving')),
    detail  TEXT   NOT NULL DEFAULT ''
);
CREATE INDEX idx_activity_ts   ON activity_log(ts);
CREATE INDEX idx_activity_type ON activity_log(type);

-- ================================ CẤU HÌNH ================================

CREATE TABLE settings (
    id        INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- chỉ 1 dòng
    theme     TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark')),
    name      TEXT NOT NULL DEFAULT '',
    currency  TEXT NOT NULL DEFAULT '₫' CHECK (currency IN ('₫','$','€','£','¥'))
);

-- ============================== DỮ LIỆU MẶC ĐỊNH ==============================

INSERT INTO settings (id, theme, name, currency) VALUES (1, 'light', '', '₫');

INSERT INTO task_columns (id, name, kind, is_done, position) VALUES
    ('todo',    'Cần làm',    'todo',    FALSE, 0),
    ('doing',   'Đang làm',   'doing',   FALSE, 1),
    ('pending', 'Tạm hoãn',   'pending', FALSE, 2),
    ('done',    'Hoàn thành', 'done',    TRUE,  3),
    ('cancel',  'Đã hủy',     'cancel',  FALSE, 4);

INSERT INTO accounts (id, name, icon, type, initial, created_at) VALUES
    ('cash', 'Tiền mặt', '💵', 'cash', 0, 0);

INSERT INTO categories (id, name, icon, kind) VALUES
    ('c_food',      'Ăn uống',  '🍜', 'expense'),
    ('c_transport', 'Đi lại',   '🚌', 'expense'),
    ('c_shopping',  'Mua sắm',  '🛍️', 'expense'),
    ('c_bills',     'Hóa đơn',  '🧾', 'expense'),
    ('c_fun',       'Giải trí', '🎮', 'expense'),
    ('c_health',    'Sức khỏe', '💊', 'expense'),
    ('c_edu',       'Giáo dục', '📚', 'expense'),
    ('c_home',      'Nhà cửa',  '🏠', 'expense'),
    ('c_other_e',   'Khác',     '📦', 'expense'),
    ('c_salary',    'Lương',    '💼', 'income'),
    ('c_bonus',     'Thưởng',   '🎁', 'income'),
    ('c_invest',    'Đầu tư',   '📈', 'income'),
    ('c_other_i',   'Thu khác', '💵', 'income');

-- ============================================================================
--  GỢI Ý TRUY VẤN
-- ----------------------------------------------------------------------------
--  Số dư 1 tài khoản:
--    SELECT a.initial
--         + COALESCE(SUM(CASE WHEN t.type='income'   AND t.account_id=a.id    THEN t.amount END),0)
--         - COALESCE(SUM(CASE WHEN t.type='expense'  AND t.account_id=a.id    THEN t.amount END),0)
--         - COALESCE(SUM(CASE WHEN t.type='transfer' AND t.account_id=a.id    THEN t.amount END),0)
--         + COALESCE(SUM(CASE WHEN t.type='transfer' AND t.to_account_id=a.id THEN t.amount END),0)
--    FROM accounts a LEFT JOIN transactions t ON TRUE WHERE a.id = 'cash' GROUP BY a.initial;
--
--  Chi tiêu theo danh mục trong 1 tháng:
--    SELECT c.name, SUM(t.amount) FROM transactions t JOIN categories c ON c.id=t.category_id
--    WHERE t.type='expense' AND to_char(t.tx_date,'YYYY-MM')='2026-06' GROUP BY c.name ORDER BY 2 DESC;
--
--  Streak / lịch sử công việc: dùng todo_history (sắp theo at).
-- ============================================================================

-- ----------------------------------------------------------------------------
--  GHI CHÚ CHUYỂN ĐỔI HỆ QUẢN TRỊ KHÁC
-- ----------------------------------------------------------------------------
--  SQLite:
--    - Bỏ "CASCADE" sau DROP TABLE; bật khóa ngoại: PRAGMA foreign_keys = ON;
--    - Không có TIME/DATE riêng → lưu dạng TEXT ('HH:MM', 'YYYY-MM-DD'); NUMERIC → REAL.
--    - BOOLEAN → INTEGER (0/1).
--  MySQL:
--    - TEXT làm khóa chính nên đổi sang VARCHAR(32) (vd id VARCHAR(32)).
--    - BIGINT, DATE, TIME, BOOLEAN, DECIMAL(18,2) đều hỗ trợ; bỏ CHECK nếu MySQL < 8.0.
--  PostgreSQL (tùy chọn dùng ENUM thật thay cho CHECK), ví dụ:
--    CREATE TYPE tx_type     AS ENUM ('income','expense','transfer');
--    CREATE TYPE task_priority AS ENUM ('high','med','low');
--    -- rồi khai báo cột: type tx_type NOT NULL, priority task_priority NOT NULL ...
-- ============================================================================
