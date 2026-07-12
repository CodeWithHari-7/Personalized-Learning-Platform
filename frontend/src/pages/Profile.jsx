import React, { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { User, Save, Loader2, Camera, Award, BookOpen, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const DEPARTMENTS = ['Computer Science', 'Data Science', 'Information Technology', 'Statistics', 'Business Analytics', 'Electrical Engineering', 'Other'];
const COUNTRIES = ['India', 'USA', 'Canada', 'Germany', 'Australia', 'UK', 'Singapore', 'Other'];
const CAREERS = ['Data Scientist', 'ML Engineer', 'Data Engineer', 'AI Engineer', 'Data Analyst', 'Business Analyst', 'Research Scientist', 'MLOps Engineer'];

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    first_name: '', last_name: '', age: '', gender: '', country: '', city: '',
    university: '', department: '', semester: '', cgpa: '', career_goal: '', bio: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setForm({ ...form, ...user, age: user.age || '', semester: user.semester || '', cgpa: user.cgpa || '' });
  }, [user]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        age: form.age ? parseInt(form.age) : undefined,
        gender: form.gender || undefined,
        country: form.country || undefined,
        city: form.city || undefined,
        university: form.university || undefined,
        department: form.department || undefined,
        semester: form.semester ? parseInt(form.semester) : undefined,
        cgpa: form.cgpa ? parseFloat(form.cgpa) : undefined,
        career_goal: form.career_goal || undefined,
        bio: form.bio || undefined,
      };
      const res = await usersAPI.updateProfile(payload);
      updateUser(res.data);
      toast.success('Profile updated successfully!');
    } catch { toast.error('Failed to update profile'); }
    finally { setSaving(false); }
  };

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold gradient-text">Profile Settings</h1>

      {/* Avatar section */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center text-white font-black text-2xl">
              {form.first_name?.[0]}{form.last_name?.[0]}
            </div>
            <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-lg hover:bg-indigo-600 transition-colors">
              <Camera size={14} />
            </button>
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">{form.first_name} {form.last_name}</h2>
            <p className="text-slate-400 text-sm">{user?.email}</p>
            <p className="text-indigo-400 text-sm mt-1">@{user?.username}</p>
          </div>
        </div>
      </div>

      <form onSubmit={save} className="space-y-6">
        {/* Personal Info */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><User size={18} className="text-indigo-400"/>Personal Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-slate-300 mb-1.5">First Name</label>
              <input className="input-field" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
            <div><label className="block text-sm text-slate-300 mb-1.5">Last Name</label>
              <input className="input-field" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
            <div><label className="block text-sm text-slate-300 mb-1.5">Age</label>
              <input type="number" className="input-field" value={form.age} onChange={e => f('age', e.target.value)} min={16} max={80} /></div>
            <div><label className="block text-sm text-slate-300 mb-1.5">Gender</label>
              <select className="input-field" value={form.gender || ''} onChange={e => f('gender', e.target.value)}>
                <option value="">Select...</option>
                <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select></div>
            <div><label className="block text-sm text-slate-300 mb-1.5">Country</label>
              <select className="input-field" value={form.country || ''} onChange={e => f('country', e.target.value)}>
                <option value="">Select...</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div><label className="block text-sm text-slate-300 mb-1.5">City</label>
              <input className="input-field" value={form.city || ''} onChange={e => f('city', e.target.value)} placeholder="e.g., Bangalore" /></div>
          </div>
          <div><label className="block text-sm text-slate-300 mb-1.5">Bio</label>
            <textarea className="input-field" rows={3} value={form.bio || ''} onChange={e => f('bio', e.target.value)}
              placeholder="Tell us about yourself..." /></div>
        </div>

        {/* Academic Info */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><BookOpen size={18} className="text-indigo-400"/>Academic Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-slate-300 mb-1.5">University</label>
              <input className="input-field" value={form.university || ''} onChange={e => f('university', e.target.value)} placeholder="Your university" /></div>
            <div><label className="block text-sm text-slate-300 mb-1.5">Department</label>
              <select className="input-field" value={form.department || ''} onChange={e => f('department', e.target.value)}>
                <option value="">Select...</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select></div>
            <div><label className="block text-sm text-slate-300 mb-1.5">Semester</label>
              <input type="number" className="input-field" value={form.semester} onChange={e => f('semester', e.target.value)} min={1} max={12} /></div>
            <div><label className="block text-sm text-slate-300 mb-1.5">CGPA (out of 10)</label>
              <input type="number" className="input-field" value={form.cgpa} onChange={e => f('cgpa', e.target.value)} step={0.01} min={0} max={10} /></div>
          </div>
        </div>

        {/* Career Goals */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><Award size={18} className="text-indigo-400"/>Career Goal</h3>
          <div className="flex flex-wrap gap-2">
            {CAREERS.map(c => (
              <button key={c} type="button" onClick={() => f('career_goal', c)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${form.career_goal === c ? 'gradient-bg text-white' : 'bg-slate-800/70 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-300'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 px-8 py-3">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
