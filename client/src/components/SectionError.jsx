export default function SectionError({ message }) {
  return (
    <div style={{ textAlign: "center", padding: "12px", background: "#fff5f5", borderRadius: 12, border: "1px solid #fed7d7", marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "#e05070" }}>{message || 'データを取得できませんでした'}</div>
    </div>
  );
}
