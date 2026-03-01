import Section from "./Section";

function MissionCard({ mission, isWeekly }) {
  const done = mission.progress >= mission.goal;
  const pct = Math.min(100, (mission.progress / mission.goal) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: done ? "linear-gradient(135deg, #e8f5e9, #f1f8e9)" : "#fff", borderRadius: 14, padding: "12px 14px", border: done ? "1px solid #a5d6a7" : "1px solid #e8ecf2", opacity: done ? 0.7 : 1, transition: "all 0.2s" }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: isWeekly ? "linear-gradient(135deg, #7c5cbf22, #7c5cbf11)" : "linear-gradient(135deg, #0090d922, #0090d911)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
        {done ? "✅" : mission.emoji}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#2d3748", lineHeight: 1.3 }}>
          {mission.title}
          {isWeekly && <span style={{ fontSize: 10, background: "#7c5cbf22", color: "#7c5cbf", padding: "1px 6px", borderRadius: 6, marginLeft: 6 }}>週間</span>}
        </div>
        {!done && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: "#e8ecf2", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: isWeekly ? "#7c5cbf" : "#0090d9", borderRadius: 4, transition: "width 0.5s" }} />
            </div>
            <span style={{ fontSize: 10, color: "#a0aec0", fontWeight: 600 }}>{mission.progress}/{mission.goal}</span>
          </div>
        )}
      </div>
      <div style={{ background: done ? "#2cb56222" : "#e8a02022", color: done ? "#2cb562" : "#e8a020", padding: "3px 8px", borderRadius: 8, fontSize: 12, fontWeight: 800, fontFamily: "'Orbitron', monospace", whiteSpace: "nowrap" }}>
        +{mission.reward}
      </div>
    </div>
  );
}

export default function MissionSection({ missions }) {
  const daily = missions.filter(m => m.category === "daily");
  const weekly = missions.filter(m => m.category === "weekly");
  return (
    <Section title="今日のミッション" emoji="🎯" badge={`${daily.filter(m => m.progress >= m.goal).length}/${daily.length}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {daily.map(m => <MissionCard key={m.id} mission={m} />)}
        {weekly.map(m => <MissionCard key={m.id} mission={m} isWeekly />)}
      </div>
    </Section>
  );
}
