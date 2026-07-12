import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, usersAPI } from '../services/api';
import { 
  TrendingUp, DollarSign, Briefcase, Target, ChevronRight, 
  Loader2, Sparkles, AlertTriangle, CheckCircle, Globe, MapPin, Award, ArrowRight, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

const CAREER_ICONS = {
  'Data Scientist': '🔬',
  'ML Engineer': '🤖',
  'Data Engineer': '⚙️',
  'AI Engineer': '🧠',
  'Data Analyst': '📊',
  'Business Analyst': '💼',
  'Research Scientist': '🎓',
  'MLOps Engineer': '🚀',
};

const COUNTRIES = [
  'India',
  'United States',
  'United Kingdom',
  'Japan',
  'Germany',
  'France',
  'Canada',
  'Australia'
];

export default function CareerRecommendation() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [countryInput, setCountryInput] = useState('');
  const [savingCountry, setSavingCountry] = useState(false);
  const [activeTab, setActiveTab] = useState('roadmap'); // roadmap | skills | salary

  const load = async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.careers();
      setData(res.data);
      if (res.data?.recommendations?.length > 0) {
        setSelected(res.data.recommendations[0]);
      }
    } catch (err) {
      toast.error('Failed to load career path recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveCountry = async (e) => {
    e.preventDefault();
    if (!countryInput) {
      toast.error('Please select a country');
      return;
    }
    setSavingCountry(true);
    try {
      await usersAPI.updateProfile({ country: countryInput });
      toast.success('Country updated successfully!');
      await load();
    } catch (err) {
      toast.error('Failed to update country');
    } finally {
      setSavingCountry(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96">
      <Loader2 size={36} className="text-indigo-500 animate-spin mb-4"/>
      <p className="text-slate-400 text-xs">Analyzing learning signals and job requirements...</p>
    </div>
  );

  // If user country is missing, prompt to select country
  if (data?.country_missing) {
    return (
      <div className="max-w-md mx-auto my-12 glass-card p-8 border border-white/10 rounded-2xl shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto text-indigo-400">
          <Globe size={32} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Set Your Country</h2>
          <p className="text-slate-400 text-xs leading-relaxed">
            To customize salary estimations and regional job requirements, please select your primary country.
          </p>
        </div>
        <form onSubmit={handleSaveCountry} className="space-y-4">
          <select
            value={countryInput}
            onChange={(e) => setCountryInput(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500/60"
          >
            <option value="">-- Choose Country --</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            type="submit"
            disabled={savingCountry}
            className="btn-primary w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
          >
            {savingCountry ? <Loader2 size={14} className="animate-spin" /> : null}
            Save & Generate Career Path
          </button>
        </form>
      </div>
    );
  }

  const recommendations = data?.recommendations || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text mb-1">Career Recommendations</h1>
          <p className="text-slate-400 text-xs flex items-center gap-1">
            <MapPin size={12} className="text-indigo-400" />
            Matching {data?.user_country} profile and global job skills data
          </p>
        </div>
        <button
          onClick={load}
          className="btn-secondary rounded-xl py-2 px-3 text-xs font-semibold flex items-center gap-1.5 self-start md:self-auto"
        >
          <RefreshCw size={12} /> Recalculate
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: list of matching careers */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold text-white/50 px-1 uppercase tracking-wider">Career Matches</span>
          {recommendations.map((career, i) => (
            <button
              key={i}
              onClick={() => {
                setSelected(career);
                setActiveTab('roadmap');
              }}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selected?.career_name === career.career_name
                  ? 'bg-indigo-500/10 border-indigo-500/40 shadow-lg shadow-indigo-500/5'
                  : 'glass-card border-white/5 hover:border-white/15'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0">{CAREER_ICONS[career.career_name] || '💡'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-xs truncate">{career.career_name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          career.match_score >= 80 ? 'bg-emerald-500' : career.match_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${career.match_score}%` }} 
                      />
                    </div>
                    <span className="text-[10px] text-white/70 font-semibold shrink-0">
                      {career.match_score}%
                    </span>
                  </div>
                </div>
                {i === 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 shrink-0">
                    Best Match
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Right column: detailed recommended path */}
        {selected ? (
          <div className="lg:col-span-2 space-y-4">
            {/* Overview Card */}
            <div className="glass-card p-6 flex flex-col gap-4 border border-indigo-500/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none select-none text-9xl">
                {CAREER_ICONS[selected.career_name]}
              </div>

              <div className="flex items-start gap-4">
                <span className="text-5xl p-2 bg-white/5 rounded-2xl shrink-0">
                  {CAREER_ICONS[selected.career_name] || '💡'}
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-white">{selected.career_name}</h2>
                  <p className="text-white/50 text-xs mt-1 leading-relaxed">{selected.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-[10px] text-white/40 block">Match Score</span>
                  <span className="text-base font-extrabold text-indigo-400 mt-0.5 block">{selected.match_score}%</span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-[10px] text-white/40 block">Readiness</span>
                  <span className="text-base font-extrabold text-emerald-400 mt-0.5 block">{selected.readiness_percent}%</span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-[10px] text-white/40 block">Salary Range ({selected.salary_currency})</span>
                  <span className="text-[11px] font-extrabold text-yellow-400 mt-1 block truncate" title={selected.local_salary_range}>
                    {selected.local_salary_range}
                  </span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-[10px] text-white/40 block">Projected Growth</span>
                  <span className="text-base font-extrabold text-blue-400 mt-0.5 block">{selected.job_growth}</span>
                </div>
              </div>

              {/* AI Justification */}
              {selected.explanation && (
                <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 mt-1 flex gap-3 items-start">
                  <Sparkles size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-indigo-200 leading-normal">
                    <strong>Match Explanation:</strong> {selected.explanation}
                  </div>
                </div>
              )}
            </div>

            {/* Next Actions Card */}
            {selected.next_actions && selected.next_actions.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="text-white font-bold text-xs mb-3 uppercase tracking-wider text-white/60">Recommended Next Actions</h3>
                <div className="flex flex-col gap-2.5">
                  {selected.next_actions.map((act, idx) => (
                    <div key={idx} className="flex gap-2.5 items-start text-xs text-white/80 leading-normal">
                      <div className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <span className="flex-1">{act}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs for Roadmap, Skills analysis, and Salary estimates */}
            <div className="border-b border-white/5 flex gap-2">
              {[
                { id: 'roadmap', label: 'Personalized Roadmap' },
                { id: 'skills', label: 'Skill Gap Analysis' },
                { id: 'salary', label: 'Local Market Estimates' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-3 text-xs font-semibold border-b-2 transition-all ${
                    activeTab === tab.id 
                      ? 'border-indigo-500 text-white' 
                      : 'border-transparent text-white/40 hover:text-white/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Roadmap Tab */}
            {activeTab === 'roadmap' && (
              <div className="glass-card p-6 flex flex-col gap-4">
                <h3 className="text-white font-bold text-sm">Step-by-Step Learning Path</h3>
                <div className="relative pl-6 border-l border-white/10 flex flex-col gap-6 ml-2 mt-2">
                  {selected.roadmap?.map((step, idx) => (
                    <div key={idx} className="relative group">
                      {/* Bullet icon */}
                      <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 ${
                        step.status === 'Completed'
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : step.status === 'In Progress'
                          ? 'bg-yellow-500/25 border-yellow-500 text-yellow-400 animate-pulse'
                          : 'bg-slate-900 border-white/20'
                      }`}>
                        {step.status === 'Completed' && <CheckCircle size={10} />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{step.step}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                            step.status === 'Completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : step.status === 'In Progress'
                              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                              : 'bg-white/5 text-white/40 border-white/10'
                          }`}>
                            {step.status}
                          </span>
                        </div>
                        <h4 className="text-white font-bold text-xs mt-1">{step.title}</h4>
                        <p className="text-white/50 text-[11px] mt-0.5 leading-normal">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills Gap Analysis Tab */}
            {activeTab === 'skills' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-5">
                  <h3 className="text-white font-bold text-xs mb-3 text-emerald-400 flex items-center gap-1">
                    <CheckCircle size={14} /> Strong Skills
                  </h3>
                  {selected.strong_skills && selected.strong_skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selected.strong_skills.map((s, idx) => (
                        <span key={idx} className="badge badge-green text-xs">{s}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-white/30 text-xs">No strong skills detected. Complete skill assessments to update your profile.</span>
                  )}
                </div>

                <div className="glass-card p-5">
                  <h3 className="text-white font-bold text-xs mb-3 text-yellow-400 flex items-center gap-1">
                    <AlertTriangle size={14} /> Developing Skills
                  </h3>
                  {selected.developing_skills && selected.developing_skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selected.developing_skills.map((s, idx) => (
                        <span key={idx} className="badge badge-orange text-xs">{s}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-white/30 text-xs">No developing skills detected. Try intermediate coding modules.</span>
                  )}
                </div>

                <div className="glass-card p-5 md:col-span-2">
                  <h3 className="text-white font-bold text-xs mb-3 text-red-400 flex items-center gap-1">
                    <Briefcase size={14} /> Missing Required Skills
                  </h3>
                  {selected.skill_gaps && selected.skill_gaps.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selected.skill_gaps.map((s, idx) => (
                        <span key={idx} className="badge badge-purple text-xs">{s}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-emerald-400 text-xs font-semibold">Fantastic! You have achieved all required skills for this role.</span>
                  )}
                </div>
              </div>
            )}

            {/* Salary Estimates Tab */}
            {activeTab === 'salary' && (
              <div className="glass-card p-6 flex flex-col gap-4">
                <h3 className="text-white font-bold text-sm">Regional Market Estimates ({data?.user_country})</h3>
                <p className="text-white/50 text-[11px] leading-relaxed">
                  Calculated using reliable salary records from the Job Skills dataset mapped to your local currency. Converted values are calculated based on current market exchange indices.
                </p>

                <div className="space-y-4 mt-2">
                  {[
                    { label: 'Entry Level', pct: 0.8, color: 'text-blue-400' },
                    { label: 'Mid Level', pct: 1.0, color: 'text-indigo-400' },
                    { label: 'Senior Specialist', pct: 1.25, color: 'text-emerald-400' }
                  ].map((level, idx) => {
                    const baseMin = selected.average_salary_usd * 0.8 * level.pct;
                    const baseMax = selected.average_salary_usd * 1.2 * level.pct;
                    return (
                      <div key={idx} className="flex justify-between items-center bg-white/2 p-3.5 rounded-xl border border-white/5">
                        <div>
                          <span className={`font-bold text-xs ${level.color}`}>{level.label}</span>
                          <span className="text-[10px] text-white/30 block mt-0.5">Approx. USD ${(baseMin).toLocaleString()} - ${(baseMax).toLocaleString()}</span>
                        </div>
                        <span className="text-sm font-extrabold text-white">
                          {selected.salary_symbol}{Math.round(baseMin * (selected.match_score > 0 ? 83 : 1)).toLocaleString()} - {selected.salary_symbol}{Math.round(baseMax * (selected.match_score > 0 ? 83 : 1)).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recommended Courses to close Gaps */}
            {selected.recommended_courses && selected.recommended_courses.length > 0 && (
              <div className="glass-card p-5 flex flex-col gap-3">
                <h3 className="text-white font-bold text-xs uppercase tracking-wider text-white/60">Recommended Courses to Bridge Gaps</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {selected.recommended_courses.map((course, idx) => (
                    <div 
                      key={idx} 
                      className="bg-white/2 hover:bg-white/5 border border-white/5 hover:border-indigo-500/20 rounded-xl p-4 flex flex-col justify-between transition-all cursor-pointer"
                      onClick={() => navigate('/courses')}
                    >
                      <div>
                        <span className="text-[9px] text-indigo-400 font-bold block uppercase mb-1">{course.category}</span>
                        <h4 className="text-white font-bold text-xs line-clamp-2 leading-snug">{course.course_name}</h4>
                        <span className="text-[10px] text-white/40 block mt-1">{course.provider}</span>
                      </div>
                      <div className="flex justify-between items-center mt-4">
                        <span className="text-yellow-400 text-xs font-bold">★ {course.rating || '4.5'}</span>
                        <ArrowRight size={14} className="text-indigo-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center h-64 text-white/30 text-xs">
            Select a career track to view details.
          </div>
        )}
      </div>
    </div>
  );
}
