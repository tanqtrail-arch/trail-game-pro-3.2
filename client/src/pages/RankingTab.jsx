import PageHeader from "../components/PageHeader";

export default function RankingTab({ ranking }) {
  const medals = ["", "🥇", "🥈", "🥉"];
  return (
    <div>
      <PageHeader emoji="🏆" title="ランキング" />
      {ranking.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ranking.map(r => (
            <div key={r.rank} style={{ display: "flex", alignItems: "center", gap: 10, background: r.isMe ? "linear-gradient(135deg, #e3f2fd, #e8eaf6)" : "#fff", borderRadius: 12, padding: "12px 14px", border: r.isMe ? "1px solid #90caf9" : "1px solid #e8ecf2" }}>
              <span style={{ fontSize: 20, width: 32, textAlign: "center", fontWeight: 800 }}>{medals[r.rank] || r.rank}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: r.isMe ? 800 : 600, color: "#2d3748" }}>
                {r.name} {r.isMe && <span style={{ fontSize: 10, color: "#0090d9" }}>← あなた</span>}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#e8a020", fontFamily: "'Orbitron', monospace" }}>{r.alt.toLocaleString()}</span>
              <span style={{ fontSize: 10, color: "#a0aec0" }}>ALT</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#a0aec0", fontSize: 14 }}>ランキングデータがありません</div>
      )}
    </div>
  );
}
