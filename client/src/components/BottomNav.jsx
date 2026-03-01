import { TABS } from "../constants";

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      width: "100%",
      height: "calc(60px + env(safe-area-inset-bottom, 0px))",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)",
      borderTop: "1px solid #e8ecf2",
      display: "flex", justifyContent: "space-around", alignItems: "center",
      zIndex: 100,
    }}>
      {TABS.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <div key={tab.id} onClick={() => onTabChange(tab.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", opacity: isActive ? 1 : 0.4 }}>
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
            <span style={{ fontSize: 9, fontWeight: isActive ? 800 : 600, color: isActive ? "#0090d9" : "#718096" }}>{tab.label}</span>
            {isActive && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#0090d9", marginTop: -1 }} />}
          </div>
        );
      })}
    </div>
  );
}
