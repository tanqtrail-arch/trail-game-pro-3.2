import { useState, useEffect } from "react";
import { useTrailData, buildRecentGames, buildWeeklyRanking, buildSubjectLevels, buildMissions } from "./hooks/useTrailData";
import * as api from "./api/trailApi";

const RANK_COLORS = {
  F: { bg: "#78909c", glow: "#78909c33" },
  E: { bg: "#43a047", glow: "#43a04733" },
  D: { bg: "#1e88e5", glow: "#1e88e533" },
  C: { bg: "#8e24aa", glow: "#8e24aa33" },
  B: { bg: "#f4511e", glow: "#f4511e33" },
  A: { bg: "#fdd835", glow: "#fdd83533" },
  S: { bg: "#e91e63", glow: "#e91e6333" },
};

// ─── Login Screen ──────────────────────────────────
function LoginScreen({ onLogin }) {
  const [name, setName] = useState('');
  const [className, setClassName] = useState('探究個別');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.loginStudent(name.trim(), className);
      const sid = data.student?.id || data.studentId || data.id;
      if (sid) {
        onLogin(sid);
      } else {
        setError('生徒が見つかりませんでした');
      }
    } catch (err) {
      setError(err.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(180deg, #0f1628 0%, #1a2444 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Noto+Sans+JP:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Orbitron', monospace", background: "linear-gradient(135deg, #0090d9, #7c5cbf)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 4 }}>
        TRAIL GP3
      </div>
      <div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 40, letterSpacing: 2 }}>EXPLORE · PLAY · GROW</div>

      <div style={{ width: "100%", maxWidth: 320 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16, textAlign: "center" }}>なまえを入力してログイン</div>

        <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 6 }}>クラス</div>
        <select
          value={className}
          onChange={e => setClassName(e.target.value)}
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 12, marginBottom: 12,
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff", fontSize: 14, outline: "none",
            fontFamily: "'Noto Sans JP', sans-serif",
          }}
        >
          <option value="探究個別" style={{ color: "#000" }}>探究個別</option>
        </select>

        <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 6 }}>なまえ</div>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder="ひらがなで名前を入力"
          style={{
            width: "100%", padding: "14px 16px", borderRadius: 12,
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff", fontSize: 16, outline: "none",
            fontFamily: "'Noto Sans JP', sans-serif",
          }}
        />
        {error && (
          <div style={{ color: "#e05070", fontSize: 12, marginTop: 8, textAlign: "center" }}>{error}</div>
        )}
        <button
          onClick={handleLogin}
          disabled={loading || !name.trim()}
          style={{
            width: "100%", padding: "14px", borderRadius: 12, marginTop: 16,
            background: name.trim() ? "linear-gradient(135deg, #0090d9, #7c5cbf)" : "rgba(255,255,255,0.1)",
            border: "none", color: "#fff", fontSize: 15, fontWeight: 700,
            cursor: name.trim() ? "pointer" : "default",
            opacity: loading ? 0.6 : 1,
            transition: "all 0.2s",
          }}
        >
          {loading ? '読み込み中...' : 'ログイン ▶'}
        </button>
      </div>
    </div>
  );
}

// ─── UI Components ──────────────────────────────────

