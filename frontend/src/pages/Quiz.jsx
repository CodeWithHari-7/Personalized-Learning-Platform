import React, { useState, useEffect } from 'react';
import { quizAPI } from '../services/api';
import { Brain, Loader2, CheckCircle2, XCircle, Trophy, RotateCcw, Play, Clock, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const TOPICS = ['Machine Learning', 'Deep Learning', 'Python', 'SQL', 'Statistics', 'Data Engineering',
  'Neural Networks', 'Feature Engineering', 'NLP', 'Computer Vision', 'Cloud Computing',
  'Pandas', 'NumPy', 'Scikit-Learn', 'TensorFlow', 'PyTorch'];

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

export default function Quiz() {
  const [mode, setMode] = useState('menu'); // menu | generating | quiz | results | history
  const [form, setForm] = useState({ topic: 'Machine Learning', difficulty: 'Intermediate', num_questions: 5 });
  const [quizData, setQuizData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [history, setHistory] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [currentQ, setCurrentQ] = useState(0);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (mode === 'quiz' && startTime) {
      const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
      return () => clearInterval(interval);
    }
  }, [mode, startTime]);

  const loadHistory = async () => {
    try {
      const res = await quizAPI.history();
      setHistory(res.data || []);
    } catch {}
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await quizAPI.generate(form);
      setQuizData(res.data);
      setAnswers({});
      setMode('quiz');
      setStartTime(Date.now());
      setCurrentQ(0);
      setElapsed(0);
    } catch (err) {
      toast.error('Failed to generate quiz. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const submit = async () => {
    if (Object.keys(answers).length < quizData.questions.length) {
      toast.error('Please answer all questions before submitting');
      return;
    }
    setSubmitting(true);
    try {
      const res = await quizAPI.submit({
        quiz_history_id: quizData.quiz_id,
        answers,
        time_taken_seconds: elapsed
      });
      setResults(res.data);
      setMode('results');
      loadHistory();
    } catch (err) {
      toast.error('Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const gradeColor = {
    A: 'text-green-400', B: 'text-blue-400', C: 'text-yellow-400',
    D: 'text-orange-400', F: 'text-red-400'
  };

  if (mode === 'results' && results) {
    const pct = results.percentage;
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Score card */}
        <div className="glass-card p-8 text-center">
          <div className={`text-7xl font-black mb-2 ${gradeColor[results.grade]}`}>{results.grade}</div>
          <div className="text-4xl font-bold text-white mb-1">{results.score}/{results.max_score}</div>
          <div className="text-slate-400 mb-4">{pct.toFixed(1)}% · {formatTime(elapsed)}</div>
          <div className="w-full bg-slate-800 rounded-full h-3 mb-6">
            <div className={`h-3 rounded-full transition-all duration-1000 ${pct>=90?'bg-green-500':pct>=70?'bg-blue-500':pct>=50?'bg-yellow-500':'bg-red-500'}`}
              style={{ width: `${pct}%` }} />
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setMode('menu'); setResults(null); setQuizData(null); }} className="btn-secondary flex items-center gap-2">
              <RotateCcw size={16} /> New Quiz
            </button>
            <button onClick={() => { setMode('quiz'); setResults(null); setAnswers({}); setCurrentQ(0); setStartTime(Date.now()); }} className="btn-primary flex items-center gap-2">
              <Play size={16} /> Retry
            </button>
          </div>
        </div>

        {/* Feedback */}
        <div className="space-y-4">
          {results.feedback.map((fb, i) => (
            <div key={i} className={`glass-card p-4 border ${fb.is_correct ? 'border-green-500/30' : 'border-red-500/30'}`}>
              <div className="flex items-start gap-3">
                {fb.is_correct
                  ? <CheckCircle2 size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
                  : <XCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className="text-white font-medium text-sm mb-2">Q{i+1}: {fb.question}</p>
                  <div className="space-y-1 text-xs">
                    <p className="text-slate-400">Your answer: <span className={fb.is_correct ? 'text-green-400' : 'text-red-400'}>{fb.user_answer || '(not answered)'}</span></p>
                    {!fb.is_correct && <p className="text-slate-400">Correct: <span className="text-green-400">{fb.correct_answer}</span></p>}
                    <p className="text-slate-500 mt-2 bg-slate-800/50 p-2 rounded-lg">{fb.explanation}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'quiz' && quizData) {
    const questions = quizData.questions;
    const q = questions[currentQ];
    const answered = Object.keys(answers).length;
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold">{quizData.topic}</h2>
            <p className="text-slate-400 text-sm">{quizData.difficulty} · {questions.length} questions</p>
          </div>
          <div className="flex items-center gap-2 bg-surface-800 border border-indigo-500/20 rounded-xl px-4 py-2">
            <Clock size={16} className="text-indigo-400" />
            <span className="text-white font-mono font-bold">{formatTime(elapsed)}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Question {currentQ+1} of {questions.length}</span>
            <span>{answered} answered</span>
          </div>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrentQ(i)}
                className={`h-1.5 flex-1 rounded-full transition-all ${answers[i.toString()] ? 'bg-indigo-500' : i === currentQ ? 'bg-indigo-300' : 'bg-slate-700'}`} />
            ))}
          </div>
        </div>

        {/* Question card */}
        <div className="glass-card p-6">
          <h3 className="text-white font-semibold text-base mb-6">{q.question}</h3>
          <div className="space-y-3">
            {q.options.map((opt, oi) => (
              <button key={oi}
                onClick={() => setAnswers(prev => ({ ...prev, [currentQ.toString()]: opt }))}
                className={`w-full text-left p-4 rounded-xl border transition-all text-sm
                  ${answers[currentQ.toString()] === opt
                    ? 'bg-indigo-500/20 border-indigo-500 text-white'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:border-indigo-500/50 hover:bg-indigo-500/10'}`}
              >
                <span className="font-bold mr-2">{String.fromCharCode(65+oi)}.</span>{opt}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button onClick={() => setCurrentQ(Math.max(0, currentQ-1))} disabled={currentQ === 0}
            className="btn-secondary disabled:opacity-40">Previous</button>
          <div className="flex-1" />
          {currentQ < questions.length - 1
            ? <button onClick={() => setCurrentQ(currentQ+1)} className="btn-primary">Next Question</button>
            : <button onClick={submit} disabled={submitting || answered < questions.length} className="btn-primary flex items-center gap-2">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
                Submit Quiz
              </button>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold gradient-text mb-1">Quiz Generator</h1>
        <p className="text-slate-400">AI-powered quizzes on any Data Science topic</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generate form */}
        <div className="glass-card p-6 space-y-5">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Brain size={18} className="text-indigo-400" /> Generate New Quiz
          </h2>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Topic</label>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map(t => (
                <button key={t} onClick={() => setForm(f => ({...f, topic: t}))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${form.topic === t ? 'bg-indigo-500 text-white' : 'bg-slate-800/70 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-300'}`}>
                  {t}
                </button>
              ))}
            </div>
            <input type="text" className="input-field mt-2 text-sm" placeholder="Or type a custom topic..."
              value={TOPICS.includes(form.topic) ? '' : form.topic}
              onChange={e => setForm(f => ({...f, topic: e.target.value}))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Difficulty</label>
              <div className="flex gap-2">
                {DIFFICULTIES.map(d => (
                  <button key={d} onClick={() => setForm(f => ({...f, difficulty: d}))}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${form.difficulty === d ? 'bg-indigo-500 text-white' : 'bg-slate-800/70 text-slate-400 hover:bg-indigo-500/20'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Questions: {form.num_questions}</label>
              <input type="range" min={3} max={15} value={form.num_questions}
                onChange={e => setForm(f => ({...f, num_questions: parseInt(e.target.value)}))}
                className="w-full accent-indigo-500" />
            </div>
          </div>

          <button onClick={generate} disabled={generating || !form.topic}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            {generating ? <><Loader2 size={18} className="animate-spin" /> Generating...</> : <><Play size={18} /> Start Quiz</>}
          </button>
        </div>

        {/* History */}
        <div className="glass-card p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Trophy size={18} className="text-yellow-400" /> Recent Quizzes
          </h2>
          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <HelpCircle size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No quizzes taken yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.slice(0,8).map(q => (
                <div key={q.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/60 transition-all">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm
                    ${(q.percentage||0)>=80?'bg-green-500/20 text-green-400':(q.percentage||0)>=60?'bg-yellow-500/20 text-yellow-400':'bg-red-500/20 text-red-400'}`}>
                    {q.percentage ? `${q.percentage.toFixed(0)}%` : '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{q.topic}</p>
                    <p className="text-slate-500 text-xs">{q.difficulty} · {q.num_questions} questions</p>
                  </div>
                  <span className="text-slate-600 text-xs">{q.created_at ? new Date(q.created_at).toLocaleDateString() : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
