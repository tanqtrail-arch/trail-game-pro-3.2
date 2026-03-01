import { RANK_COLORS } from "../constants";

function StatPill({ icon, value, label, color }) {
  return (
    <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 8px", textAlign: "center", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(10px)" }}>
      <div style={{ fontSize: 16 }}>{icon}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color, marginTop: 2, fontFamily: "'Orbitron', monospace" }}>{value}</div>
      <div style={{ fontSize: 9, opacity: 0.4, marginTop: 1, letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

export default function StatusHeader({ student, gameCount }) {
  const rc = RANK_COLORS[student.rank] || RANK_COLORS.F;
  return (
    <div style={{ background: "linear-gradient(135deg, #0f1628 0%, #1a2444 50%, #0d1a3a 100%)", borderRadius: 20, padding: "24px 20px", color: "#fff", position: "relative", overflow: "hidden", marginBottom: 16 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3, pointerEvents: "none" }}>
        {[...Array(12)].map((_, i) => (
          <div key={i} style={{ position: "absolute", width: 2 + Math.random() * 3, height: 2 + Math.random() * 3, background: "#fff", borderRadius: "50%", top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`, animationDelay: `${Math.random() * 2}s` }} />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${rc.bg}, ${rc.bg}99)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", boxShadow: `0 0 20px ${rc.glow}, 0 4px 12px rgba(0,0,0,0.3)`, border: "2px solid rgba(255,255,255,0.2)" }}>
          {student.avatar}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, opacity: 0.6, letterSpacing: 1, fontFamily: "'Orbitron', monospace" }}>EXPLORER</div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>{student.name}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${rc.bg}, ${rc.bg}cc)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, fontFamily: "'Orbitron', monospace", boxShadow: `0 0 16px ${rc.glow}` }}>
            {student.rank}
          </div>
          <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>{student.rankLabel}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 20, position: "relative" }}>
        <StatPill icon="🪙" value={student.totalAlt.toLocaleString()} label="ALT" color="#e8a020" />
        <StatPill icon="🔥" value={`${student.streak}日`} label="連続" color="#ff6b35" />
        <StatPill icon="🎮" value={String(gameCount)} label="ゲーム数" color="#0090d9" />
      </div>
    </div>
  );
}
