import { useEffect, useState } from "react";

// Đồng hồ thời gian thực — cập nhật mỗi giây bằng useEffect + setInterval.
export default function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const date = now.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <span className="clock">
      <span className="clock__time">{time}</span>
      <span className="clock__date">{date}</span>
    </span>
  );
}
