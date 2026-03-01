import Section from "./Section";

export default function RecentGamesSection({ recent }) {
  return (
    <Section title="最近プレイ" emoji="🕹️" action="すべて見る →">
      {recent.length > 0 ? (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {recent.map(g => (
            <div key={g.id} style={{ minWidth: 140, background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #e8ecf2", cursor: "pointer", transition: "all 0.2s" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{g.emoji}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#2d3748", lineHeight: 1.3, marginBottom: 4 }}>{g.name}</div>
              <div style={{ fontSize: 10, color: "#a0aec0", marginBottom: 8 }}>{g.lastPlayed}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ flex: 1, height: 4, background: "#e8ecf2", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${g.lastScore}%`, height: "100%", borderRadius: 4, background: g.lastScore >= 80 ? "#2cb562" : g.lastScore >= 50 ? "#e8a020" : "#e05070" }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#2d3748", fontFamily: "'Orbitron', monospace" }}>{g.lastScore}%</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "20px 0", color: "#a0aec0", fontSize: 13 }}>
          まだプレイ記録がありません 🎮
        </div>
      )}
    </Section>
  );
}
