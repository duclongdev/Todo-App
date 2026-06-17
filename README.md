# 🌱 Life Hub

Ứng dụng quản lý cuộc sống cá nhân chạy hoàn toàn trên trình duyệt (không cần server,
không cần tài khoản). Dữ liệu lưu trong `localStorage` và có thể đồng bộ ra file `.json`.

## Tính năng
- 🏠 **Tổng quan** — tóm tắt trong ngày
- ✅ **Công việc** — bảng Kanban, kéo–thả, lịch sử trạng thái, hạn & thời gian hoàn thành
- 🔥 **Thói quen** — theo dõi theo tuần, streak, ghi chú
- 🎯 **Mục tiêu** — ngày/tuần/tháng/năm, liên kết tới công việc cụ thể, tự cập nhật tiến độ
- 💰 **Tài chính** — thu/chi/chuyển khoản, ngân sách, tài khoản, tiết kiệm, báo cáo
- 😴 **Giấc ngủ** · ⏱️ **Tập trung** · 📔 **Nhật ký** · 📝 **Ghi chú** (kiểu Notion, gõ `/`)
- 📊 **Thống kê** — biểu đồ & nhật ký hoạt động
- ⚙️ **Cài đặt** — dark mode, đơn vị tiền tệ, sao lưu/đồng bộ file .json

## Chạy thử (ReactJS + Vite)
```bash
npm install      # cài dependencies (chỉ lần đầu)
npm run dev      # chạy dev server, mở http://localhost:5173
npm run build    # build production vào thư mục dist/
npm run preview  # xem thử bản build
```

## Công nghệ
ReactJS 18 + Vite. Toàn bộ UI dựng bằng JSX, không thao tác DOM trực tiếp.
Trạng thái dùng `useState`/`useEffect` và một Store context dùng chung
(`src/store/StoreContext.jsx`), vẫn lưu vào `localStorage` + đồng bộ file `.json`.

Cấu trúc thư mục:
- `src/views/` — 11 trang (mỗi trang một component)
- `src/components/` — UI dùng chung (Layout trong `App.jsx`, Modal, Toast, Clock…)
- `src/store/` — dữ liệu mặc định + migrate + Store context
- `src/lib/` — helper thuần & hook đồng bộ file
- `src/styles.css` — CSS toàn cục (import tại `src/main.jsx`)

> Bản vanilla JS cũ vẫn được giữ ở `index.legacy.html` + thư mục `js/` để tham khảo.

Xem cấu trúc dữ liệu trong [`SCHEMA.md`](SCHEMA.md) và [`schema.sql`](schema.sql).
