const BASE_URL = import.meta.env.VITE_API_URL || '';
const TENANT_SLUG = 'trail';

let authToken = localStorage.getItem('trail_token') || null;
let currentStudentId = localStorage.getItem('trail_student_id') || null;
let cachedStudent = null;

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    ...options.headers,
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) {
      authToken = null;
      currentStudentId = null;
      localStorage.removeItem('trail_token');
      localStorage.removeItem('trail_student_id');
      localStorage.removeItem('trail_student_name');
      window.dispatchEvent(new CustomEvent('trail:auth-expired'));
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `API Error: ${res.status}`);
  }
  return res.json();
}

// ─── 認証 ─────────────────────────
export async function loginStudent(studentName, className) {
  const data = await apiFetch('/api/auth/student/login', {
    method: 'POST',
    body: JSON.stringify({
      tenantSlug: TENANT_SLUG,
      className: className,
      studentName: studentName,
    }),
  });
  authToken = data.token;
  currentStudentId = data.student?.id || data.studentId || data.id;
  cachedStudent = data.student || { id: currentStudentId, name: studentName };
  localStorage.setItem('trail_token', data.token);
  localStorage.setItem('trail_student_id', currentStudentId);
  localStorage.setItem('trail_student_name', studentName);
  return data;
}

export function logout() {
  authToken = null;
  currentStudentId = null;
  localStorage.removeItem('trail_token');
  localStorage.removeItem('trail_student_id');
}

export function isLoggedIn() {
  return !!(authToken && currentStudentId);
}

export function getStoredStudentId() {
  return currentStudentId ? Number(currentStudentId) : null;
}

export function getCachedStudent() {
  return cachedStudent;
}

// ─── テナント情報 ──────────────────
export async function getTenantInfo() {
  return apiFetch(`/api/t/${TENANT_SLUG}/info`);
}

// ─── 生徒 ─────────────────────────
export async function getStudents() {
  return apiFetch(`/api/t/${TENANT_SLUG}/students`);
}

// ─── ゲーム ────────────────────────
export async function getGames() {
  return apiFetch(`/api/t/${TENANT_SLUG}/games`);
}

// ─── ALT / コイン ──────────────────
export async function getCoins() {
  return apiFetch(`/api/t/${TENANT_SLUG}/coins`);
}

// ─── ランキング ────────────────────
export async function getRankings() {
  return apiFetch(`/api/t/${TENANT_SLUG}/rankings`);
}


// ─── ストリーク ────────────────────
export async function getStreak(studentId) {
  return apiFetch(`/api/streaks/${studentId}?tenant_id=${TENANT_SLUG}`);
}

// ─── プレイセッション ──────────────
export async function getPlaySessions() {
  return apiFetch('/api/play-sessions');
}

// ─── バッジ ────────────────────────
export async function getBadges() {
  return apiFetch(`/api/t/${TENANT_SLUG}/badges`);
}
