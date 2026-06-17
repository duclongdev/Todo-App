// PageHead — tiêu đề + mô tả ở đầu mỗi trang.
export default function PageHead({ title, subtitle }) {
  return (
    <div className="page-head">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
