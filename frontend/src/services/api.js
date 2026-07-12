import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
};

// ─── Assessment ───────────────────────────────────────────────────────────────
export const assessmentAPI = {
  submit: (data) => api.post('/assessment', data),
  getResults: () => api.get('/assessment/results'),
  getSkillGap: (careerGoal) => api.get(`/assessment/skill-gap?career_goal=${encodeURIComponent(careerGoal)}`),
};

// ─── Courses ──────────────────────────────────────────────────────────────────
export const coursesAPI = {
  list: (params) => api.get('/courses', { params }),
  getAll: async (params) => (await api.get('/courses', { params })).data,
  get: (courseId) => api.get(`/courses/${courseId}`),
  categories: () => api.get('/courses/categories'),
  providers: () => api.get('/courses/providers'),
};

// ─── Recommendations ──────────────────────────────────────────────────────────
export const recommendationsAPI = {
  get: () => api.get('/recommendations'),
  getAll: async () => (await api.get('/recommendations')).data,
  generate: (data) => api.post('/recommendations/generate', data),
  dismiss: (id) => api.post(`/recommendations/${id}/dismiss`),
  // ML-powered endpoint
  getMLPowered: async () => (await api.get('/recommendations/ml-powered')).data,
  enrollFromRecommendation: (courseId) => api.post(`/recommendations/enroll/${courseId}`),
};

// ─── Progress ─────────────────────────────────────────────────────────────────
export const progressAPI = {
  list: (params) => api.get('/progress', { params }),
  getAll: async (params) => (await api.get('/progress', { params })).data,
  enroll: (data) => api.post('/progress', data),
  update: (id, data) => api.put(`/progress/${id}`, data),
  markComplete: (id) => api.put(`/progress/${id}`, { completion_status: 'Completed', progress_percent: 100 }),
  uploadCertificate: (id, formData) => api.post(`/progress/${id}/certificate`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  stats: () => api.get('/progress/stats'),
  // Additional methods
  getEnrolledCourses: async () => (await api.get('/me/enrolled-courses')).data,
  getCompletedCourses: async () => (await api.get('/me/completed-courses')).data,
  getCertificates: async () => (await api.get('/me/certificates')).data,
  updateCourseProgress: (courseId, progressPercent) => api.patch(`/courses/${courseId}/progress?progress_percent=${progressPercent}`),
  postStudyTime: (courseId, seconds) => api.post(`/courses/${courseId}/time?seconds=${seconds}`),
  enrollByCourseId: (courseId) => api.post(`/courses/${courseId}/enroll`),
  uploadCertificateStandalone: (courseId, formData) => api.post(`/certificates/upload?course_id=${encodeURIComponent(courseId)}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// ─── Learning Path ────────────────────────────────────────────────────────────
export const learningPathAPI = {
  list: () => api.get('/learning-path'),
  create: (careerGoal) => api.post(`/learning-path?career_goal=${encodeURIComponent(careerGoal)}`),
};

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const chatAPI = {
  send: (data) => api.post('/chat', data),
  history: (sessionId) => api.get('/chat/history', { params: { session_id: sessionId, limit: 50 } }),
  sessions: () => api.get('/chat/sessions'),
  deleteSession: (sessionId) => api.delete(`/chat/sessions/${sessionId}`),
};

// ─── Quiz ─────────────────────────────────────────────────────────────────────
export const quizAPI = {
  generate: (data) => api.post('/quiz/generate', data),
  submit: (data) => api.post('/quiz/submit', data),
  history: () => api.get('/quiz/history'),
  get: (id) => api.get(`/quiz/${id}`),
};

// ─── Coding Challenges ────────────────────────────────────────────────────────
export const codingAPI = {
  generate: (data) => api.post('/coding-challenge/generate', data),
  submit: (id, data) => api.post(`/coding-challenge/${id}/submit`, data),
  list: () => api.get('/coding-challenge'),
  stats: () => api.get('/coding-challenge/stats'),
  get: (id) => api.get(`/coding-challenge/${id}`),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  get: () => api.get('/dashboard'),
  careers: () => api.get('/career-recommendation'),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsAPI = {
  list: async () => (await api.get('/notifications')).data,
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
};

export default api;
