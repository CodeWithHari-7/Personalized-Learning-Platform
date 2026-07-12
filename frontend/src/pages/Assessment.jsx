import { useState, useEffect } from 'react';
import { assessmentAPI } from '../services/api';
import {
  ChevronRight, ChevronLeft, CheckCircle, Loader2,
  GraduationCap, Target, BarChart2, TrendingUp,
  AlertCircle, Award, BookOpen, Lightbulb, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// ─── Constants ────────────────────────────────────────────────────────────────
const CAREER_GOALS = [
  'Data Scientist',
  'ML Engineer',
  'Data Engineer',
  'AI Engineer',
  'Data Analyst',
  'Business Analyst',
  'Research Scientist',
  'MLOps Engineer',
];

const SKILLS = [
  { key: 'programming_score',       label: 'Programming',       color: 'from-violet-500 to-purple-400',  desc: 'Python, R, Java, etc.' },
  { key: 'ml_score',                label: 'Machine Learning',  color: 'from-cyan-500 to-blue-400',      desc: 'Algorithms, model building' },
  { key: 'statistics_score',        label: 'Statistics',        color: 'from-emerald-500 to-teal-400',   desc: 'Probability, inference' },
  { key: 'data_engineering_score',  label: 'Data Engineering',  color: 'from-amber-500 to-orange-400',   desc: 'Pipelines, ETL, SQL' },
  { key: 'cloud_score',             label: 'Cloud',             color: 'from-pink-500 to-rose-400',      desc: 'AWS, GCP, Azure' },
  { key: 'visualization_score',     label: 'Visualization',     color: 'from-indigo-500 to-violet-400',  desc: 'Dashboards, storytelling' },
  { key: 'soft_skills_score',       label: 'Soft Skills',       color: 'from-teal-500 to-cyan-400',      desc: 'Communication, teamwork' },
];

const STEPS = ['Basic Info', 'Skill Scores', 'Results'];

// ─── Step Progress Indicator ──────────────────────────────────────────────────
const StepIndicator = ({ current }) => (
  <div className="flex items-center justify-center gap-0 mb-8">
    {STEPS.map((label, i) => (
      <div key={label} className="flex items-center">
        <div className="flex flex-col items-center">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300
            ${i < current ? 'bg-violet-600 border-violet-500 text-white' :
              i === current ? 'border-violet-400 text-violet-300 bg-violet-500/20' :
              'border-white/15 text-white/30 bg-transparent'}`}>
            {i < current ? <CheckCircle className="w-4 h-4" /> : i + 1}
          </div>
          <span className={`text-xs mt-1.5 font-medium transition-colors ${i === current ? 'text-violet-300' : i < current ? 'text-white/60' : 'text-white/25'}`}>
            {label}
          </span>
        </div>
        {i < STEPS.length - 1 && (
          <div className={`w-16 md:w-24 h-0.5 mx-1 mb-5 rounded-full transition-all duration-500 ${i < current ? 'bg-violet-500' : 'bg-white/10'}`} />
        )}
      </div>
    ))}
  </div>
);

// ─── Skill Slider ─────────────────────────────────────────────────────────────
const SkillSlider = ({ skill, value, onChange }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-white/90">{skill.label}</p>
        <p className="text-xs text-white/40">{skill.desc}</p>
      </div>
      <div className={`min-w-[48px] text-center py-1 px-2 rounded-lg bg-gradient-to-r ${skill.color} bg-opacity-20`}>
        <span className="text-sm font-bold text-white">{value}</span>
      </div>
    </div>
    <div className="relative h-2 bg-white/8 rounded-full">
      <div
        className={`absolute top-0 left-0 h-full rounded-full bg-gradient-to-r ${skill.color} transition-all duration-150`}
        style={{ width: `${value}%` }}
      />
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(skill.key, Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
    <div className="flex justify-between text-xs text-white/20 select-none">
      <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
    </div>
  </div>
);

// ─── Result Skill Bar ─────────────────────────────────────────────────────────
const ResultSkillBar = ({ label, score, target, color, delay = 0 }) => {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const gap = target ? Math.max(0, target - score) : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-white/80">{label}</span>
        <div className="flex items-center gap-2">
          {gap !== null && gap > 0 && (
            <span className="text-xs text-amber-400">+{gap} needed</span>
          )}
          <span className="font-bold text-white">{score}<span className="text-white/40 font-normal">/100</span></span>
        </div>
      </div>
      <div className="relative h-2.5 bg-white/8 rounded-full overflow-hidden">
        {target && (
          <div
            className="absolute top-0 h-full bg-amber-400/20 rounded-full transition-all duration-700"
            style={{ width: `${target}%`, transitionDelay: `${delay + 200}ms` }}
          />
        )}
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: animated ? `${score}%` : '0%', transitionDelay: `${delay}ms` }}
        />
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Assessment() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [existingResults, setExistingResults] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(true);

  const [formData, setFormData] = useState({
    cgpa: '',
    semester: '',
    experience_years: '',
    career_goal: '',
    programming_score: 50,
    ml_score: 50,
    statistics_score: 50,
    data_engineering_score: 50,
    cloud_score: 50,
    visualization_score: 50,
    soft_skills_score: 50,
  });

  const [errors, setErrors] = useState({});

  // Check for existing results on mount
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res = await assessmentAPI.getResults();
        if (res.data) {
          setExistingResults(res.data);
          // Pre-fill form with existing data
          setFormData(prev => ({
            ...prev,
            career_goal: res.data.career_goal || '',
            cgpa: res.data.cgpa?.toString() || '',
            semester: res.data.semester?.toString() || '',
            experience_years: res.data.experience_years?.toString() || '',
            programming_score: res.data.programming_score ?? 50,
            ml_score: res.data.ml_score ?? 50,
            statistics_score: res.data.statistics_score ?? 50,
            data_engineering_score: res.data.data_engineering_score ?? 50,
            cloud_score: res.data.cloud_score ?? 50,
            visualization_score: res.data.visualization_score ?? 50,
            soft_skills_score: res.data.soft_skills_score ?? 50,
          }));
        }
      } catch {
        // No existing results, fresh assessment
      } finally {
        setLoadingExisting(false);
      }
    };
    checkExisting();
  }, []);

  const setField = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateStep0 = () => {
    const errs = {};
    const cgpa = parseFloat(formData.cgpa);
    if (!formData.cgpa || isNaN(cgpa) || cgpa < 0 || cgpa > 10) errs.cgpa = 'Enter CGPA between 0 and 10';
    const sem = parseInt(formData.semester);
    if (!formData.semester || isNaN(sem) || sem < 1 || sem > 12) errs.semester = 'Enter semester between 1 and 12';
    const exp = parseFloat(formData.experience_years);
    if (formData.experience_years === '' || isNaN(exp) || exp < 0) errs.experience_years = 'Enter valid experience (≥ 0)';
    if (!formData.career_goal) errs.career_goal = 'Please select a career goal';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    setStep(s => s + 1);
  };

  const handleBack = () => setStep(s => s - 1);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    const payload = {
      cgpa: parseFloat(formData.cgpa),
      semester: parseInt(formData.semester),
      experience_years: parseFloat(formData.experience_years),
      career_goal: formData.career_goal,
      programming_score: formData.programming_score,
      ml_score: formData.ml_score,
      statistics_score: formData.statistics_score,
      data_engineering_score: formData.data_engineering_score,
      cloud_score: formData.cloud_score,
      visualization_score: formData.visualization_score,
      soft_skills_score: formData.soft_skills_score,
    };
    try {
      const res = await assessmentAPI.submit(payload);
      setResults(res.data);
      setStep(2);
      toast.success('Assessment submitted! Here are your results 🎯');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Submission failed. Please try again.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived results data ───────────────────────────────────────────────────
  const displayResults = results || existingResults;
  const overallScore = displayResults?.overall_score ?? 0;
  const skillGaps = displayResults?.skill_gaps || [];
  const recommendedPath = displayResults?.recommended_path || displayResults?.learning_path || [];
  const performancePrediction = displayResults?.performance_prediction || displayResults?.predicted_performance || 'N/A';

  const getScoreColor = (score) => {
    if (score >= 75) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-rose-400';
  };
  const getScoreLabel = (score) => {
    if (score >= 75) return { label: 'Excellent', gradient: 'from-emerald-500 to-teal-400' };
    if (score >= 50) return { label: 'Good', gradient: 'from-amber-500 to-yellow-400' };
    return { label: 'Developing', gradient: 'from-rose-500 to-pink-400' };
  };

  if (loadingExisting) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
          <p className="text-white/50 text-sm">Loading assessment data…</p>
        </div>
      </div>
    );
  }

  // ── STEP 0: Basic Info ─────────────────────────────────────────────────────
  const renderStep0 = () => (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex p-3 rounded-2xl bg-violet-500/15 mb-3">
          <GraduationCap className="w-8 h-8 text-violet-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Basic Information</h2>
        <p className="text-sm text-white/50 mt-1">Tell us about your academic background</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* CGPA */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            CGPA <span className="text-violet-400">*</span>
          </label>
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            placeholder="e.g. 8.5"
            value={formData.cgpa}
            onChange={(e) => setField('cgpa', e.target.value)}
            className={`input-field w-full ${errors.cgpa ? 'border-rose-500/60 focus:border-rose-400' : ''}`}
          />
          {errors.cgpa && <p className="text-xs text-rose-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.cgpa}</p>}
        </div>

        {/* Semester */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            Current Semester <span className="text-violet-400">*</span>
          </label>
          <input
            type="number"
            min={1}
            max={12}
            step={1}
            placeholder="e.g. 6"
            value={formData.semester}
            onChange={(e) => setField('semester', e.target.value)}
            className={`input-field w-full ${errors.semester ? 'border-rose-500/60 focus:border-rose-400' : ''}`}
          />
          {errors.semester && <p className="text-xs text-rose-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.semester}</p>}
        </div>

        {/* Experience */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            Experience (Years) <span className="text-violet-400">*</span>
          </label>
          <input
            type="number"
            min={0}
            step={0.5}
            placeholder="e.g. 1.5"
            value={formData.experience_years}
            onChange={(e) => setField('experience_years', e.target.value)}
            className={`input-field w-full ${errors.experience_years ? 'border-rose-500/60 focus:border-rose-400' : ''}`}
          />
          {errors.experience_years && <p className="text-xs text-rose-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.experience_years}</p>}
        </div>

        {/* Career Goal */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            Career Goal <span className="text-violet-400">*</span>
          </label>
          <select
            value={formData.career_goal}
            onChange={(e) => setField('career_goal', e.target.value)}
            className={`input-field w-full ${errors.career_goal ? 'border-rose-500/60 focus:border-rose-400' : ''}`}
          >
            <option value="">Select your goal…</option>
            {CAREER_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          {errors.career_goal && <p className="text-xs text-rose-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.career_goal}</p>}
        </div>
      </div>

      {/* Career Goal Cards */}
      <div className="mt-2">
        <p className="text-xs text-white/40 mb-3 uppercase tracking-wider font-medium">Or pick a path</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CAREER_GOALS.map(goal => (
            <button
              key={goal}
              type="button"
              onClick={() => setField('career_goal', goal)}
              className={`text-xs py-2 px-3 rounded-lg border text-left transition-all duration-200 ${
                formData.career_goal === goal
                  ? 'border-violet-400 bg-violet-500/20 text-violet-200 font-semibold'
                  : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white/70'
              }`}
            >
              {goal}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── STEP 1: Skill Scores ───────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex p-3 rounded-2xl bg-cyan-500/15 mb-3">
          <BarChart2 className="w-8 h-8 text-cyan-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Rate Your Skills</h2>
        <p className="text-sm text-white/50 mt-1">Move the sliders to reflect your current proficiency level</p>
      </div>

      <div className="space-y-6">
        {SKILLS.map(skill => (
          <SkillSlider
            key={skill.key}
            skill={skill}
            value={formData[skill.key]}
            onChange={setField}
          />
        ))}
      </div>

      {/* Overall average preview */}
      <div className="glass-card p-4 mt-4 border-violet-500/20">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/60">Estimated Overall Score</p>
          <p className="text-lg font-bold text-violet-300">
            {Math.round(SKILLS.reduce((sum, s) => sum + formData[s.key], 0) / SKILLS.length)}
            <span className="text-white/40 text-sm font-normal">/100</span>
          </p>
        </div>
        <div className="h-1.5 bg-white/8 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${Math.round(SKILLS.reduce((sum, s) => sum + formData[s.key], 0) / SKILLS.length)}%` }}
          />
        </div>
      </div>
    </div>
  );

  // ── STEP 2: Results ────────────────────────────────────────────────────────
  const renderStep2 = () => {
    const score = displayResults || results;
    if (!score) {
      return (
        <div className="text-center py-12">
          <Loader2 className="w-10 h-10 text-violet-400 animate-spin mx-auto mb-4" />
          <p className="text-white/50">Loading results…</p>
        </div>
      );
    }

    const { label: perfLabel, gradient: perfGrad } = getScoreLabel(overallScore);

    return (
      <div className="space-y-6">
        {/* Overall Score Hero */}
        <div className="text-center">
          <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${perfGrad} bg-opacity-15 mb-3`}>
            <Award className="w-10 h-10 text-white" />
          </div>
          <div className={`text-5xl font-black mb-1 ${getScoreColor(overallScore)}`}>
            {Math.round(overallScore)}
            <span className="text-2xl text-white/40 font-light">/100</span>
          </div>
          <p className="text-white/60 text-sm">Overall Skill Score</p>
          <div className={`inline-block mt-2 px-4 py-1.5 rounded-full bg-gradient-to-r ${perfGrad} text-white text-sm font-semibold`}>
            {perfLabel} · {formData.career_goal || displayResults?.career_goal}
          </div>
        </div>

        {/* Performance Prediction */}
        {performancePrediction !== 'N/A' && (
          <div className="glass-card p-4 border-cyan-500/20">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/15 shrink-0">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1">Performance Prediction</p>
                <p className="text-sm text-white/80">{performancePrediction}</p>
              </div>
            </div>
          </div>
        )}

        {/* Skill Breakdown */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-violet-400" /> Skill Breakdown
          </h3>
          <div className="space-y-4">
            {SKILLS.map(({ key, label, color }, i) => (
              <ResultSkillBar
                key={key}
                label={label}
                score={displayResults?.[key] ?? formData[key] ?? 0}
                color={color}
                delay={i * 80}
              />
            ))}
          </div>
        </div>

        {/* Skill Gaps */}
        {skillGaps.length > 0 && (
          <div className="glass-card p-5 border-amber-500/20">
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" /> Skill Gaps to Address
            </h3>
            <div className="flex flex-wrap gap-2">
              {skillGaps.map((gap) => (
                <span key={gap} className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25">
                  {gap}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Learning Path */}
        {recommendedPath.length > 0 && (
          <div className="glass-card p-5 border-violet-500/20">
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-violet-400" /> Recommended Learning Path
            </h3>
            <div className="space-y-2">
              {(Array.isArray(recommendedPath) ? recommendedPath : Object.values(recommendedPath)).slice(0, 6).map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/4 hover:bg-white/8 transition-colors">
                  <div className="w-6 h-6 rounded-full bg-violet-500/25 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-violet-300">{i + 1}</span>
                  </div>
                  <p className="text-sm text-white/80 flex-1">{typeof item === 'object' ? (item.title || item.name || JSON.stringify(item)) : item}</p>
                  <BookOpen className="w-3.5 h-3.5 text-white/25 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Target className="w-4 h-4" /> Go to Dashboard
          </button>
          <button
            onClick={() => navigate('/courses')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-white/15 text-white/70 hover:border-white/30 hover:text-white hover:bg-white/5 transition-all duration-200 text-sm font-medium"
          >
            <BookOpen className="w-4 h-4" /> Browse Courses <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // ─── Layout ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-900 flex items-start justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">

        {/* Page header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold gradient-text">Skill Assessment</h1>
          <p className="text-white/40 text-sm mt-1">
            {existingResults && step < 2 ? 'Retake to update your profile' : 'Discover your strengths and gaps'}
          </p>
        </div>

        {/* Existing results banner */}
        {existingResults && step === 0 && (
          <div
            className="glass-card p-4 border-violet-500/30 mb-6 flex items-center justify-between cursor-pointer hover:border-violet-400/50 transition-colors"
            onClick={() => setStep(2)}
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">Previous assessment found</p>
                <p className="text-xs text-white/40">Score: {Math.round(existingResults.overall_score ?? 0)}/100 · {existingResults.career_goal}</p>
              </div>
            </div>
            <button className="text-xs text-violet-400 flex items-center gap-1 hover:text-violet-300 font-medium">
              View results <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Step Indicator */}
        <StepIndicator current={step} />

        {/* Card */}
        <div className="glass-card p-6 md:p-8">
          <div className="transition-all duration-300">
            {step === 0 && renderStep0()}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
          </div>

          {/* Navigation Buttons */}
          {step < 2 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/8">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors py-2 px-3 rounded-lg hover:bg-white/5"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              ) : (
                <div />
              )}

              {step === 0 && (
                <button type="button" onClick={handleNext} className="btn-primary flex items-center gap-2">
                  Next: Rate Skills <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {step === 1 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Submit Assessment</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
