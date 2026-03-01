import { useState, useEffect } from "react";
import PageHeader from "../components/PageHeader";
import { getCourses, likeCourse } from "../api/trailApi";

const TYPE_LABELS = {
  hakase: { label: "博士コース", color: "#0090d9" },
  designer: { label: "デザイナーコース", color: "#e05070" },
  expert: { label: "エキスパートコース", color: "#e8a020" },
};

export default function CoursesTab() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [likingId, setLikingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getCourses()
      .then(data => {
        if (!cancelled) setCourses(data.courses || []);
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleLike = async (courseId) => {
    if (likingId) return;
    setLikingId(courseId);
    try {
      const result = await likeCourse(courseId);
      setCourses(prev => prev.map(c =>
        c.id === courseId
          ? { ...c, liked: result.liked, likeCount: result.likeCount }
          : c
      ));
    } catch {
      // silently ignore
    } finally {
      setLikingId(null);
    }
  };

  // コースタイプ別にグループ化
  const grouped = {};
  courses.forEach(c => {
    const type = c.courseType || "other";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(c);
  });
  const typeOrder = ["hakase", "designer", "expert"];

  return (
    <div style={{ width: "100%" }}>
      <PageHeader emoji="📚" title="コース" />

      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#a0aec0", fontSize: 14 }}>
          読み込み中...
        </div>
      )}

      {error && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#e05070", fontSize: 14 }}>
          {error}
        </div>
      )}

      {!loading && !error && courses.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#a0aec0" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>コースがありません</div>
        </div>
      )}

      {!loading && !error && typeOrder.map(type => {
        const items = grouped[type];
        if (!items || items.length === 0) return null;
        const typeInfo = TYPE_LABELS[type] || { label: type, color: "#718096" };
        return (
          <div key={type} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: typeInfo.color,
              marginBottom: 8, paddingLeft: 2,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{
                background: `${typeInfo.color}18`, padding: "3px 10px",
                borderRadius: 10, fontSize: 11,
              }}>
                {typeInfo.label}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map(c => (
                <CourseCard
                  key={c.id}
                  course={c}
                  onLike={handleLike}
                  liking={likingId === c.id}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CourseCard({ course, onLike, liking }) {
  const isActive = course.status === "active";

  return (
    <div style={{
      background: "#fff",
      borderRadius: 16,
      padding: "16px",
      border: "1px solid #e8ecf2",
      transition: "all 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Emoji icon */}
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: "linear-gradient(135deg, #f0f4ff, #e8ecf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, flexShrink: 0,
        }}>
          {course.emoji}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#2d3748" }}>
              {course.name}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: "2px 8px", borderRadius: 8,
              background: isActive ? "#e8f5e922" : "#fff3e0",
              color: isActive ? "#2cb562" : "#e8a020",
              border: `1px solid ${isActive ? "#2cb56233" : "#e8a02033"}`,
              whiteSpace: "nowrap",
            }}>
              {isActive ? "オープン中" : "もうすぐオープン！"}
            </span>
          </div>
          <div style={{
            fontSize: 12, color: "#718096", marginTop: 4, lineHeight: 1.4,
          }}>
            {course.description}
          </div>

          {/* Like button */}
          <button
            onClick={() => onLike(course.id)}
            disabled={liking}
            style={{
              marginTop: 8,
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "5px 12px", borderRadius: 20,
              fontSize: 12, fontWeight: 700,
              border: course.liked ? "1px solid #0090d9" : "1px solid #e8ecf2",
              background: course.liked ? "#0090d910" : "#fff",
              color: course.liked ? "#0090d9" : "#718096",
              cursor: "pointer",
              transition: "all 0.2s",
              opacity: liking ? 0.6 : 1,
              minHeight: 32,
            }}
          >
            <span>{course.liked ? "👍" : "👍"}</span>
            <span>{course.liked ? "希望済み" : "オープン希望！"}</span>
            {course.likeCount > 0 && (
              <span style={{
                background: course.liked ? "#0090d920" : "#f0f2f5",
                padding: "1px 6px", borderRadius: 8,
                fontSize: 11, fontWeight: 800,
                color: course.liked ? "#0090d9" : "#a0aec0",
              }}>
                {course.likeCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
