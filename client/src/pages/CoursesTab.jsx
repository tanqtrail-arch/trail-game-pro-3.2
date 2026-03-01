import PageHeader from "../components/PageHeader";

export default function CoursesTab() {
  return (
    <div>
      <PageHeader emoji="📚" title="コース" />
      <div style={{ textAlign: "center", padding: "60px 0", color: "#a0aec0" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>準備中です</div>
        <div style={{ fontSize: 13, marginTop: 8 }}>コース機能は近日公開予定です</div>
      </div>
    </div>
  );
}
