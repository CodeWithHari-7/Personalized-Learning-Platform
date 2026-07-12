import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen, CheckCircle2, Clock, Trophy, XCircle, TrendingUp,
  BarChart2, Loader2, AlertCircle, RefreshCw, Layers, Eye,
  Play, Upload, Shield, Award, ChevronRight, PlayCircle, ExternalLink,
  ChevronLeft, Sparkles, Check, Info, FileText, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { progressAPI, coursesAPI } from '../services/api';

// ─── Helpers ───────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Enrolled Courses', 'Completed Courses', 'Certificates'];

const BAR_COLORS = ['#22d3ee', '#a855f7', '#6366f1', '#34d399', '#f59e0b', '#ec4899'];

const fmtTime = (mins) => {
  if (!mins) return '0 min';
  const hrs = Math.floor(mins / 60);
  const remMins = Math.round(mins % 60);
  if (hrs > 0) {
    return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
  }
  return `${remMins} min`;
};

const fmtSecondsToHuman = (seconds) => {
  if (!seconds) return '0 min';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} minutes`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs} hours ${remMins} minutes` : `${hrs} hours`;
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Completed': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    case 'In Progress': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    default: return 'text-white/40 bg-white/5 border-white/10';
  }
};

const getVerificationBadge = (status) => {
  switch (status) {
    case 'Verified': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'Likely Valid': return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
    case 'Rejected': return 'bg-red-500/20 text-red-300 border-red-500/30';
    default: return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  }
};

// ─── Stat Card ─────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, colorClass = 'text-purple-400' }) => (
  <div className="glass-card rounded-2xl p-5 flex items-center gap-4 border border-white/5 bg-white/2 hover:border-white/15 transition-all duration-300">
    <div className={`p-3 rounded-xl bg-white/5 ${colorClass}`}>{icon}</div>
    <div>
      <p className="text-2xl font-bold text-white tracking-tight">{value ?? 0}</p>
      <p className="text-white/50 text-xs mt-0.5 font-medium">{label}</p>
    </div>
  </div>
);

// ─── Progress Bar ──────────────────────────────────────────────────────────

const ProgressBar = ({ pct }) => (
  <div className="rounded-full overflow-hidden h-2 w-full bg-white/10 relative">
    <div
      className="h-full rounded-full transition-all duration-500"
      style={{
        width: `${Math.min(100, pct ?? 0)}%`,
        background: pct >= 100 ? '#10b981' : pct >= 50 ? '#6366f1' : '#22d3ee'
      }}
    />
  </div>
);

