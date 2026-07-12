import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { 
  Menu, Bell, Search, User, Activity, Book, Code, 
  HelpCircle, Award, Star, BarChart, Settings, LogOut,
  Check, Trash2, ShieldAlert, Sparkles, Trophy, BookOpen, Clock, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificationsAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  
  const profileRef = useRef(null);
  const notificationsRef = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const data = await notificationsAPI.list();
      setNotifications(data || []);
    } catch (err) {
      console.error("Error loading notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 15 seconds for new notifications
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  // Handle click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    if (logout) logout();
    else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    navigate('/login');
  };

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationsAPI.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      toast.success('Notification marked as read');
    } catch (err) {
      toast.error('Failed to update notification');
    }
  };

  const handleDeleteNotification = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationsAPI.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification deleted');
    } catch (err) {
      toast.error('Failed to delete notification');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to update notifications');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'course_completed':
      case 'certificate_verified':
        return <Trophy size={14} className="text-emerald-400" />;
      case 'course_enrolled':
        return <BookOpen size={14} className="text-blue-400" />;
      case 'progress_milestone':
        return <Clock size={14} className="text-yellow-400" />;
      case 'challenge_evaluated':
        return <Code size={14} className="text-purple-400" />;
      case 'certificate_rejected':
        return <AlertTriangle size={14} className="text-red-400" />;
      default:
        return <Bell size={14} className="text-indigo-400" />;
    }
  };

  const getActionLink = (type, entityId) => {
    switch (type) {
      case 'course_enrolled':
      case 'progress_milestone':
      case 'course_completed':
      case 'certificate_verified':
      case 'certificate_rejected':
      case 'certificate_review':
        return '/progress';
      case 'challenge_evaluated':
        return '/coding';
      case 'quiz_submitted':
        return '/quiz';
      default:
        return null;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const PROFILE_MENU = [
    { label: 'Profile Information', icon: User, path: '/settings' },
    { label: 'My Progress', icon: Activity, path: '/progress' },
    { label: 'My Courses', icon: Book, path: '/courses' },
    { label: 'Coding History', icon: Code, path: '/coding' },
    { label: 'Quiz History', icon: HelpCircle, path: '/quiz' },
    { label: 'Certificates', icon: Award, path: '/progress' },
    { label: 'Achievements', icon: Star, path: '/dashboard' },
    { label: 'Learning Statistics', icon: BarChart, path: '/dashboard' },
    { label: 'Account Settings', icon: Settings, path: '/settings' },
  ];

  return (
    <div className="flex min-h-screen bg-surface-900">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="main-content flex-1 flex flex-col">
        {/* Top navbar */}
        <header className="sticky top-0 z-30 border-b border-indigo-500/10 bg-surface-900/80 backdrop-blur-xl">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-indigo-500/10 text-slate-400"
            >
              <Menu size={20} />
            </button>

            <div className="hidden md:flex items-center gap-2 bg-surface-800/60 border border-indigo-500/20 rounded-xl px-4 py-2 w-72">
              <Search size={16} className="text-slate-500" />
              <input
                type="text"
                placeholder="Search courses, topics..."
                className="bg-transparent text-sm text-slate-300 outline-none w-full placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-4 ml-auto">
              
              {/* Notification Bell Dropdown */}
              <div className="relative" ref={notificationsRef}>
                <button 
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2 rounded-xl hover:bg-indigo-500/10 text-slate-400 relative"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold px-1">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-3 w-80 glass-card border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 flex flex-col max-h-[400px]">
                    <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">Notifications</span>
                      {unreadCount > 0 && (
                        <button 
                          onClick={handleMarkAllRead}
                          className="text-[11px] text-purple-400 hover:text-purple-300 font-medium transition-colors"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/5">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-white/40">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map(notif => {
                          const actionPath = getActionLink(notif.type, notif.related_entity_id);
                          const NotifWrapper = actionPath ? Link : 'div';
                          const wrapperProps = actionPath ? { to: actionPath, onClick: () => setNotificationsOpen(false) } : {};

                          return (
                            <div 
                              key={notif.id}
                              className={`p-3 text-xs flex gap-2.5 hover:bg-white/5 transition-colors relative group ${
                                !notif.is_read ? 'bg-purple-500/5' : ''
                              }`}
                            >
                              <div className="p-1.5 rounded-lg bg-white/5 h-fit shrink-0 mt-0.5">
                                {getNotificationIcon(notif.type)}
                              </div>
                              
                              <NotifWrapper {...wrapperProps} className="flex-1 pr-12 cursor-pointer">
                                <p className="font-semibold text-white leading-tight">{notif.title}</p>
                                <p className="text-white/60 mt-0.5 leading-normal">{notif.message}</p>
                                <span className="text-[10px] text-white/30 block mt-1.5">
                                  {new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </NotifWrapper>

                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!notif.is_read && (
                                  <button
                                    onClick={(e) => handleMarkRead(notif.id, e)}
                                    className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                    title="Mark as read"
                                  >
                                    <Check size={11} />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => handleDeleteNotification(notif.id, e)}
                                  className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                  title="Delete"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="relative" ref={profileRef}>
                <div 
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-bold text-sm cursor-pointer hover:ring-2 hover:ring-indigo-500/50 transition-all shadow-lg"
                >
                  {user?.first_name?.[0] || 'U'}{user?.last_name?.[0] || ''}
                </div>

                {profileOpen && (
                  <div className="absolute right-0 mt-3 w-64 glass-card border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-3 border-b border-white/5 mb-1">
                      <p className="text-sm font-semibold text-white">{user?.first_name} {user?.last_name}</p>
                      <p className="text-xs text-white/50 truncate">{user?.email}</p>
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      {PROFILE_MENU.map((item, idx) => {
                        const Icon = item.icon;
                        return (
                          <Link 
                            key={idx} 
                            to={item.path}
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <Icon size={16} className="text-indigo-400" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>

                    <div className="border-t border-white/5 mt-1 pt-1">
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut size={16} />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
