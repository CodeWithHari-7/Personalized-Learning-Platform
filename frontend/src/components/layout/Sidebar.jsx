import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, BookOpen, Target, TrendingUp, MessageSquare,
  HelpCircle, Code2, Briefcase, User, Settings, LogOut,
  Brain, ChevronRight, Menu, X, Award, Map
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/assessment', icon: Target, label: 'Assessment' },
  { path: '/recommendations', icon: Brain, label: 'Recommendations' },
  { path: '/courses', icon: BookOpen, label: 'Courses' },
  { path: '/learning-path', icon: Map, label: 'Learning Path' },
  { path: '/progress', icon: TrendingUp, label: 'My Progress' },
  { path: '/ai-tutor', icon: MessageSquare, label: 'AI Tutor' },
  { path: '/quiz', icon: HelpCircle, label: 'Quiz Generator' },
  { path: '/coding', icon: Code2, label: 'Coding Challenges' },
  { path: '/career', icon: Briefcase, label: 'Career Path' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function Sidebar({ open, onToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onToggle}
        />
      )}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Logo */}
        <div className="p-6 border-b border-indigo-500/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shadow-lg">
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm leading-tight">LearnAI</h1>
              <p className="text-xs text-indigo-400">DS & ML Platform</p>
            </div>
          </div>
        </div>

        {/* User Mini Profile */}
        {user && (
          <div className="p-4 mx-3 mt-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full gradient-bg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {user.first_name?.[0]}{user.last_name?.[0]}
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-indigo-400 text-xs truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => onToggle && window.innerWidth < 768 && onToggle()}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <item.icon size={20} />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-indigo-500/20 space-y-1">
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={20} />
            <span>Settings</span>
          </NavLink>
          <button
            onClick={handleLogout}
            className="nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
