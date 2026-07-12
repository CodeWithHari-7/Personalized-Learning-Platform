import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Brain, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const DEPARTMENTS = ['Computer Science', 'Data Science', 'Information Technology', 'Statistics', 'Business Analytics', 'Electrical Engineering', 'Other'];
const COUNTRIES = ['India', 'USA', 'Canada', 'Germany', 'Australia', 'UK', 'Singapore', 'Other'];

export default function Register() {
  const [form, setForm] = useState({
    email: '', username: '', password: '', confirm_password: '',
    first_name: '', last_name: '', age: '', gender: '',
    country: '', department: ''
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const pwdStrength = () => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        email: form.email,
        username: form.username,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        age: form.age ? parseInt(form.age) : undefined,
        gender: form.gender || undefined,
        country: form.country || undefined,
        department: form.department || undefined,
      };
      await register(payload);
      toast.success('Account created! Welcome aboard!');
      navigate('/assessment');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const strength = pwdStrength();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-purple-600/20 blur-3xl" />
      </div>

      <div className="w-full max-w-xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center shadow-2xl pulse-glow mb-4">
            <Brain size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-slate-400 mt-1 text-sm">Start your personalized learning journey</p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">First Name *</label>
                <input type="text" className="input-field" placeholder="John" value={form.first_name}
                  onChange={e => f('first_name', e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Last Name *</label>
                <input type="text" className="input-field" placeholder="Doe" value={form.last_name}
                  onChange={e => f('last_name', e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label>
              <input type="email" className="input-field" placeholder="you@example.com" value={form.email}
                onChange={e => f('email', e.target.value)} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Username *</label>
              <input type="text" className="input-field" placeholder="john_doe" value={form.username}
                onChange={e => f('username', e.target.value)} required minLength={3} maxLength={50}
                pattern="[a-zA-Z0-9_]+" title="Letters, numbers, underscores only" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password *</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} className="input-field pr-11"
                    placeholder="••••••••" value={form.password}
                    onChange={e => f('password', e.target.value)} required minLength={8} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex gap-1 flex-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? strengthColor[strength] : 'bg-slate-700'}`} />
                      ))}
                    </div>
                    <span className="text-xs text-slate-400">{strengthLabel[strength]}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password *</label>
                <div className="relative">
                  <input type="password" className="input-field pr-11"
                    placeholder="••••••••" value={form.confirm_password}
                    onChange={e => f('confirm_password', e.target.value)} required />
                  {form.confirm_password && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {form.password === form.confirm_password
                        ? <CheckCircle2 size={16} className="text-green-400" />
                        : <AlertCircle size={16} className="text-red-400" />}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Age</label>
                <input type="number" className="input-field" placeholder="22" value={form.age}
                  onChange={e => f('age', e.target.value)} min={16} max={80} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Gender</label>
                <select className="input-field" value={form.gender} onChange={e => f('gender', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Country</label>
                <select className="input-field" value={form.country} onChange={e => f('country', e.target.value)}>
                  <option value="">Select...</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Department</label>
                <select className="input-field" value={form.department} onChange={e => f('department', e.target.value)}>
                  <option value="">Select...</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
