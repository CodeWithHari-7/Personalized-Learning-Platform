import React from 'react';
import { Settings as SettingsIcon, Bell, Shield, Palette, Globe } from 'lucide-react';

export default function Settings() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold gradient-text">Settings</h1>

      {/* App Preferences */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-white font-semibold flex items-center gap-2"><Palette size={18} className="text-indigo-400"/>Appearance</h2>
        <div className="flex items-center justify-between py-3 border-b border-slate-700/50">
          <div>
            <p className="text-white text-sm font-medium">Theme</p>
            <p className="text-slate-400 text-xs">Current: Dark (Default)</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium">Dark</button>
            <button className="px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 text-xs">Light</button>
          </div>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-white text-sm font-medium">AI Provider</p>
            <p className="text-slate-400 text-xs">Configure AI Tutor backend</p>
          </div>
          <div className="badge badge-green">Gemini AI</div>
        </div>
      </div>

      {/* Notifications */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-white font-semibold flex items-center gap-2"><Bell size={18} className="text-indigo-400"/>Notifications</h2>
        {[
          { label: 'Course reminders', desc: 'Get reminded about in-progress courses' },
          { label: 'Quiz results', desc: 'Receive scores after quiz submission' },
          { label: 'New recommendations', desc: 'Get notified about new course recommendations' },
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <div>
              <p className="text-white text-sm">{item.label}</p>
              <p className="text-slate-500 text-xs">{item.desc}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-10 h-5 bg-slate-700 peer-checked:bg-indigo-500 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:w-4 after:h-4 after:transition-all peer-checked:after:translate-x-5" />
            </label>
          </div>
        ))}
      </div>

      {/* Security */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-white font-semibold flex items-center gap-2"><Shield size={18} className="text-indigo-400"/>Security</h2>
        <button className="btn-secondary text-sm">Change Password</button>
      </div>

      {/* About */}
      <div className="glass-card p-6">
        <h2 className="text-white font-semibold flex items-center gap-2 mb-3"><Globe size={18} className="text-indigo-400"/>About</h2>
        <div className="space-y-2 text-sm text-slate-400">
          <p>Platform Version: <span className="text-white">1.0.0</span></p>
          <p>ML Model: <span className="text-white">Random Forest v1.0</span></p>
          <p>AI Backend: <span className="text-indigo-300">Google Gemini 2.0 Flash</span></p>
          <p>Database: <span className="text-white">PostgreSQL</span></p>
        </div>
      </div>
    </div>
  );
}
