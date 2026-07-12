import React, { useState, useEffect } from 'react';
import { learningPathAPI } from '../services/api';
import { Map, Play, CheckCircle2, Clock, Loader2, Plus, BookOpen, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const CAREER_GOALS = ['Data Scientist', 'ML Engineer', 'Data Engineer', 'AI Engineer', 'Data Analyst', 'Business Analyst', 'Research Scientist', 'MLOps Engineer'];

export default function LearningPath() {
  const [paths, setPaths] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newGoal, setNewGoal] = useState('Data Scientist');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadPaths();
  }, []);

  const loadPaths = async () => {
    try {
      const res = await learningPathAPI.list();
      const data = res.data || [];
      setPaths(data);
      if (data.length > 0) setSelected(data[0]);
    } catch {}
    finally { setLoading(false); }
  };

  const create = async () => {
    setCreating(true);
    try {
      const res = await learningPathAPI.create(newGoal);
      const newPath = res.data;
      setPaths(prev => [newPath, ...prev]);
      setSelected(newPath);
      setShowCreate(false);
      toast.success(`Learning path for "${newGoal}" created!`);
    } catch { toast.error('Failed to create learning path'); }
    finally { setCreating(false); }
  };

  const getStatusColor = (status) => ({
    Pending: 'text-slate-400 bg-slate-700/50',
    'In Progress': 'text-blue-400 bg-blue-500/20',
    Completed: 'text-green-400 bg-green-500/20',
  }[status] || 'text-slate-400 bg-slate-700/50');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner mx-auto" style={{ width: 40, height: 40, borderWidth: 3 }} />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text mb-1">Learning Paths</h1>
          <p className="text-slate-400">Personalized course sequences for your career goals</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Path
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="glass-card p-5">
          <h3 className="text-white font-semibold mb-4">Create New Learning Path</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {CAREER_GOALS.map(g => (
              <button key={g} onClick={() => setNewGoal(g)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${newGoal === g ? 'bg-indigo-500 text-white' : 'bg-slate-800/70 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-300'}`}>
                {g}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={create} disabled={creating} className="btn-primary flex items-center gap-2">
              {creating ? <><Loader2 size={16} className="animate-spin"/> Creating...</> : <><Play size={16}/> Generate Path</>}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {paths.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Map size={48} className="mx-auto mb-4 text-indigo-400 opacity-60" />
          <h3 className="text-white font-semibold text-lg mb-2">No Learning Paths Yet</h3>
          <p className="text-slate-400 mb-6">Create a personalized learning path based on your career goal</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">Create Your First Path</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Path list */}
          <div className="space-y-3">
            {paths.map(path => (
              <button key={path.id} onClick={() => setSelected(path)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${selected?.id === path.id ? 'bg-indigo-500/20 border-indigo-500/60' : 'glass-card border-transparent hover:border-indigo-500/30'}`}>
                <p className="text-white font-semibold text-sm">{path.path_name}</p>
                <p className="text-slate-400 text-xs mt-1">{path.total_courses} courses · {path.estimated_weeks} weeks</p>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Progress</span><span>{path.completion_percent.toFixed(0)}%</span>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${path.completion_percent}%` }} /></div>
                </div>
              </button>
            ))}
          </div>

          {/* Path detail */}
          {selected && (
            <div className="lg:col-span-2 glass-card p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">{selected.path_name}</h2>
                  <p className="text-slate-400 text-sm mt-1">{selected.description}</p>
                  <div className="flex gap-3 mt-3">
                    <span className="flex items-center gap-1.5 text-sm text-slate-300">
                      <BookOpen size={14} className="text-indigo-400" /> {selected.total_courses} courses
                    </span>
                    <span className="flex items-center gap-1.5 text-sm text-slate-300">
                      <Clock size={14} className="text-indigo-400" /> {selected.estimated_weeks} weeks
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black gradient-text">{selected.completion_percent.toFixed(0)}%</p>
                  <p className="text-slate-500 text-xs">Complete</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="relative">
                {(selected.steps || []).map((step, i) => (
                  <div key={i} className="flex gap-4 mb-4 relative">
                    {/* Line */}
                    {i < (selected.steps || []).length - 1 && (
                      <div className="absolute left-5 top-10 w-0.5 h-full bg-indigo-500/20" />
                    )}
                    {/* Step marker */}
                    <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold z-10
                      ${step.status === 'Completed' ? 'bg-green-500 text-white' : step.status === 'In Progress' ? 'bg-indigo-500 text-white' : 'bg-slate-700/80 text-slate-400 border border-slate-600'}`}>
                      {step.status === 'Completed' ? <CheckCircle2 size={18} /> : step.step_order}
                    </div>
                    {/* Content */}
                    <div className={`flex-1 p-4 rounded-xl border transition-all ${step.status === 'Completed' ? 'bg-green-500/5 border-green-500/20' : step.status === 'In Progress' ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-slate-800/30 border-slate-700/30'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm">{step.course?.course_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400">{step.course?.provider}</span>
                            <span className="text-xs text-slate-500">·</span>
                            <span className="text-xs text-slate-400">{step.course?.duration_hours}h</span>
                            {step.is_mandatory && <span className="badge badge-orange text-xs py-0">Required</span>}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium flex-shrink-0 ${getStatusColor(step.status)}`}>
                          {step.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
