import Section from "./Section";

export default function WeeklyRanking({ ranking, onNavigateToRanking }) {
  const medals = ["", "🥇", "🥈", "🥉"];
  if (ranking.length === 0) return null;

  const top3 = ranking.slice(0, 3);
  const me = ranking.find(r => r.isMe);
  const meInTop3 = top3.some(r => r.isMe);

  const rowStyle = (r) => ({
    display: "flex", alignItems: "center", gap: 10,
    background: r.isMe ? "linear-gradient(135deg, #e3f2fd, #e8eaf6)" : "#fff",
    borderRadius: 12, padding: "10px 14px",
    border: r.isMe ? "1px solid #90caf9" : "1px solid #e8ecf2",
  });

  return (
    <Section title="今週のランキング" emoji="🏆">
      <div
        style={{ display: "flex", flexDirection: "column", gap: 6, cursor: onNavigateToRanking ? "pointer" : "default" }}
        onClick={onNavigateToRanking}
      >
        {top3.map(r => (
          <div key={r.rank} style={rowStyle(r)}>
            <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{medals[r.rank] || r.rank}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: r.isMe ? 800 : 600, color: "#2d3748" }}>
              {r.name} {r.isMe && <span style={{ fontSize: 10, color: "#0090d9" }}>← あなた</span>}
            </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#e8a020", fontFamily: "'Orbitron', monospace" }}>{r.alt}</span>
          </div>
        ))}

        {me && !meInTop3 && (
          <>
            <div style={{ textAlign: "center", color: "#a0aec0", fontSize: 12, padding: "2px 0", letterSpacing: 2 }}>⋯</div>
            <div style={rowStyle(me)}>
              <span style={{ fontSize: 14, width: 28, textAlign: "center", color: "#718096", fontWeight: 700 }}>{me.rank}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: "#2d3748" }}>
                {me.name} <span style={{ fontSize: 10, color: "#0090d9" }}>← あなた</span>
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#e8a020", fontFamily: "'Orbitron', monospace" }}>{me.alt}</span>
            </div>
          </>
        )}

        {onNavigateToRanking && (
          <div style={{ textAlign: "center", fontSize: 11, color: "#0090d9", paddingTop: 4 }}>
            ランキングをもっと見る →
          </div>
        )}
      </div>
    </Section>
  );
}
