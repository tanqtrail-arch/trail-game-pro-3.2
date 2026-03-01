import PageHeader from "../components/PageHeader";

export default function GamesTab({ games }) {
  const active = games.filter(g => g.is_active === 1);
  const categories = [...new Set(active.map(g => g.category))];
  return (
    <div style={{ width: "100%" }}>
      <PageHeader emoji="🎮" title="ゲーム一覧" />
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#718096", marginBottom: 8, paddingLeft: 2 }}>{cat}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, width: "100%" }}>
            {active.filter(g => g.category === cat).map(g => {
              const hasUrl = !!g.url;
              return (
                <div
                  key={g.id}
                  onClick={() => hasUrl && window.open(g.url, '_blank')}
                  style={{
                    background: hasUrl ? "#fff" : "#f0f2f5",
                    borderRadius: 16, padding: 16, border: "1px solid #e8ecf2",
                    cursor: hasUrl ? "pointer" : "default",
                    opacity: hasUrl ? 1 : 0.5,
                    transition: "all 0.2s",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 36, marginBottom: 8 }}>{g.emoji || '🎮'}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2d3748", lineHeight: 1.3 }}>{g.name}</div>
                  {!hasUrl && <div style={{ fontSize: 10, color: "#a0aec0", marginTop: 4 }}>準備中</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {active.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#a0aec0", fontSize: 14 }}>ゲームがありません</div>
      )}
    </div>
  );
}
