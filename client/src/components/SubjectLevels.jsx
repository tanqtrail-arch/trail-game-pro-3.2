import Section from "./Section";

export default function SubjectLevels({ subjects }) {
  const colors = { "算数": "#0090d9", "社会": "#2cb562", "理科": "#e8a020", "国語": "#e05070", "歴史": "#8e24aa", "地理": "#00897b", "思考系": "#5c6bc0" };
  if (subjects.length === 0) return null;
  return (
    <Section title="科目レベル" emoji="📊">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {subjects.map(s => {
          const c = colors[s.subject] || "#718096";
          const pct = Math.min(100, (s.totalAlt / s.nextAt) * 100);
          return (
            <div key={s.subject} style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", border: "1px solid #e8ecf2" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#2d3748" }}>{s.emoji} {s.subject}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: c, background: `${c}15`, padding: "2px 8px", borderRadius: 8, fontFamily: "'Orbitron', monospace" }}>Lv.{s.level}</span>
              </div>
              <div style={{ fontSize: 10, color: "#a0aec0", marginTop: 4 }}>{s.title}</div>
              <div style={{ marginTop: 6, height: 4, background: "#e8ecf2", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: c, borderRadius: 4, transition: "width 0.5s" }} />
              </div>
              <div style={{ fontSize: 9, color: "#a0aec0", marginTop: 3, textAlign: "right" }}>{s.totalAlt}/{s.nextAt} ALT</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
