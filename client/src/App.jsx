import { useState, useEffect } from "react";
import { useTrailData, buildRecentGames, buildWeeklyRanking, buildSubjectLevels, buildMissions } from "./hooks/useTrailData";
import * as api from "./api/trailApi";

import ErrorBoundary from "./components/ErrorBoundary";
import LoginScreen from "./components/LoginScreen";
import BottomNav from "./components/BottomNav";
import HomePage from "./pages/HomePage";
import GamesTab from "./pages/GamesTab";
import CoursesTab from "./pages/CoursesTab";
import RankingTab from "./pages/RankingTab";
import MypageTab from "./pages/MypageTab";

function AppInner() {
  const [studentId, setStudentId] = useState(api.getStoredStudentId());
  const [loginMode, setLoginMode] = useState(!api.isLoggedIn());
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [expiredMessage, setExpiredMessage] = useState(null);

  const { student, games, coins, streak, rankings, sessions, loading, error, failedSections } = useTrailData(studentId);

  useEffect(() => { if (!loading) setTimeout(() => setLoaded(true), 100); }, [loading]);

  useEffect(() => {
    const handleAuthExpired = () => {
      setStudentId(null);
      setLoginMode(true);
      setLoaded(false);
      setActiveTab('home');
      setExpiredMessage('セッションが切れました。再ログインしてください');
    };
    window.addEventListener('trail:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('trail:auth-expired', handleAuthExpired);
  }, []);

  const handleLogin = (id) => {
    localStorage.setItem('trail_student_id', id);
    setStudentId(id);
    setLoginMode(false);
    setExpiredMessage(null);
  };

  const handleLogout = () => {
    api.logout();
    setStudentId(null);
    setLoginMode(true);
    setLoaded(false);
    setActiveTab('home');
  };

  if (loginMode) return <LoginScreen onLogin={handleLogin} expiredMessage={expiredMessage} />;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#eef1f8", animation: "fadeIn 0.3s ease-out" }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16, animation: "pulse 1.5s ease-in-out infinite" }}>🚀</div>
        <div style={{ fontSize: 14, color: "#a0aec0", fontFamily: "'Noto Sans JP', sans-serif" }}>データを読み込み中...</div>
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
        return <HomePage studentData={studentData} playedGameCount={playedGameCount} missions={missions} recentGames={recentGames} subjectLevels={subjectLevels} weeklyRanking={weeklyRanking} failedSections={failedSections} />;
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

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
