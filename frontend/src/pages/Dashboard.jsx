import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import {
  BookOpen, CheckCircle, Clock, Timer, Star, Zap,
  TrendingUp, Award, Target, Brain, ChevronRight,
  BarChart2, Activity, Sparkles, AlertCircle
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTime = (minutes) => {
  if (!minutes) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const getPerformanceBadge = (score) => {
  if (score >= 75) return { label: 'High Performer', color: 'from-emerald-500 to-teal-400', icon: '🏆' };
  if (score >= 50) return { label: 'Medium Performer', color: 'from-amber-500 to-yellow-400', icon: '⚡' };
  return { label: 'Growing Learner', color: 'from-violet-500 to-purple-400', icon: '🌱' };
};

const buildMonthlyData = (stats) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  return months.slice(0, now.getMonth() + 1).map((month, i) => ({
    month,
    courses: Math.max(1, Math.round(((stats?.total_enrolled || 6) / (now.getMonth() + 1)) * (i + 1) * (0.7 + Math.random() * 0.6))),
    score: Math.min(100, Math.round(40 + (i * 4.5) + Math.random() * 10)),
    timeSpent: Math.round(((stats?.total_time_spent || 480) / (now.getMonth() + 1)) * (i + 1) * (0.8 + Math.random() * 0.4)),
  }));
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const StatCardSkeleton = () => (
  <div className="glass-card p-5 animate-pulse">
    <div className="flex items-center justify-between mb-3">
      <div className="w-10 h-10 rounded-xl bg-white/5" />
      <div className="w-16 h-5 rounded-full bg-white/5" />
    </div>
    <div className="w-20 h-8 rounded-lg bg-white/5 mb-1" />
    <div className="w-28 h-4 rounded bg-white/5" />
  </div>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, gradient, badge }) => (
  <div className="glass-card p-5 hover:scale-[1.02] transition-transform duration-200 group">
    <div className="flex items-center justify-between mb-3">
      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} bg-opacity-20`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      {badge && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-gradient-to-r ${gradient} text-white`}>
          {badge}
        </span>
      )}
    </div>
    <p className="text-2xl font-bold text-white mb-0.5">{value}</p>
    <p className="text-sm font-medium text-white/70">{label}</p>
    {sub && <p className="text-xs text-white/40 mt-0.5">{sub}</p>}
  </div>
);

