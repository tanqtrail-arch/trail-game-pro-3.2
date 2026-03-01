export default function Section({ title, emoji, badge, action, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>{emoji}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#2d3748", letterSpacing: -0.3 }}>{title}</span>
          {badge && <span style={{ fontSize: 10, fontWeight: 700, background: "#0090d922", color: "#0090d9", padding: "2px 8px", borderRadius: 10 }}>{badge}</span>}
        </div>
        {action && <span style={{ fontSize: 11, color: "#0090d9", fontWeight: 600, cursor: "pointer" }}>{action}</span>}
      </div>
      {children}
    </div>
  );
}
