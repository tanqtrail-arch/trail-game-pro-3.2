import { useState, useMemo } from "react";
import PageHeader from "../components/PageHeader";

function buildGameRanking(sessions, gameId) {
  const gameSessions = sessions.filter(s => s.game_id === gameId);
  // Best accuracy_pct per student
  const best = {};
  gameSessions.forEach(s => {
    const name = s.student_name;
    const pct = s.accuracy_pct ?? 0;
    if (!best[name] || pct > best[name]) best[name] = pct;
  });
  return Object.entries(best)
    .map(([name, pct]) => ({ student_name: name, score: pct }))
    .sort((a, b) => b.score - a.score);
}

export default function RankingTab({ ranking, games, studentName, sessions }) {
  const medals = ["", "\u{1F947}", "\u{1F948}", "\u{1F949}"];
  const [selectedGame, setSelectedGame] = useState(null);

  const activeGames = (games || []).filter(g => g.is_active === 1);

  const gameRanking = useMemo(() => {
    if (selectedGame === null) return [];
    return buildGameRanking(sessions || [], selectedGame);
  }, [sessions, selectedGame]);

  const chipStyle = (active) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
    cursor: "pointer",
    border: "none",
    background: active ? "#0090d9" : "#fff",
    color: active ? "#fff" : "#4a5568",
    boxShadow: active ? "0 2px 8px rgba(0,144,217,0.3)" : "0 1px 3px rgba(0,0,0,0.08)",
    transition: "all 0.2s",
  });

  return (
    <div>
      <PageHeader emoji="\u{1F3C6}" title="\u30E9\u30F3\u30AD\u30F3\u30B0" />

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 0 12px", marginBottom: 8 }}>
        <button style={chipStyle(selectedGame === null)} onClick={() => setSelectedGame(null)}>
          🏆 総合ALT
        </button>
        {activeGames.map(g => (
          <button key={g.id} style={chipStyle(selectedGame === g.id)} onClick={() => setSelectedGame(g.id)}>
            {g.emoji || "🎮"} {g.name}
          </button>
        ))}
      </div>

      {/* 総合ALT ranking */}
      {selectedGame === null && (
        ranking.length > 0 ? (
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
        )
      )}

      {/* Game-specific ranking */}
      {selectedGame !== null && (
        gameRanking.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {gameRanking.map((r, i) => {
              const rank = i + 1;
              const isMe = r.student_name === studentName;
              return (
                <div key={r.student_name} style={{ display: "flex", alignItems: "center", gap: 10, background: isMe ? "linear-gradient(135deg, #e3f2fd, #e8eaf6)" : "#fff", borderRadius: 12, padding: "12px 14px", border: isMe ? "1px solid #90caf9" : "1px solid #e8ecf2" }}>
                  <span style={{ fontSize: 20, width: 32, textAlign: "center", fontWeight: 800 }}>{medals[rank] || rank}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: isMe ? 800 : 600, color: "#2d3748" }}>
                    {r.student_name} {isMe && <span style={{ fontSize: 10, color: "#0090d9" }}>← あなた</span>}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#e8a020", fontFamily: "'Orbitron', monospace" }}>{r.score}%</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#a0aec0", fontSize: 14 }}>まだランキングデータがありません</div>
        )
      )}
    </div>
  );
}