// ─── Activity Item ────────────────────────────────────────────────────────────
const ActivityItem = ({ activity, idx }) => {
  const icons = { quiz: '📝', course: '📚', challenge: '💻', assessment: '🎯', chat: '🤖' };
  const colors = ['border-violet-500', 'border-cyan-500', 'border-emerald-500', 'border-amber-500', 'border-pink-500'];
  return (
    <div className={`flex gap-3 py-3 border-l-2 pl-4 ${colors[idx % colors.length]}`}>
      <span className="text-lg mt-0.5">{icons[activity.type] || '📌'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90 truncate">{activity.title || activity.description}</p>
        <p className="text-xs text-white/40 mt-0.5">{activity.timestamp ? new Date(activity.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recently'}</p>
      </div>
      {activity.score != null && (
        <span className="text-xs font-bold text-emerald-400 self-start mt-0.5">{activity.score}%</span>
      )}
    </div>
  );
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs">
      <p className="font-bold text-white/80 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-semibold">{p.value}</span></p>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const res = await dashboardAPI.get();
        setData(res.data);
      } catch (err) {
        const msg = err.response?.data?.detail || 'Failed to load dashboard';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const stats = data || {};
  const assessment = data?.assessment || null;
  const recentActivity = data?.recent_activity || [];
  const careerGoal = assessment?.career_goal || user?.career_goal || stats.career_goal || 'Data Scientist';

  const overallScore = assessment?.overall_score ?? stats?.quiz_avg_score ?? 0;
  const badge = getPerformanceBadge(overallScore);
  const monthlyData = buildMonthlyData({
    total_enrolled: stats.total_courses_enrolled,
    total_time_spent: stats.total_time_spent_hours
  });

  const skillScores = assessment
    ? [
        { skill: 'Programming', score: assessment.programming_score ?? 0 },
        { skill: 'ML', score: assessment.ml_score ?? 0 },
        { skill: 'Statistics', score: assessment.statistics_score ?? 0 },
        { skill: 'Data Eng.', score: assessment.data_engineering_score ?? 0 },
        { skill: 'Cloud', score: assessment.cloud_score ?? 0 },
        { skill: 'Visualization', score: assessment.visualization_score ?? 0 },
        { skill: 'Soft Skills', score: assessment.soft_skills_score ?? 0 },
      ]
    : [
        { skill: 'Programming', score: 60 },
        { skill: 'ML', score: 45 },
        { skill: 'Statistics', score: 55 },
        { skill: 'Data Eng.', score: 40 },
        { skill: 'Cloud', score: 35 },
        { skill: 'Visualization', score: 50 },
        { skill: 'Soft Skills', score: 65 },
      ];

  const statCards = [
    {
      icon: BookOpen, label: 'Courses Enrolled', value: stats.total_courses_enrolled ?? '--',
      gradient: 'from-violet-600 to-purple-500', badge: 'Total',
    },
    {
      icon: CheckCircle, label: 'Courses Completed', value: stats.completed_courses ?? '--',
      sub: stats.total_courses_enrolled ? `${Math.round(((stats.completed_courses || 0) / stats.total_courses_enrolled) * 100)}% completion` : null,
      gradient: 'from-emerald-600 to-teal-500',
    },
    {
      icon: Activity, label: 'In Progress', value: stats.in_progress_courses ?? '--',
      gradient: 'from-cyan-600 to-blue-500',
    },
    {
      icon: Star, label: 'Quiz Avg Score', value: stats.quiz_avg_score != null ? `${stats.quiz_avg_score}%` : '--',
      sub: stats.highest_quiz_score ? `High: ${stats.highest_quiz_score}%` : null,
      gradient: 'from-pink-600 to-rose-500',
    },
    {
      icon: Zap, label: 'Coding Avg Score', value: stats.average_coding_score != null ? `${stats.average_coding_score}%` : '--',
      sub: stats.coding_success_rate ? `Success Rate: ${stats.coding_success_rate}%` : null,
      gradient: 'from-indigo-600 to-violet-500',
    },
    {
      icon: Timer, label: 'Learning Time', value: formatTime((stats.total_time_spent_hours || 0) * 60),
      gradient: 'from-amber-600 to-orange-500',
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-900 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text">
              {greeting}, {user?.full_name?.split(' ')[0] || 'Learner'} 👋
            </h1>
            <p className="text-white/50 mt-1 text-sm">
              Goal: <span className="text-violet-400 font-medium">{careerGoal}</span>
              {assessment && (
                <span className="ml-2 text-white/30">· Last assessed {new Date(assessment.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              )}
            </p>
          </div>

          {/* Performance Badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r ${badge.color} bg-opacity-10 border border-white/10`}>
            <span className="text-xl">{badge.icon}</span>
            <div>
              <p className="text-xs text-white/60 font-medium">Performance</p>
              <p className="text-sm font-bold text-white">{badge.label}</p>
            </div>
            {overallScore > 0 && (
              <span className={`ml-2 text-lg font-black bg-gradient-to-r ${badge.color} bg-clip-text text-transparent`}>
                {Math.round(overallScore)}%
              </span>
            )}
          </div>
        </div>

        {/* ── Stat Cards ── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="glass-card p-6 flex items-center gap-3 border-red-500/30">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
            <button className="ml-auto btn-primary text-xs py-1.5 px-3" onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {statCards.map((card) => <StatCard key={card.label} {...card} />)}
          </div>
        )}

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Radar Chart – Skill Scores */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-violet-400" />
              <h2 className="text-base font-semibold text-white">Skill Radar</h2>
              {!assessment && (
                <span className="ml-auto text-xs text-white/40 italic">Take assessment for real data</span>
              )}
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={skillScores}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="skill" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Area Chart – Progress Over Time */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h2 className="text-base font-semibold text-white">Progress Over Time</h2>
            </div>
            {loading ? (
              <div className="h-64 animate-pulse bg-white/5 rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCourses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
                  <Area type="monotone" dataKey="courses" name="Courses" stroke="#8b5cf6" fill="url(#gradCourses)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="score" name="Avg Score" stroke="#06b6d4" fill="url(#gradScore)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Bottom Row: Activity Feed + Quick Actions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent Activity Feed */}
          <div className="lg:col-span-2 glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h2 className="text-base font-semibold text-white">Recent Activity</h2>
              </div>
              <button
                className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                onClick={() => navigate('/progress')}
              >
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-4xl mb-3">🚀</span>
                <p className="text-white/50 text-sm">No activity yet — start learning!</p>
                <button className="btn-primary mt-4 text-sm py-2 px-4" onClick={() => navigate('/courses')}>
                  Browse Courses
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {recentActivity.slice(0, 6).map((activity, idx) => (
                  <ActivityItem key={idx} activity={activity} idx={idx} />
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="glass-card p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <h2 className="text-base font-semibold text-white">Quick Actions</h2>
            </div>

            <button
              onClick={() => navigate('/assessment')}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-violet-600/20 to-purple-600/10 border border-violet-500/30 hover:border-violet-400/60 hover:from-violet-600/30 transition-all duration-200 group"
            >
              <div className="p-2 rounded-lg bg-violet-500/20 group-hover:bg-violet-500/30 transition-colors">
                <Target className="w-5 h-5 text-violet-300" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Take Assessment</p>
                <p className="text-xs text-white/40">Evaluate your skills</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 ml-auto group-hover:text-violet-400 transition-colors" />
            </button>

            <button
              onClick={() => navigate('/chat')}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/10 border border-cyan-500/30 hover:border-cyan-400/60 hover:from-cyan-600/30 transition-all duration-200 group"
            >
              <div className="p-2 rounded-lg bg-cyan-500/20 group-hover:bg-cyan-500/30 transition-colors">
                <Brain className="w-5 h-5 text-cyan-300" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">AI Tutor</p>
                <p className="text-xs text-white/40">Get personalized help</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 ml-auto group-hover:text-cyan-400 transition-colors" />
            </button>

            <button
              onClick={() => navigate('/quiz')}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-600/20 to-teal-600/10 border border-emerald-500/30 hover:border-emerald-400/60 hover:from-emerald-600/30 transition-all duration-200 group"
            >
              <div className="p-2 rounded-lg bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors">
                <Award className="w-5 h-5 text-emerald-300" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Quiz Generator</p>
                <p className="text-xs text-white/40">Test your knowledge</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 ml-auto group-hover:text-emerald-400 transition-colors" />
            </button>

            {/* Skill Summary mini-bars */}
            {!loading && (
              <div className="mt-2 pt-4 border-t border-white/8">
                <p className="text-xs font-semibold text-white/50 mb-3 uppercase tracking-wider">Top Skills</p>
                <div className="space-y-2">
                  {skillScores
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3)
                    .map(({ skill, score }) => (
                      <div key={skill}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-white/60">{skill}</span>
                          <span className="text-white/80 font-medium">{score}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-700"
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