function StatusHeader({ student, gameCount }) {
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

function StatPill({ icon, value, label, color }) {
  return (
    <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 8px", textAlign: "center", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(10px)" }}>
      <div style={{ fontSize: 16 }}>{icon}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color, marginTop: 2, fontFamily: "'Orbitron', monospace" }}>{value}</div>
      <div style={{ fontSize: 9, opacity: 0.4, marginTop: 1, letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

function MissionSection({ missions }) {
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

function RecentGamesSection({ recent, games }) {
  return (
    <Section title="最近プレイ" emoji="🕹️" action="すべて見る →">
      {recent.length > 0 ? (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {recent.map(g => (
            <div key={g.id} style={{ minWidth: 140, background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #e8ecf2", cursor: "pointer", transition: "all 0.2s" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{g.emoji}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#2d3748", lineHeight: 1.3, marginBottom: 4 }}>{g.name}</div>
              <div style={{ fontSize: 10, color: "#a0aec0", marginBottom: 8 }}>{g.lastPlayed}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ flex: 1, height: 4, background: "#e8ecf2", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${g.lastScore}%`, height: "100%", borderRadius: 4, background: g.lastScore >= 80 ? "#2cb562" : g.lastScore >= 50 ? "#e8a020" : "#e05070" }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#2d3748", fontFamily: "'Orbitron', monospace" }}>{g.lastScore}%</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "20px 0", color: "#a0aec0", fontSize: 13 }}>
          まだプレイ記録がありません 🎮
        </div>
      )}
    </Section>
  );
}

function SubjectLevels({ subjects }) {
  const colors = { "算数": "#0090d9", "社会": "#2cb562", "理科": "#e8a020", "国語": "#e05070", "歴史": "#8e24aa", "地理": "#00897b", "思考系": "#5c6bc0" };
  if (subjects.length === 0) return null;
  return (
    <Section title="科目レベル" emoji="📊">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {subjects.map(s => {
          const c = colors[s.subject] || "#718096";
          const pct = Math.min(100, (s.totalAlt / s.nextAt) * 100);
          return (
            <div key={s.subject} style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", border: "1px solid #e8ecf2" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#2d3748" }}>{s.emoji} {s.subject}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: c, background: `${c}15`, padding: "2px 8px", borderRadius: 8, fontFamily: "'Orbitron', monospace" }}>Lv.{s.level}</span>
              </div>
              <div style={{ fontSize: 10, color: "#a0aec0", marginTop: 4 }}>{s.title}</div>
              <div style={{ marginTop: 6, height: 4, background: "#e8ecf2", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: c, borderRadius: 4, transition: "width 0.5s" }} />
              </div>
              <div style={{ fontSize: 9, color: "#a0aec0", marginTop: 3, textAlign: "right" }}>{s.totalAlt}/{s.nextAt} ALT</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function WeeklyRanking({ ranking }) {
  const medals = ["", "🥇", "🥈", "🥉"];
  if (ranking.length === 0) return null;
  return (
    <Section title="今週のランキング" emoji="🏆">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ranking.map(r => (
          <div key={r.rank} style={{ display: "flex", alignItems: "center", gap: 10, background: r.isMe ? "linear-gradient(135deg, #e3f2fd, #e8eaf6)" : "#fff", borderRadius: 12, padding: "10px 14px", border: r.isMe ? "1px solid #90caf9" : "1px solid #e8ecf2" }}>
            <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{medals[r.rank] || r.rank}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: r.isMe ? 800 : 600, color: "#2d3748" }}>
              {r.name} {r.isMe && <span style={{ fontSize: 10, color: "#0090d9" }}>← あなた</span>}
            </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#e8a020", fontFamily: "'Orbitron', monospace" }}>{r.alt}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Tab Pages ──────────────────────────────────────

function PageHeader({ emoji, title }) {
  return (
    <div style={{ padding: "16px 4px 12px", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color: "#2d3748", letterSpacing: -0.3 }}>{title}</span>
    </div>
  );
}

function GamesTab({ games }) {
  const active = games.filter(g => g.is_active === 1);
  const categories = [...new Set(active.map(g => g.category))];
  return (
    <div>
      <PageHeader emoji="🎮" title="ゲーム一覧" />
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#718096", marginBottom: 8, paddingLeft: 2 }}>{cat}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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

function RankingTab({ ranking }) {
  const medals = ["", "🥇", "🥈", "🥉"];
  return (
    <div>
      <PageHeader emoji="🏆" title="ランキング" />
      {ranking.length > 0 ? (
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
      )}
    </div>
  );
}

function MypageTab({ student, streak, sessions, playedGameCount, onLogout }) {
  const rc = RANK_COLORS[student.rank] || RANK_COLORS.F;
  const stats = [
    { icon: "🎮", label: "プレイゲーム数", value: String(playedGameCount) },
    { icon: "🕹️", label: "総プレイ回数", value: String(sessions.length) },
    { icon: "🔥", label: "連続ログイン", value: `${student.streak}日` },
  ];
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

function CoursesTab() {
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

function Section({ title, emoji, badge, action, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>{emoji}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#2d3748", letterSpacing: -0.3 }}>{title}</span>
          {badge && <span style={{ fontSize: 10, fontWeight: 700, background: "#0090d922", color: "#0090d9", padding: "2px 8px", borderRadius: 10 }}>{badge}</span>}
        </div>
        {action && <span style={{ fontSize: 11, color: "#0090d9", fontWeight: 600, cursor: "pointer" }}>{action}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────
const TABS = [
  { id: 'home', icon: "🏠", label: "ホーム" },
  { id: 'games', icon: "🎮", label: "ゲーム" },
  { id: 'courses', icon: "📚", label: "コース" },
  { id: 'ranking', icon: "🏆", label: "ランキング" },
  { id: 'mypage', icon: "👤", label: "マイページ" },
];

export default function App() {
  const [studentId, setStudentId] = useState(api.getStoredStudentId());
  const [loginMode, setLoginMode] = useState(!api.isLoggedIn());
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  const { student, games, coins, streak, rankings, sessions, loading, error } = useTrailData(studentId);

  useEffect(() => { if (!loading) setTimeout(() => setLoaded(true), 100); }, [loading]);

  const handleLogin = (id) => {
    localStorage.setItem('trail_student_id', id);
    setStudentId(id);
    setLoginMode(false);
  };

  const handleLogout = () => {
    api.logout();
    setStudentId(null);
    setLoginMode(true);
    setLoaded(false);
    setActiveTab('home');
  };

  if (loginMode) return <LoginScreen onLogin={handleLogin} />;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#eef1f8" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
        <div style={{ fontSize: 14, color: "#a0aec0" }}>データを読み込み中...</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#eef1f8", padding: 20 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 14, color: "#e05070", marginBottom: 12 }}>{error}</div>
        <button onClick={() => window.location.reload()} style={{ padding: "8px 24px", borderRadius: 8, border: "1px solid #0090d9", background: "transparent", color: "#0090d9", cursor: "pointer" }}>再読み込み</button>
      </div>
    </div>
  );

  const studentData = {
    name: student?.name || '---',
    rank: student?.rank || 'F',
    rankLabel: student?.rankLabel || '見習い',
    totalAlt: student?.totalAlt || 0,
    streak: streak?.streak?.current || 0,
    avatar: (student?.name || '?').charAt(0),
  };

  const playedGameCount = new Set(sessions.map(s => s.game_id)).size;
  const recentGames = buildRecentGames(sessions, games);
  const weeklyRanking = buildWeeklyRanking(rankings, studentId);
  const subjectLevels = buildSubjectLevels(coins, games);
  const missions = buildMissions(sessions, streak);

  const renderTab = () => {
    switch (activeTab) {
      case 'games':
        return <GamesTab games={games} />;
      case 'courses':
        return <CoursesTab />;
      case 'ranking':
        return <RankingTab ranking={weeklyRanking} />;
      case 'mypage':
        return <MypageTab student={studentData} streak={streak} sessions={sessions} playedGameCount={playedGameCount} onLogout={handleLogout} />;
      default:
        return (
          <>
            <StatusHeader student={studentData} gameCount={playedGameCount} />
            <MissionSection missions={missions} />
            <RecentGamesSection recent={recentGames} games={games} />
            <SubjectLevels subjects={subjectLevels} />
            <WeeklyRanking ranking={weeklyRanking} />
          </>
        );
    }
  };

  return (
    <div style={{
      maxWidth: 480, margin: "0 auto", padding: "0 12px 80px",
      fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
      background: "linear-gradient(180deg, #eef1f8 0%, #f6f7fb 40%, #f0f2f5 100%)",
      minHeight: "100vh",
      opacity: loaded ? 1 : 0,
      transform: loaded ? "none" : "translateY(8px)",
      transition: "all 0.4s ease-out",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Noto+Sans+JP:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { height: 4px; }
        ::-webkit-scrollbar-thumb { background: #d0d5dd; border-radius: 4px; }
      `}</style>

      {activeTab === 'home' && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 4px 12px" }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -1, fontFamily: "'Orbitron', monospace", background: "linear-gradient(135deg, #0090d9, #7c5cbf)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            TRAIL GP3
          </div>
          <span style={{ fontSize: 11, color: "#a0aec0" }}>{student?.class_name || ''}</span>
        </div>
      )}

      {renderTab()}

      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480,
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)",
        borderTop: "1px solid #e8ecf2",
        display: "flex", justifyContent: "space-around", padding: "8px 0 12px", zIndex: 100,
      }}>
        {TABS.map(tab => {
          const isActive = tab.id === activeTab;
          return (
            <div key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", opacity: isActive ? 1 : 0.4 }}>
              <span style={{ fontSize: 20 }}>{tab.icon}</span>
              <span style={{ fontSize: 9, fontWeight: isActive ? 800 : 600, color: isActive ? "#0090d9" : "#718096" }}>{tab.label}</span>
              {isActive && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#0090d9", marginTop: -1 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