export default function Progress() {
  const [progressList, setProgressList] = useState([]);
  const [certificatesList, setCertificatesList] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');

  // Study Session Tracker state
  const [activeSession, setActiveSession] = useState(null); // { course_id, course_name, progress_id, seconds, url }
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const sessionTimer = useRef(null);

  // Modal states
  const [editingProgress, setEditingProgress] = useState(null); // { progress_id, course_name, pct, completed, total }
  const [uploadingCert, setUploadingCert] = useState(null); // course/progress info
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const fetchProgressData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, certsRes, statsRes] = await Promise.all([
        progressAPI.getAll(),
        progressAPI.getCertificates(),
        progressAPI.stats()
      ]);
      setProgressList(listRes || []);
      setCertificatesList(certsRes || []);
      setStats(statsRes || null);
    } catch (err) {
      console.error(err);
      setError('Failed to load progress data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgressData();
  }, [fetchProgressData]);

  // Periodic active study time logger
  useEffect(() => {
    if (activeSession) {
      sessionTimer.current = setInterval(() => {
        setSessionSeconds(prev => {
          const nextVal = prev + 1;
          // Every 15 seconds, log progress to backend
          if (nextVal % 15 === 0) {
            progressAPI.postStudyTime(activeSession.course_id, 15)
              .catch(err => console.error("Error logging study time:", err));
          }
          return nextVal;
        });
      }, 1000);
    } else {
      if (sessionTimer.current) {
        clearInterval(sessionTimer.current);
      }
      setSessionSeconds(0);
    }
    return () => {
      if (sessionTimer.current) {
        clearInterval(sessionTimer.current);
      }
    };
  }, [activeSession]);

  const startStudySession = (item) => {
    if (activeSession) {
      toast.error(`Please stop your active session for "${activeSession.course_name}" first.`);
      return;
    }
    const cId = item.course?.course_id || item.course_id;
    const url = item.course_url ?? item.course?.url;

    setActiveSession({
      course_id: cId,
      course_name: item.course_name ?? item.course?.course_name ?? 'Untitled Course',
      progress_id: item.id,
      url: url
    });
    setSessionSeconds(0);
    toast.success(`Study session started for "${item.course_name || item.course?.course_name}"!`);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const stopStudySession = async () => {
    if (!activeSession) return;
    const remSeconds = sessionSeconds % 15;
    if (remSeconds > 0) {
      try {
        await progressAPI.postStudyTime(activeSession.course_id, remSeconds);
      } catch (err) {
        console.error(err);
      }
    }
    toast.success(`Session ended. You studied for ${Math.round(sessionSeconds / 60)}m!`);
    setActiveSession(null);
    fetchProgressData();
  };

  const handleUpdateProgressDetails = async (e) => {
    e.preventDefault();
    if (!editingProgress) return;
    try {
      const { id, pct, completed, total } = editingProgress;
      const calculatedPct = total > 0 ? Math.round((completed / total) * 100) : pct;

      await progressAPI.update(id, {
        progress_percent: calculatedPct,
        completion_status: calculatedPct >= 100 ? 'Completed' : 'In Progress'
      });
      toast.success('Course progress updated successfully!');
      setEditingProgress(null);
      fetchProgressData();
    } catch (err) {
      toast.error('Failed to update progress.');
    }
  };

  const handleUploadCertificateSubmit = async (e) => {
    e.preventDefault();
    if (!uploadingCert || !selectedFile) {
      toast.error('Please select a file to upload.');
      return;
    }
    setUploading(true);
    setVerificationResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await progressAPI.uploadCertificate(uploadingCert.id, formData);
      const data = res.data;
      setVerificationResult(data);
      toast.success('Certificate analyzed by AI!');
      fetchProgressData();
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Verification failed.');
    } finally {
      setUploading(false);
    }
  };

  // ─── Filtered Lists ───
  const enrolledCourses = progressList.filter(p => p.completion_status !== 'Completed');
  const completedCourses = progressList.filter(p => p.completion_status === 'Completed');

  // Chart data
  const chartData = completedCourses
    .slice(0, 8)
    .map(p => ({
      name: (p.course_name || 'Course').substring(0, 15) + ((p.course_name || '').length > 15 ? '…' : ''),
      progress: p.progress_percent || 100,
    }));

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12">
      {/* ── Active Session Notification bar ── */}
      {activeSession && (
        <div className="mb-6 flex items-center justify-between px-6 py-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 animate-pulse">
          <div className="flex items-center gap-3 text-white">
            <PlayCircle className="text-purple-400" />
            <div>
              <p className="font-semibold text-sm">Currently studying: {activeSession.course_name}</p>
              <p className="text-xs text-white/50">Session Time: {Math.floor(sessionSeconds / 60)}m {sessionSeconds % 60}s</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeSession.url && (
              <a
                href={activeSession.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary rounded-xl py-1.5 px-3 text-xs flex items-center gap-1"
              >
                Open Resource <ExternalLink size={12} />
              </a>
            )}
            <button
              onClick={stopStudySession}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl py-1.5 px-4 text-xs font-semibold"
            >
              Stop Session
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">My Progress</h1>
          <p className="text-white/50 mt-1 text-sm">Monitor your enrolled courses, learning time, and certificates</p>
        </div>
        <button
          onClick={fetchProgressData}
          disabled={loading}
          className="btn-secondary rounded-xl py-2 px-4 text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 mb-8 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === tab
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab Content: Overview ── */}
      {activeTab === 'Overview' && (
        <div className="flex flex-col gap-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon={<BookOpen size={20} />} label="Enrolled" value={stats?.total_enrolled} colorClass="text-purple-400" />
            <StatCard icon={<TrendingUp size={20} />} label="In Progress" value={stats?.in_progress} colorClass="text-blue-400" />
            <StatCard icon={<CheckCircle2 size={20} />} label="Completed" value={stats?.completed} colorClass="text-emerald-400" />
            <StatCard icon={<Clock size={20} />} label="Learning Time" value={fmtSecondsToHuman(stats?.total_time_spent_seconds)} colorClass="text-yellow-400" />
            <StatCard icon={<Upload size={20} />} label="Uploaded Certs" value={stats?.certificates_uploaded} colorClass="text-indigo-400" />
            <StatCard icon={<Award size={20} />} label="Verified Certs" value={stats?.certificates_verified} colorClass="text-emerald-300" />
          </div>

          {/* Chart & Empty State */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <BarChart2 size={18} className="text-purple-400" />
                <h2 className="text-white font-semibold text-sm">Course Progress Distribution</h2>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="progress" radius={[6, 6, 0, 0]}>
                      {chartData.map((_, idx) => (
                        <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-white/30 text-xs">
                  No completed courses to display chart data.
                </div>
              )}
            </div>

            {/* AI verification info box */}
            <div className="glass-card rounded-2xl p-6 flex flex-col justify-between border border-white/5 bg-gradient-to-br from-purple-900/10 to-indigo-900/10">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-purple-400">
                  <Shield size={18} />
                  <h3 className="font-semibold text-sm text-white">AI Certificate Verification</h3>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">
                  We use AI-driven Vision models to scan uploaded certificate credentials, matches recipient names, 
                  validates date ranges, and updates status automatically to <strong className="text-white">100%</strong>.
                </p>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 text-xs text-white/50 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-white/70">
                    <Sparkles size={11} className="text-yellow-400" />
                    <span>How it works:</span>
                  </div>
                  <div>1. Complete your studies or finish equivalent learning modules.</div>
                  <div>2. Upload a valid completion certificate (PDF/Image).</div>
                  <div>3. The AI engine extracts details and updates your progress stats.</div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('Certificates')}
                className="btn-primary rounded-xl py-2 w-full text-xs font-semibold mt-4"
              >
                Go to Upload Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Content: Enrolled Courses ── */}
      {activeTab === 'Enrolled Courses' && (
        <div>
          {enrolledCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="p-5 rounded-full bg-white/5 border border-white/10">
                <Layers size={40} className="text-white/30" />
              </div>
              <p className="text-white/60 text-lg font-medium">No enrolled courses</p>
              <p className="text-white/35 text-sm">Browse the catalog to enroll in courses and begin learning.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrolledCourses.map(item => {
                const pct = item.progress_percent || 0;
                return (
                  <div key={item.id} className="glass-card rounded-2xl p-6 flex flex-col gap-4 hover:border-white/20 transition-all duration-300">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-white font-bold text-base leading-snug line-clamp-2">
                        {item.course_name}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${getStatusColor(item.completion_status)}`}>
                        {item.completion_status}
                      </span>
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap gap-2 text-xs text-white/50">
                      <span className="bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{item.category}</span>
                      <span className="bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{item.level}</span>
                      {item.provider && <span className="text-white/40">{item.provider}</span>}
                    </div>

                    {/* Progress tracking */}
                    <div className="flex flex-col gap-1.5 my-1">
                      <div className="flex justify-between text-xs text-white/50">
                        <span>Progress</span>
                        <span className="font-semibold text-white/80">{pct}%</span>
                      </div>
                      <ProgressBar pct={pct} />
                    </div>

                    {/* Study stats info */}
                    <div className="bg-white/5 rounded-xl px-4 py-3 border border-white/5 flex justify-between items-center text-xs text-white/50">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        Study time:
                      </span>
                      <span className="font-semibold text-white/80">
                        {item.time_spent_seconds ? fmtSecondsToHuman(item.time_spent_seconds) : '0 minutes'}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-auto pt-2">
                      <button
                        onClick={() => startStudySession(item)}
                        className="flex-1 btn-primary rounded-xl py-2.5 text-xs flex items-center justify-center gap-1.5 font-semibold"
                      >
                        <Play size={12} fill="currentColor" /> Continue Course
                      </button>
                      <button
                        onClick={() => setEditingProgress({
                          id: item.id,
                          course_name: item.course_name,
                          pct: pct,
                          completed: item.completed_lessons || 0,
                          total: item.total_lessons || 10
                        })}
                        className="btn-secondary rounded-xl py-2.5 px-3 text-xs font-semibold border border-white/10"
                        title="Update progress percent"
                      >
                        Adjust
                      </button>
                      <button
                        onClick={() => setUploadingCert({ id: item.id, course_id: item.course_id, course_name: item.course_name })}
                        className="btn-secondary rounded-xl py-2.5 px-3 text-xs font-semibold border border-white/10"
                        title="Upload Certificate"
                      >
                        <Upload size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Completed Courses ── */}
      {activeTab === 'Completed Courses' && (
        <div>
          {completedCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="p-5 rounded-full bg-white/5 border border-white/10">
                <Trophy size={40} className="text-white/30" />
              </div>
              <p className="text-white/60 text-lg font-medium">No completed courses yet</p>
              <p className="text-white/35 text-sm">Finish courses or upload certificates to see them here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedCourses.map(item => (
                <div key={item.id} className="glass-card rounded-2xl p-6 flex flex-col gap-4 border-emerald-500/20 hover:border-emerald-500/30 transition-all duration-300">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-white font-bold text-base leading-snug line-clamp-2">
                      {item.course_name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full border text-xs font-semibold text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                      Completed
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-white/50">
                    <span className="bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{item.category}</span>
                    <span className="bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{item.level}</span>
                    {item.provider && <span className="text-white/40">{item.provider}</span>}
                  </div>

                  {/* Fully complete status bar */}
                  <div className="flex flex-col gap-1.5 my-1">
                    <div className="flex justify-between text-xs text-white/50">
                      <span>Progress</span>
                      <span className="font-semibold text-emerald-400">100% Complete</span>
                    </div>
                    <ProgressBar pct={100} />
                  </div>

                  {/* Complete details */}
                  <div className="bg-white/5 rounded-xl px-4 py-3 border border-white/5 flex flex-col gap-1.5 text-xs text-white/50">
                    <div className="flex justify-between">
                      <span>Study time:</span>
                      <span className="font-semibold text-white/80">{fmtSecondsToHuman(item.time_spent_seconds)}</span>
                    </div>
                    {item.completion_date && (
                      <div className="flex justify-between">
                        <span>Completed:</span>
                        <span className="font-semibold text-white/80">{new Date(item.completion_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {item.certificate_earned && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold bg-emerald-500/5 py-2 px-3 rounded-lg border border-emerald-500/10 mt-auto">
                      <Award size={14} /> Certificate Verified by AI
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Certificates ── */}
      {activeTab === 'Certificates' && (
        <div className="flex flex-col gap-8">
          {/* Certificate list */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Award size={18} className="text-purple-400" />
              <h2 className="text-white font-semibold text-base">Your Uploaded Certificates</h2>
            </div>

            {certificatesList.length === 0 ? (
              <div className="text-center py-12 text-white/40 text-xs">
                No certificates uploaded yet. Use the courses tab to upload certificate credentials.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40 uppercase font-medium">
                      <th className="py-3 px-4">Course</th>
                      <th className="py-3 px-4">Filename</th>
                      <th className="py-3 px-4">AI Verification Status</th>
                      <th className="py-3 px-4">Confidence</th>
                      <th className="py-3 px-4">Extraction Details</th>
                      <th className="py-3 px-4">Uploaded At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificatesList.map(cert => (
                      <tr key={cert.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white max-w-[200px] truncate">{cert.course_name}</td>
                        <td className="py-3.5 px-4 text-white/60">{cert.original_filename}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${getVerificationBadge(cert.verification_status)}`}>
                            {cert.verification_status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-white/80 font-mono">{(cert.verification_confidence * 100).toFixed(0)}%</td>
                        <td className="py-3.5 px-4 text-white/50 max-w-[250px] truncate">
                          {cert.verification_reason || 'AI Analysis pending'}
                        </td>
                        <td className="py-3.5 px-4 text-white/40">
                          {cert.uploaded_at ? new Date(cert.uploaded_at).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Adjust Progress Modal ── */}
      {editingProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 max-w-sm w-full border border-white/10 bg-zinc-900/95 shadow-2xl">
            <h3 className="text-white font-bold text-lg mb-3">Adjust Progress</h3>
            <p className="text-xs text-white/50 mb-5">{editingProgress.course_name}</p>
            <form onSubmit={handleUpdateProgressDetails} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-white/70 font-semibold">Completed Lessons</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max={editingProgress.total}
                    value={editingProgress.completed}
                    onChange={(e) => setEditingProgress(prev => {
                      const completed = parseInt(e.target.value) || 0;
                      return {
                        ...prev,
                        completed,
                        pct: prev.total > 0 ? Math.round((completed / prev.total) * 100) : prev.pct
                      };
                    })}
                    className="flex-1 rounded-xl bg-white/5 border border-white/10 text-white p-2.5 text-sm"
                  />
                  <span className="text-white/40 text-xs">of</span>
                  <input
                    type="number"
                    min="1"
                    value={editingProgress.total}
                    onChange={(e) => setEditingProgress(prev => {
                      const total = parseInt(e.target.value) || 10;
                      return {
                        ...prev,
                        total,
                        pct: total > 0 ? Math.round((prev.completed / total) * 100) : prev.pct
                      };
                    })}
                    className="w-20 rounded-xl bg-white/5 border border-white/10 text-white p-2.5 text-sm"
                  />
                </div>
              </div>

              {/* Percent Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs text-white/70">
                  <span className="font-semibold">Calculated Percentage</span>
                  <span className="font-bold text-purple-400">{editingProgress.pct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editingProgress.pct}
                  onChange={(e) => setEditingProgress(prev => ({ ...prev, pct: parseInt(e.target.value) || 0 }))}
                  className="w-full accent-purple-500"
                />
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setEditingProgress(null)}
                  className="flex-1 btn-secondary rounded-xl py-2.5 text-xs font-semibold border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary rounded-xl py-2.5 text-xs font-semibold"
                >
                  Save Progress
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Certificate Upload Modal ── */}
      {uploadingCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 max-w-md w-full border border-white/10 bg-zinc-900/95 shadow-2xl">
            <h3 className="text-white font-bold text-lg mb-3">AI Verification Upload</h3>
            <p className="text-xs text-white/50 mb-5">{uploadingCert.course_name}</p>
            
            <form onSubmit={handleUploadCertificateSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-white/70 font-semibold">Select Certificate (PDF or Image)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 text-white p-2.5 text-xs"
                />
              </div>

              {verificationResult && (
                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-1 text-purple-400 font-bold">
                    <Sparkles size={12} /> AI Analysis Result:
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="font-semibold text-white">{verificationResult.verification_status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confidence:</span>
                    <span className="font-semibold text-white">{(verificationResult.verification_confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="text-white/50">Reason:</span>
                    <p className="text-white/80 mt-1 leading-relaxed">{verificationResult.verification_reason}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setUploadingCert(null);
                    setSelectedFile(null);
                    setVerificationResult(null);
                  }}
                  className="flex-1 btn-secondary rounded-xl py-2.5 text-xs font-semibold border border-white/10"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="flex-1 btn-primary rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1"
                >
                  {uploading ? (
                    <><Loader2 size={12} className="animate-spin" /> Analyzing...</>
                  ) : (
                    <><Upload size={12} /> Upload & Verify</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
