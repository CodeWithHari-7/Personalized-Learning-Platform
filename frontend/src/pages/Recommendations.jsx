import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, Sparkles, Target, TrendingUp, TrendingDown,
  CheckCircle, AlertCircle, BookOpen, ExternalLink,
  RefreshCw, Loader2, ChevronRight, Award, Zap,
  BarChart2, Star, Clock, Shield, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { recommendationsAPI, progressAPI } from '../services/api';
import { Link } from 'react-router-dom';

// ─── Helpers ────────────────────────────────────────────────────────────────

const MATCH_COLOR = (pct) => {
  if (pct >= 85) return { bar: '#22d3ee', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
  if (pct >= 70) return { bar: '#a855f7', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
  return { bar: '#f59e0b', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
};

const LEVEL_COLOR = {
  Strong:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Developing: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  Gap:        'text-red-400 bg-red-500/10 border-red-500/20',
};

const READINESS_COLOR = (pct) => {
  if (pct >= 70) return 'text-emerald-400';
  if (pct >= 40) return 'text-yellow-400';
  return 'text-red-400';
};

// ─── Skill Bar ───────────────────────────────────────────────────────────────

const SkillBar = ({ skill }) => {
  const pct = skill.score;
  const { bar } = MATCH_COLOR(pct);
  const levelCls = LEVEL_COLOR[skill.level] || LEVEL_COLOR.Developing;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{skill.icon}</span>
          <span className="text-white/80 text-sm font-medium">{skill.label}</span>
          {skill.is_career_required && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Required
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${levelCls}`}>{skill.level}</span>
          <span className="text-white font-bold text-sm w-10 text-right">{pct}%</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: pct >= 70 ? '#22d3ee' : pct >= 40 ? '#a855f7' : '#ef4444' }}
        />
      </div>
      <div className="flex justify-between text-xs text-white/30">
        <span>0%</span>
        <span className="text-white/40">Target: 70%</span>
        <span>100%</span>
      </div>
    </div>
  );
};

// ─── Recommendation Card ─────────────────────────────────────────────────────

const RecommendationCard = ({ rec, onEnroll, enrollingId }) => {
  const isEnrolling = enrollingId === rec.course_id;
  const { bar, badge } = MATCH_COLOR(rec.match_score);

  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col gap-4 hover:border-white/25 transition-all duration-300 group relative overflow-hidden">
      {/* Rank badge */}
      <div className="absolute top-0 left-0 w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-br-2xl flex items-center justify-center">
        <span className="text-white font-bold text-sm">#{rec.rank}</span>
      </div>

      {/* Top row: match score */}
      <div className="flex items-start justify-between gap-2 pt-2">
        <div className="ml-10">
          {/* Category & level badges */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {rec.category}
            </span>
            {rec.level && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50 border border-white/10">
                {rec.level}
              </span>
            )}
            {rec.is_career_required && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Target size={10} /> Career Required
              </span>
            )}
          </div>
        </div>
        {/* Match score pill */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-bold shrink-0 ${badge}`}>
          <Sparkles size={13} />
          {rec.match_score}% Match
        </div>
      </div>

      {/* Course name */}
      <h3 className="text-white font-bold text-base leading-snug group-hover:text-purple-200 transition-colors line-clamp-2">
        {rec.course_name}
      </h3>

      {/* Provider & rating */}
      <div className="flex items-center gap-3 text-xs text-white/50">
        <span className="font-medium text-white/70">{rec.provider}</span>
        {rec.rating && (
          <span className="flex items-center gap-1">
            <Star size={11} className="text-yellow-400" fill="#facc15" />
            {rec.rating.toFixed(1)}
          </span>
        )}
        {rec.duration_hours && (
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {rec.duration_hours}h
          </span>
        )}
        {rec.certificate_available && (
          <span className="flex items-center gap-1 text-emerald-400">
            <Award size={11} />
            Certificate
          </span>
        )}
      </div>

      {/* Match score visual bar */}
      <div>
        <div className="flex justify-between text-xs text-white/40 mb-1">
          <span>Match Score</span>
          <span className="font-semibold" style={{ color: bar }}>{rec.match_score}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${rec.match_score}%`, background: bar }}
          />
        </div>
      </div>

      {/* Skill gap insight */}
      <div className="bg-white/5 rounded-xl px-4 py-3 border border-white/8">
        <div className="flex items-center gap-2 mb-1.5">
          <Brain size={13} className="text-purple-400" />
          <span className="text-purple-300 text-xs font-semibold">Why this course?</span>
          <span className="text-xs text-white/30 ml-auto">ML Confidence: {rec.ml_confidence}%</span>
        </div>
        <p className="text-white/60 text-xs leading-relaxed">{rec.reason}</p>
      </div>

      {/* Skill score mini-indicator */}
      <div className="flex items-center gap-2 text-xs text-white/40">
        <span>Your {rec.category} level:</span>
        <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${rec.user_skill_score}%`,
              background: rec.user_skill_score >= 70 ? '#22d3ee' : rec.user_skill_score >= 40 ? '#a855f7' : '#ef4444'
            }}
          />
        </div>
        <span className="font-semibold text-white/60">{rec.user_skill_score}%</span>
        {rec.skill_gap > 0 && (
          <span className="text-red-400 flex items-center gap-0.5">
            <TrendingDown size={11} />
            {rec.skill_gap}pt gap
          </span>
        )}
      </div>

      {/* Action row */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => onEnroll(rec)}
          disabled={isEnrolling}
          className="flex-1 btn-primary rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed font-semibold"
        >
          {isEnrolling ? (
            <><Loader2 size={14} className="animate-spin" /> Enrolling…</>
          ) : (
            <><BookOpen size={14} /> Start Course</>
          )}
        </button>
        {rec.url && (
          <a
            href={rec.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary rounded-xl px-3 py-2.5 text-sm flex items-center justify-center gap-1 border border-white/20 hover:bg-white/10 transition-colors"
            title="Open course page"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
};

// ─── Career Readiness Arc ─────────────────────────────────────────────────────

const ReadinessArc = ({ pct, career }) => {
  const radius = 56;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ * 0.75;
  const clr = pct >= 70 ? '#22d3ee' : pct >= 40 ? '#a855f7' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="90" viewBox="0 0 140 90">
        {/* Background arc */}
        <circle
          cx="70" cy="80" r={radius}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10"
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
          strokeLinecap="round"
          transform="rotate(135 70 80)"
        />
        {/* Filled arc */}
        <circle
          cx="70" cy="80" r={radius}
          fill="none" stroke={clr} strokeWidth="10"
          strokeDasharray={`${circ * 0.75 * pct / 100} ${circ}`}
          strokeLinecap="round"
          transform="rotate(135 70 80)"
          style={{ transition: 'stroke-dasharray 1.2s ease' }}
        />
        <text x="70" y="76" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">{pct}%</text>
        <text x="70" y="88" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="8">Ready</text>
      </svg>
      <p className="text-white/60 text-xs text-center">Career Readiness for<br /><span className="text-white font-semibold">{career}</span></p>
    </div>
  );
};

// ─── No Assessment Banner ────────────────────────────────────────────────────

const NoAssessmentBanner = () => (
  <div className="flex flex-col items-center justify-center py-20 gap-6">
    <div className="p-6 rounded-full bg-purple-500/10 border border-purple-500/20 animate-pulse">
      <Brain size={52} className="text-purple-400" />
    </div>
    <div className="text-center max-w-md">
      <h2 className="text-white text-xl font-bold mb-2">Assessment Required</h2>
      <p className="text-white/50 text-sm leading-relaxed">
        To power our Random Forest ML model, we need your skill scores. Complete the
        Skill Assessment first so we can generate truly personalized recommendations.
      </p>
    </div>
    <Link
      to="/assessment"
      className="btn-primary rounded-xl py-3 px-8 text-sm flex items-center gap-2 font-semibold"
    >
      <Target size={16} />
      Take Skill Assessment
      <ArrowRight size={14} />
    </Link>
  </div>
);

// ─── Skeleton ────────────────────────────────────────────────────────────────

const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-white/10 rounded-xl ${className}`} />
);

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Recommendations() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrollingId, setEnrollingId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await recommendationsAPI.getMLPowered();
      setData(result);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail ?? 'Failed to load recommendations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEnroll = async (rec) => {
    setEnrollingId(rec.course_id);
    try {
      const res = await recommendationsAPI.enrollFromRecommendation(rec.course_id);
      toast.success(`Enrolled in "${rec.course_name}"! 🎉`);
      if (res.data?.url) {
        setTimeout(() => window.open(res.data.url, '_blank', 'noopener,noreferrer'), 600);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail ?? 'Enrollment failed.';
      if (typeof msg === 'string' && msg.includes('Already enrolled')) {
        toast('You are already enrolled in this course!', { icon: 'ℹ️' });
        if (rec.url) window.open(rec.url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    } finally {
      setEnrollingId(null);
    }
  };

  // ─── Render: Loading ──
  if (loading) {
    return (
      <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12">
        <div className="flex items-center gap-3 mb-8">
          <Brain size={28} className="text-purple-400 animate-pulse" />
          <div>
            <Skeleton className="h-8 w-56 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-72" />)}
        </div>
      </div>
    );
  }

  // ─── Render: Error ──
  if (error) {
    return (
      <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12 flex items-center justify-center">
        <div className="glass-card rounded-2xl p-8 flex flex-col items-center gap-4 max-w-md">
          <AlertCircle size={40} className="text-red-400" />
          <p className="text-white/70 text-center">{error}</p>
          <button onClick={fetchData} className="btn-primary rounded-xl py-2 px-6 text-sm">Retry</button>
        </div>
      </div>
    );
  }

  // ─── Render: No Assessment ──
  if (!data || data.status === 'no_assessment') {
    return (
      <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12">
        <div className="flex items-center gap-3 mb-2">
          <Brain size={28} className="text-purple-400" />
          <h1 className="text-3xl font-bold text-white">Personalized Recommendations</h1>
        </div>
        <p className="text-white/50 text-sm mb-8 ml-10">Powered by Random Forest ML Model</p>
        <NoAssessmentBanner />
      </div>
    );
  }

  const {
    career_goal, career_readiness, performance_level, overall_score,
    strong_skills, gap_skills, skill_summary, recommendations, ml_model_info
  } = data;

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Brain size={28} className="text-purple-400" />
            <h1 className="text-3xl font-bold text-white">Personalized Recommendations</h1>
          </div>
          <p className="text-white/50 text-sm ml-10">
            Powered by <span className="text-purple-300 font-medium">Random Forest Classifier</span> — trained on your skill assessment
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="btn-secondary rounded-xl py-2 px-4 text-sm flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Career Overview ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

        {/* Career Readiness Arc */}
        <div className="glass-card rounded-2xl p-6 flex items-center justify-center">
          <ReadinessArc pct={career_readiness} career={career_goal} />
        </div>

        {/* Strong Skills */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <TrendingUp size={16} className="text-emerald-400" />
            </div>
            <h3 className="text-white font-semibold text-sm">Strong Skills</h3>
          </div>
          {strong_skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {strong_skills.map(s => (
                <span key={s} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  <CheckCircle size={11} /> {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-white/40 text-xs">Complete more courses to build strong skills.</p>
          )}
        </div>

        {/* Skill Gaps */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-red-500/20">
              <TrendingDown size={16} className="text-red-400" />
            </div>
            <h3 className="text-white font-semibold text-sm">Skill Gaps to Fill</h3>
          </div>
          {gap_skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {gap_skills.map(s => (
                <span key={s} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/25">
                  <AlertCircle size={11} /> {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-white/40 text-xs">No major skill gaps detected. 🎉</p>
          )}
        </div>
      </div>

      {/* ── Skill Summary ── */}
      <div className="glass-card rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 size={18} className="text-purple-400" />
          <h2 className="text-white font-semibold text-base">Your Skill Profile</h2>
          <span className="ml-auto text-xs text-white/40 flex items-center gap-1">
            <Shield size={11} />
            Based on your assessment
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {skill_summary.map(skill => (
            <SkillBar key={skill.field} skill={skill} />
          ))}
        </div>
      </div>

      {/* ── ML Model Info Banner ── */}
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20 mb-6">
        <Zap size={16} className="text-purple-400 shrink-0" />
        <p className="text-white/70 text-sm">
          <span className="text-purple-300 font-semibold">{ml_model_info?.model}</span>
          {' '}analysed your profile and career goal (<span className="text-white font-medium">{career_goal}</span>) to generate these{' '}
          <span className="text-white font-medium">{recommendations.length} ranked recommendations</span>.
          Your overall performance level: <span className="font-semibold text-yellow-300">{performance_level}</span>.
        </p>
      </div>

      {/* ── Recommendation Cards ── */}
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-white font-semibold text-lg">Recommended Courses</h2>
        <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
          <Brain size={11} /> ML Powered
        </span>
      </div>

      {recommendations.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
          <BookOpen size={40} className="text-white/30" />
          <p className="text-white/60">No recommendations found. Try refreshing or completing the assessment again.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recommendations.map(rec => (
            <RecommendationCard
              key={rec.course_id}
              rec={rec}
              onEnroll={handleEnroll}
              enrollingId={enrollingId}
            />
          ))}
        </div>
      )}

      {/* ── Footer tip ── */}
      <div className="mt-8 flex items-center gap-2 text-white/30 text-xs">
        <Brain size={12} />
        <span>
          Recommendations are re-generated each time based on your latest assessment scores and enrollment history.
          Click <strong className="text-white/50">"Start Course"</strong> to add a course to your learning path and track progress.
        </span>
      </div>
    </div>
  );
}
