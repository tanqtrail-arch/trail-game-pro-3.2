import { useState, useEffect } from "react";
import * as api from "../api/trailApi";

export default function LoginScreen({ onLogin, expiredMessage }) {
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getClasses()
      .then(data => {
        if (cancelled) return;
        const list = data.classes || [];
        setClasses(list);
        if (list.length === 1) {
          setClassName(list[0].name);
        }
      })
      .catch(() => {
        // fallback: if API fails, allow manual entry
      })
      .finally(() => {
        if (!cancelled) setClassesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async () => {
    if (!name.trim() || !className) return;
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
      minHeight: "100vh", width: "100%", background: "linear-gradient(180deg, #0f1628 0%, #1a2444 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Noto+Sans+JP:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Orbitron', monospace", background: "linear-gradient(135deg, #0090d9, #7c5cbf)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 4 }}>
        TRAIL GP3
      </div>
      <div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 40, letterSpacing: 2 }}>EXPLORE · PLAY · GROW</div>

      <div style={{ width: "100%", maxWidth: 480 }}>
        {expiredMessage && (
          <div style={{ background: "rgba(224,80,112,0.15)", border: "1px solid rgba(224,80,112,0.3)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, textAlign: "center", fontSize: 13, color: "#ff8fa3" }}>
            {expiredMessage}
          </div>
        )}
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16, textAlign: "center" }}>なまえを入力してログイン</div>

        <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 6 }}>クラス</div>
        {classesLoading ? (
          <div style={{
            width: "100%", padding: "12px 16px", borderRadius: 12, marginBottom: 12,
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
            color: "#a0aec0", fontSize: 14,
            boxSizing: "border-box",
          }}>
            読み込み中...
          </div>
        ) : (
          <select
            value={className}
            onChange={e => setClassName(e.target.value)}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 12, marginBottom: 12,
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff", fontSize: 16, outline: "none",
              fontFamily: "'Noto Sans JP', sans-serif",
              boxSizing: "border-box",
            }}
          >
            {classes.length !== 1 && (
              <option value="" style={{ color: "#000" }}>クラスを選択</option>
            )}
            {classes.map(c => (
              <option key={c.id} value={c.name} style={{ color: "#000" }}>{c.name}</option>
            ))}
          </select>
        )}

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
            boxSizing: "border-box",
          }}
        />
        {error && (
          <div style={{ color: "#e05070", fontSize: 12, marginTop: 8, textAlign: "center" }}>{error}</div>
        )}
        <button
          onClick={handleLogin}
          disabled={loading || !name.trim() || !className}
          style={{
            width: "100%", padding: "14px", borderRadius: 12, marginTop: 16,
            minHeight: 44,
            background: (name.trim() && className) ? "linear-gradient(135deg, #0090d9, #7c5cbf)" : "rgba(255,255,255,0.1)",
            border: "none", color: "#fff", fontSize: 16, fontWeight: 700,
            cursor: (name.trim() && className) ? "pointer" : "default",
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
