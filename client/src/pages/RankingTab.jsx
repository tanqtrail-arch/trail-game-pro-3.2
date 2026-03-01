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

  const gameButtonStyle = (active) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px 8px",
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    border: active ? "2px solid #0090d9" : "1px solid #e8ecf2",
    minHeight: 48,
    background: active ? "linear-gradient(135deg, #e3f2fd, #e8eaf6)" : "#fff",
    color: active ? "#0090d9" : "#4a5568",
    boxShadow: active ? "0 2px 8px rgba(0,144,217,0.15)" : "none",
    transition: "all 0.2s",
    width: "100%",
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

  // 選択中のゲーム情報
  const selectedGameInfo = selectedGame === null
    ? { emoji: "🏆", name: "総合ALT" }
    : (() => { const g = activeGames.find(g => g.id === selectedGame); return g ? { emoji: g.emoji || "🎮", name: g.name } : { emoji: "🎮", name: "---" }; })();

  // グリッドに表示するゲーム（選択中のものを除外）
  const otherGames = selectedGame === null
    ? activeGames
    : [{ id: null, emoji: "🏆", name: "総合ALT" }, ...activeGames.filter(g => g.id !== selectedGame)];

  return (
    <div style={{ width: "100%" }}>
      <PageHeader emoji="🏆" title="ランキング" />

      {/* 1. 選択中のゲーム名 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px", marginBottom: 10,
        background: "linear-gradient(135deg, #0f1628, #1a2444)",
        borderRadius: 14, color: "#fff",
      }}>
        <span style={{ fontSize: 28 }}>{selectedGameInfo.emoji}</span>
        <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>{selectedGameInfo.name}</span>
      </div>

      {/* 2. 期間切り替えタブ */}
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

      {/* 3. ランキング結果一覧 */}
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

      {/* 4. 区切り */}
      <div style={{ borderTop: "1px solid #e8ecf2", margin: "20px 0 16px" }} />

      {/* 5. 他のゲームを選ぶグリッド */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, paddingLeft: 2 }}>
        <span style={{ fontSize: 15 }}>🎮</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#718096" }}>他のゲームのランキング</span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 8,
      }}>
        {otherGames.map(g => (
          <button key={g.id ?? '_overall'} style={gameButtonStyle(false)} onClick={() => setSelectedGame(g.id)}>
            <span style={{ fontSize: 18 }}>{g.emoji || "🎮"}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
