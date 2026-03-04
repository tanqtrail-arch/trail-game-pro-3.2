import { useMemo, useState } from "react";
import { RANK_COLORS } from "../constants";
import PageHeader from "../components/PageHeader";

function buildAltByGame(coins) {
  const map = {};
  (coins || []).forEach(c => {
    if (!c.game_name || !c.amount) return;
    const key = c.game_name;
    if (!map[key]) map[key] = { game_name: key, emoji: c.game_emoji || "🎮", total: 0 };
    map[key].total += c.amount;
  });
  return Object.values(map)
    .filter(g => g.total > 0)
    .sort((a, b) => b.total - a.total);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

const HISTORY_PAGE_SIZE = 20;

export default function MypageTab({ student, streak, sessions, playedGameCount, coins, onLogout }) {
  const rc = RANK_COLORS[student.rank] || RANK_COLORS.F;
  const stats = [
    { icon: "🎮", label: "プレイゲーム数", value: String(playedGameCount) },
    { icon: "🕹️", label: "総プレイ回数", value: String(sessions.length) },
    { icon: "🔥", label: "連続ログイン", value: `${student.streak}日` },
  ];

  const altByGame = useMemo(() => buildAltByGame(coins), [coins]);
  const maxAlt = altByGame.length > 0 ? altByGame[0].total : 0;

  const [historyTab, setHistoryTab] = useState("recent");
  const [showCount, setShowCount] = useState(HISTORY_PAGE_SIZE);

  const sortedCoins = useMemo(
    () => (coins || []).filter(c => c.amount).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [coins],
  );
  const visibleCoins = sortedCoins.slice(0, showCount);
  const hasMore = showCount < sortedCoins.length;

  const tabStyle = (active) => ({
    flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
    border: "none", cursor: "pointer",
    background: active ? "#0090d9" : "transparent",
    color: active ? "#fff" : "#718096",
    transition: "all 0.2s",
  });

  return (
    <div style={{ width: "100%" }}>
      <PageHeader emoji="👤" title="マイページ" />
      <div style={{ background: "linear-gradient(135deg, #0f1628 0%, #1a2444 50%, #0d1a3a 100%)", borderRadius: 20, padding: "28px 20px", color: "#fff", textAlign: "center", marginBottom: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: `linear-gradient(135deg, ${rc.bg}, ${rc.bg}99)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, margin: "0 auto 12px", boxShadow: `0 0 24px ${rc.glow}`, border: "2px solid rgba(255,255,255,0.2)" }}>
          {student.avatar}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{student.name}</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8, background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "6px 16px" }}>
          <span style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Orbitron', monospace", color: rc.bg }}>{student.rank}</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{student.rankLabel}</span>
        </div>
        <div style={{ marginTop: 12, fontSize: 24, fontWeight: 900, color: "#e8a020", fontFamily: "'Orbitron', monospace" }}>
          {student.totalAlt.toLocaleString()}
          <span style={{ fontSize: 12, opacity: 0.6, marginLeft: 4 }}>ALT</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, background: "#fff", borderRadius: 14, padding: "14px 8px", textAlign: "center", border: "1px solid #e8ecf2" }}>
            <div style={{ fontSize: 18 }}>{s.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#2d3748", marginTop: 4, fontFamily: "'Orbitron', monospace" }}>{s.value}</div>
            <div style={{ fontSize: 9, color: "#a0aec0", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ALT獲得履歴 */}
      {(sortedCoins.length > 0 || altByGame.length > 0) && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "18px 16px", marginBottom: 16, border: "1px solid #e8ecf2" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#2d3748", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>📊</span> ALT獲得履歴
          </div>

          {/* タブ切り替え */}
          <div style={{ display: "flex", gap: 4, background: "#f0f2f5", borderRadius: 10, padding: 3, marginBottom: 14 }}>
            <button style={tabStyle(historyTab === "recent")} onClick={() => setHistoryTab("recent")}>
              新着順
            </button>
            <button style={tabStyle(historyTab === "game")} onClick={() => setHistoryTab("game")}>
              ゲーム別
            </button>
          </div>

          {/* 新着順 */}
          {historyTab === "recent" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {visibleCoins.map((c, i) => (
                <div key={c.id || i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: i < visibleCoins.length - 1 ? "1px solid #f0f2f5" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{c.game_emoji || "🎮"}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#2d3748", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.game_name || c.note || "ALT獲得"}
                      </div>
                      <div style={{ fontSize: 10, color: "#a0aec0", marginTop: 1 }}>
                        {formatDate(c.created_at)}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 800, fontFamily: "'Orbitron', monospace", flexShrink: 0, marginLeft: 8,
                    color: c.amount > 0 ? "#e8a020" : "#e05070",
                  }}>
                    {c.amount > 0 ? "+" : ""}{c.amount.toLocaleString()}
                    <span style={{ fontSize: 9, color: "#a0aec0", marginLeft: 2 }}>ALT</span>
                  </span>
                </div>
              ))}
              {hasMore && (
                <button
                  onClick={() => setShowCount(prev => prev + HISTORY_PAGE_SIZE)}
                  style={{
                    marginTop: 10, padding: "8px", width: "100%", border: "1px solid #e2e8f0",
                    borderRadius: 8, background: "#f7fafc", color: "#4a5568", fontSize: 12,
                    fontWeight: 600, cursor: "pointer",
                  }}
                >
                  もっと見る（残り{sortedCoins.length - showCount}件）
                </button>
              )}
              {sortedCoins.length === 0 && (
                <div style={{ textAlign: "center", color: "#a0aec0", fontSize: 12, padding: "16px 0" }}>
                  まだ獲得履歴がありません
                </div>
              )}
            </div>
          )}

          {/* ゲーム別 */}
          {historyTab === "game" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {altByGame.map(g => (
                <div key={g.game_name}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>
                      {g.emoji} {g.game_name}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#e8a020", fontFamily: "'Orbitron', monospace" }}>
                      {g.total.toLocaleString()} <span style={{ fontSize: 9, color: "#a0aec0", fontFamily: "inherit" }}>ALT</span>
                    </span>
                  </div>
                  <div style={{ height: 8, background: "#f0f2f5", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.max(4, (g.total / maxAlt) * 100)}%`,
                      background: "linear-gradient(90deg, #0090d9, #00b4d8)",
                      borderRadius: 4,
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
              ))}
              {altByGame.length === 0 && (
                <div style={{ textAlign: "center", color: "#a0aec0", fontSize: 12, padding: "16px 0" }}>
                  まだ獲得履歴がありません
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={onLogout}
        style={{
          width: "100%", padding: "14px", borderRadius: 12,
          minHeight: 44,
          background: "transparent", border: "1px solid #e05070",
          color: "#e05070", fontSize: 16, fontWeight: 700, cursor: "pointer",
        }}
      >
        ログアウト
      </button>
    </div>
  );
}
