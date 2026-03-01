import { useMemo } from "react";
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

export default function MypageTab({ student, streak, sessions, playedGameCount, coins, onLogout }) {
  const rc = RANK_COLORS[student.rank] || RANK_COLORS.F;
  const stats = [
    { icon: "🎮", label: "プレイゲーム数", value: String(playedGameCount) },
    { icon: "🕹️", label: "総プレイ回数", value: String(sessions.length) },
    { icon: "🔥", label: "連続ログイン", value: `${student.streak}日` },
  ];

  const altByGame = useMemo(() => buildAltByGame(coins), [coins]);
  const maxAlt = altByGame.length > 0 ? altByGame[0].total : 0;

  return (
    <div>
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
      {altByGame.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "18px 16px", marginBottom: 16, border: "1px solid #e8ecf2" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#2d3748", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>📊</span> ALT獲得履歴
          </div>
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
          </div>
        </div>
      )}

      <button
        onClick={onLogout}
        style={{
          width: "100%", padding: "14px", borderRadius: 12,
          background: "transparent", border: "1px solid #e05070",
          color: "#e05070", fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}
      >
        ログアウト
      </button>
    </div>
  );
}
