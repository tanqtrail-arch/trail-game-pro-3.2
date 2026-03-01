export default function PageHeader({ emoji, title }) {
  return (
    <div style={{ padding: "16px 4px 12px", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color: "#2d3748", letterSpacing: -0.3 }}>{title}</span>
    </div>
  );
}
