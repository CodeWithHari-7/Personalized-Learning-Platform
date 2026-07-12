import React, { useState, useEffect } from 'react';
import { codingAPI } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Code2, Play, Send, Loader2, Trophy, CheckCircle2, RotateCcw, 
  ChevronDown, ChevronUp, AlertCircle, Check, X, ShieldAlert, Sparkles 
} from 'lucide-react';
import toast from 'react-hot-toast';

const TOPICS = [
  'Python Strings', 'Java Arrays', 'SQL JOIN', 'Pandas', 'NumPy', 
  'Machine Learning', 'Data Structures', 'Algorithms', 'Data Cleaning',
  'Feature Engineering', 'OOP in Python', 'API Requests'
];
const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];
const LANGUAGES = ['Python', 'SQL', 'R'];

export default function CodingChallenges() {
  const [mode, setMode] = useState('menu'); // menu | challenge | feedback
  const [form, setForm] = useState({ topic: 'Python Strings', difficulty: 'Intermediate', language: 'Python' });
  const [customTopic, setCustomTopic] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadChallenges();
    loadStats();
  }, []);

  const loadChallenges = async () => {
    try { 
      const res = await codingAPI.list(); 
      setChallenges(res.data || []); 
    } catch (err) {
      console.error(err);
    }
  };

  const loadStats = async () => {
    try { 
      const res = await codingAPI.stats(); 
      setStats(res.data); 
    } catch (err) {
      console.error(err);
    }
  };

  const generate = async () => {
    setGenerating(true);
    const finalTopic = customTopic.trim() || form.topic;
    try {
      const res = await codingAPI.generate({
        ...form,
        topic: finalTopic
      });
      setChallenge(res.data);
      setCode(res.data.starter_code || '');
      setFeedback(null);
      setMode('challenge');
    } catch (err) { 
      toast.error('Failed to generate challenge'); 
    } finally { 
      setGenerating(false); 
    }
  };

  const submit = async () => {
    if (!code.trim()) { 
      toast.error('Please write some code first'); 
      return; 
    }
    setSubmitting(true);
    try {
      const res = await codingAPI.submit(challenge.id, { 
        challenge_id: challenge.id, 
        user_code: code 
      });
      setFeedback(res.data);
      setMode('feedback');
      loadChallenges();
      loadStats();
    } catch (err) { 
      toast.error('Failed to submit code'); 
    } finally { 
      setSubmitting(false); 
    }
  };

  // Editor Copy/Paste Blocker
  const handleCopyPasteBlock = (e) => {
    e.preventDefault();
    toast.error("Copy and paste are disabled during coding challenges.", { 
      id: 'cp-block',
      duration: 3000
    });
  };

  const handleKeyDownBlock = (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (isCtrlOrCmd && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      toast.error("Copy and paste are disabled during coding challenges.", { 
        id: 'cp-block',
        duration: 3000
      });
    }
  };

  if (mode === 'feedback' && feedback) {
    const score = feedback.score || 0;
    const rating10 = (score / 10).toFixed(1);
    
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Summary Card */}
        <div className="glass-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-indigo-500/10">
          <div className="text-center md:text-left">
            <h2 className="text-white font-bold text-xl mb-1">Challenge Completed!</h2>
            <p className="text-white/50 text-xs">Review your score and AI feedback below.</p>
            <div className="flex gap-3 mt-4 justify-center md:justify-start">
              <button 
                onClick={() => setMode('menu')} 
                className="btn-secondary rounded-xl py-2 px-4 text-xs font-semibold flex items-center gap-1.5"
              >
                <RotateCcw size={14}/> New Practice
              </button>
              <button 
                onClick={() => { setMode('challenge'); setFeedback(null); }} 
                className="btn-primary rounded-xl py-2 px-4 text-xs font-semibold flex items-center gap-1.5"
              >
                <Code2 size={14}/> Try Again
              </button>
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className={`text-4xl font-extrabold px-6 py-4 rounded-2xl bg-white/5 border ${
              score >= 80 ? 'text-emerald-400 border-emerald-500/30' : score >= 60 ? 'text-yellow-400 border-yellow-500/30' : 'text-red-400 border-red-500/30'
            }`}>
              {score}/100 <span className="text-xs text-white/40 block text-center font-normal mt-0.5">({rating10}/10)</span>
            </div>
          </div>
        </div>

        {/* Score Breakdown & Complexity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Breakdown Card */}
          <div className="glass-card p-6 flex flex-col gap-4">
            <h3 className="text-white font-bold text-sm">Evaluation Breakdown</h3>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Functional Correctness (60%)', value: feedback.correctness_score, color: 'bg-emerald-500' },
                { label: 'Logic & Algorithm (15%)', value: feedback.logic_score, color: 'bg-blue-500' },
                { label: 'Code Quality & Style (10%)', value: feedback.code_quality_score, color: 'bg-purple-500' },
                { label: 'Efficiency & Complexity (10%)', value: feedback.efficiency_score, color: 'bg-yellow-500' },
              ].map(item => (
                <div key={item.label} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-white/70">{item.label}</span>
                    <span className="font-semibold text-white">{item.value ?? 70}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${item.value ?? 70}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Complexity details */}
          <div className="glass-card p-6 flex flex-col gap-4">
            <h3 className="text-white font-bold text-sm">Complexity Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/5 text-center">
                <span className="text-xs text-white/50 block">Time Complexity</span>
                <span className="text-lg font-bold text-indigo-400 font-mono mt-1 block">{feedback.time_complexity || 'O(N)'}</span>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/5 text-center">
                <span className="text-xs text-white/50 block">Space Complexity</span>
                <span className="text-lg font-bold text-indigo-400 font-mono mt-1 block">{feedback.space_complexity || 'O(1)'}</span>
              </div>
            </div>

            {/* Test cases passed count */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex items-center justify-between text-xs text-white/70">
              <span>Test cases passed:</span>
              <span className="font-bold text-emerald-400 text-sm">
                {feedback.test_cases_passed} / {feedback.test_cases_total}
              </span>
            </div>
          </div>
        </div>

        {/* AI detailed feedback */}
        <div className="glass-card p-6">
          <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-1.5">
            <Sparkles size={16} className="text-indigo-400" /> AI Feedback & Suggestions
          </h3>
          <p className="text-xs text-white/70 leading-relaxed mb-4">{feedback.feedback}</p>
          
          {feedback.improvements && feedback.improvements.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-white">Suggested Improvements:</span>
              <ul className="list-disc pl-4 text-xs text-white/60 flex flex-col gap-1.5">
                {feedback.improvements.map((imp, idx) => (
                  <li key={idx}>{imp}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Test Case Execution Detail List */}
        {feedback.test_case_results && feedback.test_case_results.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="text-white font-bold text-sm mb-4">Functional Test Case Results</h3>
            <div className="flex flex-col gap-3">
              {feedback.test_case_results.map((tc, idx) => (
                <div key={idx} className="bg-white/5 border border-white/5 rounded-xl p-4 text-xs flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white/80">{tc.description}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border ${
                      tc.passed 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {tc.passed ? <Check size={10} /> : <X size={10} />}
                      {tc.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-[11px] font-mono mt-1">
                    <div>
                      <span className="text-white/40 block">Output:</span>
                      <pre className="text-red-300 mt-0.5 truncate bg-black/20 p-2 rounded-lg">{tc.output}</pre>
                    </div>
                    <div>
                      <span className="text-white/40 block">Expected:</span>
                      <pre className="text-emerald-300 mt-0.5 truncate bg-black/20 p-2 rounded-lg">{tc.expected}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Code and Reference Solution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6 flex flex-col">
            <h3 className="text-white font-bold text-sm mb-3">Your Solution</h3>
            <pre className="flex-1 bg-slate-950 p-4 rounded-xl border border-white/5 text-xs text-green-300 font-mono overflow-auto max-h-64">
              <code>{challenge?.user_code || code}</code>
            </pre>
          </div>

          <div className="glass-card p-6 flex flex-col">
            <h3 className="text-white font-bold text-sm mb-3">Reference Solution</h3>
            {feedback.reference_solution ? (
              <pre className="flex-1 bg-slate-950 p-4 rounded-xl border border-white/5 text-xs text-blue-300 font-mono overflow-auto max-h-64">
                <code>{feedback.reference_solution}</code>
              </pre>
            ) : (
              <div className="flex items-center justify-center flex-1 bg-slate-950 p-4 rounded-xl border border-white/5 text-xs text-white/30">
                Reference solution not available for this language/challenge.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'challenge' && challenge) {
    const publicTcs = (() => { 
      try { 
        return JSON.parse(challenge.test_cases || '[]'); 
      } catch { 
        return []; 
      } 
    })();

    return (
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Anti-Cheat Header Banner */}
        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl py-3 px-4 text-xs text-indigo-300 leading-snug">
          <ShieldAlert size={16} />
          <span>Notice: Copy/paste shortcuts, right-click, and drag/drop text inputs are disabled in the editor to ensure integrity.</span>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setMode('menu')} className="btn-secondary rounded-xl py-1.5 px-4 text-xs font-semibold">← Back</button>
          <div>
            <h2 className="text-white font-bold text-lg">{challenge.challenge_title}</h2>
            <div className="flex gap-2 mt-1 flex-wrap">
              <span className="badge badge-purple text-xs px-2 py-0.5 rounded-full">{challenge.difficulty}</span>
              <span className="badge badge-blue text-xs px-2 py-0.5 rounded-full">{challenge.language}</span>
              <span className="badge badge-orange text-xs px-2 py-0.5 rounded-full">{challenge.topic}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Problem description */}
          <div className="space-y-4">
            <div className="glass-card p-6 flex flex-col gap-3">
              <h3 className="text-white font-bold text-sm">Problem Description</h3>
              <div className="text-white/70 text-xs leading-relaxed prose prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{challenge.challenge_description}</ReactMarkdown>
              </div>
            </div>

            {publicTcs.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="text-white font-bold text-sm mb-3">Public Examples</h3>
                <div className="space-y-2">
                  {publicTcs.map((tc, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-xl font-mono text-[11px] border border-white/5">
                      <p className="text-white/40">Input: <span className="text-green-300">{tc.input}</span></p>
                      <p className="text-white/40">Expected: <span className="text-blue-300">{tc.expected}</span></p>
                      {tc.description && <p className="text-white/30 text-[10px] mt-1">Description: {tc.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {challenge.hints && (
              <div className="glass-card p-4">
                <button onClick={() => setShowHints(!showHints)} className="flex items-center gap-2 text-indigo-400 font-bold text-xs w-full">
                  💡 Practice Hints {showHints ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>
                {showHints && (
                  <div className="mt-3 space-y-2 text-xs text-white/50 pl-2">
                    {(typeof challenge.hints === 'string' ? JSON.parse(challenge.hints || '[]') : challenge.hints).map((h, i) => (
                      <p key={i}>• {h}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Safe Code Editor */}
          <div className="glass-card p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-bold text-sm">Your Solution Editor</h3>
              <span className="text-[10px] text-white/40">Disabled: copy/paste & right-click</span>
            </div>
            
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              onCopy={handleCopyPasteBlock}
              onPaste={handleCopyPasteBlock}
              onCut={handleCopyPasteBlock}
              onContextMenu={handleCopyPasteBlock}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleCopyPasteBlock}
              onKeyDown={handleKeyDownBlock}
              className="flex-1 bg-slate-950 border border-indigo-500/20 rounded-xl p-4 font-mono text-xs text-green-300 resize-none outline-none focus:border-indigo-500/60 min-h-[300px]"
              placeholder="Write your solution function here..."
              spellCheck={false}
            />

            <button 
              onClick={submit} 
              disabled={submitting || !code.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin"/> Evaluating Solution...</>
              ) : (
                <><Send size={16}/> Submit Solution</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text mb-1">Coding Challenges</h1>
        <p className="text-slate-400 text-xs">Test your data science and programming skills with sandboxed execution</p>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Attempted', value: stats.total_attempted, color: 'text-indigo-400' },
            { label: 'Completed', value: stats.completed, color: 'text-green-400' },
            { label: 'Success Rate', value: `${stats.completion_rate}%`, color: 'text-blue-400' },
            { label: 'Average Score', value: `${stats.avg_score}/100`, color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="glass-card p-4 text-center border border-white/5">
              <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Custom and dropdown generator form */}
        <div className="lg:col-span-2 glass-card p-6 space-y-5">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <Code2 size={18} className="text-indigo-400"/> New Practice Session
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-2">Select Predefined Topic</label>
              <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto custom-scrollbar p-1">
                {TOPICS.map(t => (
                  <button 
                    key={t} 
                    type="button"
                    onClick={() => {
                      setForm(f => ({...f, topic: t}));
                      setCustomTopic('');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                      form.topic === t && !customTopic 
                        ? 'bg-indigo-500 text-white' 
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-between">
              <div>
                <label className="block text-xs text-white/60 mb-2">Or Enter Custom Topic</label>
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-500/60"
                  placeholder="e.g. Pandas groupby, SQL Window Functions..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 md:mt-0">
                <div>
                  <label className="block text-xs text-white/60 mb-1.5">Difficulty</label>
                  <select 
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-indigo-500/60"
                    value={form.difficulty} 
                    onChange={e => setForm(f => ({...f, difficulty: e.target.value}))}
                  >
                    {DIFFICULTIES.map(d => <option key={d} value={d} className="bg-zinc-950">{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1.5">Language</label>
                  <select 
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-indigo-500/60"
                    value={form.language} 
                    onChange={e => setForm(f => ({...f, language: e.target.value}))}
                  >
                    {LANGUAGES.map(l => <option key={l} value={l} className="bg-zinc-950">{l}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={generate} 
            disabled={generating}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs"
          >
            {generating ? (
              <><Loader2 size={16} className="animate-spin"/> AI is creating challenge...</>
            ) : (
              <><Play size={16}/> Start Coding Challenge</>
            )}
          </button>
        </div>

        {/* Previous challenges sidebar */}
        <div className="glass-card p-6 flex flex-col">
          <h2 className="text-white font-semibold text-sm mb-4">Attempt History</h2>
          {challenges.length === 0 ? (
            <div className="text-center py-12 text-white/30 flex-1 flex flex-col items-center justify-center">
              <Code2 size={28} className="opacity-30 mb-2"/>
              <p className="text-xs">No attempts logged yet.</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[300px] custom-scrollbar flex-1">
              {challenges.map(c => (
                <div 
                  key={c.id} 
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/2 cursor-pointer border border-white/5 hover:border-white/15 hover:bg-white/5 transition-all"
                  onClick={() => { 
                    setChallenge(c); 
                    setCode(c.user_code || c.starter_code || ''); 
                    // If already completed, fetch attempt result details
                    if (c.is_completed && c.ai_feedback) {
                      try {
                        const parsedFeedback = JSON.parse(c.ai_feedback);
                        setFeedback({
                          ...parsedFeedback,
                          score: c.score,
                          reference_solution: c.solution_code
                        });
                        setMode('feedback');
                      } catch {
                        setMode('challenge');
                      }
                    } else {
                      setFeedback(null);
                      setMode('challenge'); 
                    }
                  }}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    c.is_completed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'
                  }`}>
                    {c.is_completed ? <CheckCircle2 size={14}/> : <Code2 size={14}/>}
                  </div>
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="text-white font-medium truncate">{c.challenge_title || c.topic}</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-white/40 text-[10px]">{c.difficulty} ({c.language})</span>
                      {c.score != null && (
                        <span className="font-bold text-yellow-400 font-mono">{c.score}/100</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
