import { useState, useMemo, useEffect, useCallback } from "react";
import PageHeader from "../components/PageHeader";
import { getRankings } from "../api/trailApi";

function buildGameRanking(sessions, gameId) {
  const gameSessions = sessions.filter(s => s.game_id === gameId);
  const best = {};
  gameSessions.forEach(s => {
    const name = s.student_name;
    const score = s.score;
    const pct = s.accuracy_pct;
    const sortVal = score ?? pct ?? 0;
    if (!best[name] || sortVal > (best[name].sortVal)) {
      best[name] = { score, accuracy_pct: pct, sortVal };
    }
  });
  return Object.entries(best)
    .map(([name, d]) => ({ student_name: name, score: d.score, accuracy_pct: d.accuracy_pct }))
    .sort((a, b) => (b.score ?? b.accuracy_pct ?? 0) - (a.score ?? a.accuracy_pct ?? 0))
    .slice(0, 10);
}

const PERIODS = [
  { key: "weekly", label: "週間" },
  { key: "monthly", label: "月間" },
  { key: "all", label: "累計" },
];

export default function RankingTab({ ranking, games, studentName, studentId, sessions }) {
  const medals = ["", "🥇", "🥈", "🥉"];
  const [selectedGame, setSelectedGame] = useState(null);
  const [period, setPeriod] = useState("weekly");
  const [periodRankings, setPeriodRankings] = useState({});
  const [loadingPeriod, setLoadingPeriod] = useState(false);

  const activeGames = (games || []).filter(g => g.is_active === 1);

  // Fetch rankings for a specific period
  const fetchPeriodRanking = useCallback(async (p) => {
    if (periodRankings[p]) return; // already cached
    setLoadingPeriod(true);
    try {
      const data = await getRankings(p);
      const list = Array.isArray(data.rankings) ? data.rankings : [];
      setPeriodRankings(prev => ({ ...prev, [p]: list }));
    } catch {
      setPeriodRankings(prev => ({ ...prev, [p]: [] }));
    } finally {
      setLoadingPeriod(false);
    }
  }, [periodRankings]);

  useEffect(() => {
    if (selectedGame === null) {
      fetchPeriodRanking(period);
    }
  }, [period, selectedGame, fetchPeriodRanking]);

  // Build the overall ALT ranking for current period (top 5 + my rank)
  const { top5, myEntry } = useMemo(() => {
    const raw = periodRankings[period] || [];
    const sorted = [...raw]
      .sort((a, b) => (b.total_coins || 0) - (a.total_coins || 0))
      .map((r, i) => ({
        rank: i + 1,
        name: r.student_name || r.name || "---",
        alt: r.total_coins || 0,
        isMe: String(r.student_id) === String(studentId),
      }));

    const topItems = sorted.slice(0, 5);
    const me = sorted.find(r => r.isMe);
    const meInTop5 = topItems.some(r => r.isMe);

    return {
      top5: topItems,
      myEntry: me && !meInTop5 ? me : null,
    };
  }, [periodRankings, period, studentId]);

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

  const periodChipStyle = (active) => ({
    padding: "5px 14px",
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    background: active ? "#2d3748" : "transparent",
    color: active ? "#fff" : "#718096",
    transition: "all 0.2s",
  });

  const renderRankRow = (r, opts = {}) => {
    const { separator } = opts;
    return (
      <div key={`rank-${r.rank}`}>
        {separator && (
          <div style={{ textAlign: "center", color: "#cbd5e0", fontSize: 12, padding: "4px 0", letterSpacing: 4 }}>・・・</div>
        )}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: r.isMe ? "linear-gradient(135deg, #e3f2fd, #e8eaf6)" : "#fff",
          borderRadius: 12, padding: "12px 14px",
          border: r.isMe ? "1px solid #90caf9" : "1px solid #e8ecf2",
        }}>
          <span style={{ fontSize: 20, width: 32, textAlign: "center", fontWeight: 800 }}>{medals[r.rank] || r.rank}</span>
          <span style={{ flex: 1, fontSize: 14, fontWeight: r.isMe ? 800 : 600, color: "#2d3748" }}>
            {r.name} {r.isMe && <span style={{ fontSize: 10, color: "#0090d9" }}>← あなた</span>}
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#e8a020", fontFamily: "'Orbitron', monospace" }}>{r.alt.toLocaleString()}</span>
          <span style={{ fontSize: 10, color: "#a0aec0" }}>ALT</span>
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader emoji="🏆" title="ランキング" />

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 0 12px", marginBottom: 4 }}>
        <button style={chipStyle(selectedGame === null)} onClick={() => setSelectedGame(null)}>
          🏆 総合ALT
        </button>
        {activeGames.map(g => (
          <button key={g.id} style={chipStyle(selectedGame === g.id)} onClick={() => setSelectedGame(g.id)}>
            {g.emoji || "🎮"} {g.name}
          </button>
        ))}
      </div>

      {/* Period toggle — only for overall ALT */}
      {selectedGame === null && (
        <div style={{
          display: "flex", gap: 2, background: "#f0f2f5", borderRadius: 20,
          padding: 3, marginBottom: 12, width: "fit-content",
        }}>
          {PERIODS.map(p => (
            <button key={p.key} style={periodChipStyle(period === p.key)} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* 総合ALT ranking — top 5 + my rank */}
      {selectedGame === null && (
        loadingPeriod && !periodRankings[period] ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#a0aec0", fontSize: 14 }}>読み込み中...</div>
        ) : top5.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {top5.map(r => renderRankRow(r))}
            {myEntry && renderRankRow(myEntry, { separator: true })}
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
                  <div style={{ textAlign: "right" }}>
                    {r.score != null ? (
                      <>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#e8a020", fontFamily: "'Orbitron', monospace" }}>{r.score.toLocaleString()}</span>
                        {r.accuracy_pct != null && <div style={{ fontSize: 10, color: "#a0aec0" }}>正解率 {r.accuracy_pct}%</div>}
                      </>
                    ) : r.accuracy_pct != null ? (
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#6c9" }}>正解率 {r.accuracy_pct}%</span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#a0aec0" }}>プレイ済み</span>
                    )}
                  </div>
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
