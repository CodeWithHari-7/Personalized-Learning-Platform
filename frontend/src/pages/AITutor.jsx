import React, { useState, useEffect, useRef } from 'react';
import { chatAPI } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, Loader2, Plus, Trash2, Code2, HelpCircle, BookOpen, Brain, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

const QUICK_PROMPTS = [
  { icon: BookOpen, label: 'Explain Random Forest', prompt: 'Explain Random Forest algorithm with a Python example' },
  { icon: HelpCircle, label: 'Quiz me on ML', prompt: 'Give me 3 multiple choice questions about machine learning basics' },
  { icon: Code2, label: 'Python challenge', prompt: 'Give me a medium difficulty Python coding challenge about data manipulation with pandas' },
  { icon: Brain, label: 'Career advice', prompt: 'What skills should I focus on to become a Data Scientist in 2024?' },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1 rounded text-slate-400 hover:text-white transition-colors">
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-4`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'gradient-bg' : 'bg-indigo-500/20 border border-indigo-500/30'}`}>
        {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-indigo-400" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'chat-user px-4 py-3' : 'chat-ai px-4 py-3'}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              if (!inline && match) {
                return (
                  <div className="relative mt-2">
                    <div className="flex items-center justify-between bg-slate-900/80 px-3 py-1.5 rounded-t-lg border-b border-indigo-500/20">
                      <span className="text-xs text-indigo-400 font-mono">{match[1]}</span>
                      <CopyButton text={String(children)} />
                    </div>
                    <pre className="!mt-0 !rounded-t-none text-sm">
                      <code className={className} {...props}>{children}</code>
                    </pre>
                  </div>
                );
              }
              return <code className="bg-indigo-500/20 px-1 py-0.5 rounded text-indigo-300 text-sm font-mono" {...props}>{children}</code>;
            },
            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-sm">{children}</p>,
            ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2 text-sm">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 text-sm">{children}</ol>,
            h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
            h2: ({ children }) => <h2 className="text-base font-bold text-white mb-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-bold text-slate-200 mb-1">{children}</h3>,
            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          }}
        >
          {msg.content}
        </ReactMarkdown>
        <p className="text-xs text-slate-500 mt-1">
          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ''}
        </p>
      </div>
    </div>
  );
}

export default function AITutor() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(uuidv4());
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadSessions();
    // Add welcome message
    setMessages([{
      role: 'assistant',
      content: "Hi! I'm your AI Tutor specialized in **Data Science and Machine Learning**. I can help you:\n\n- 📚 Explain ML/DS concepts with examples\n- 🐛 Debug your Python code\n- 🎯 Generate quizzes and coding challenges\n- 💼 Guide your Data Science career\n\nWhat would you like to learn today?",
      created_at: new Date().toISOString()
    }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await chatAPI.sessions();
      setSessions(res.data || []);
    } catch {}
    finally { setLoadingSessions(false); }
  };

  const loadSession = async (sid) => {
    try {
      setSessionId(sid);
      const res = await chatAPI.history(sid);
      setMessages(res.data || []);
    } catch {}
  };

  const newSession = () => {
    setSessionId(uuidv4());
    setMessages([{
      role: 'assistant',
      content: "New conversation started! What would you like to learn?",
      created_at: new Date().toISOString()
    }]);
  };

  const deleteSession = async (sid, e) => {
    e.stopPropagation();
    try {
      await chatAPI.deleteSession(sid);
      setSessions(prev => prev.filter(s => s.session_id !== sid));
      if (sessionId === sid) newSession();
    } catch {}
  };

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: msg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await chatAPI.send({ message: msg, session_id: sessionId });
      const aiMsg = { role: 'assistant', content: res.data.message, created_at: new Date().toISOString() };
      setMessages(prev => [...prev, aiMsg]);
      loadSessions();
    } catch (err) {
      toast.error('Failed to get response. Please try again.');
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', created_at: new Date().toISOString() }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Sessions sidebar */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3 hidden lg:flex">
        <button onClick={newSession} className="btn-primary flex items-center gap-2 justify-center py-2.5">
          <Plus size={16} /> New Chat
        </button>
        <div className="glass-card p-3 flex-1 overflow-y-auto">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Chat History</p>
          {loadingSessions ? (
            <div className="flex justify-center py-4"><div className="spinner" /></div>
          ) : sessions.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-4">No previous chats</p>
          ) : (
            <div className="space-y-1">
              {sessions.map(s => (
                <div key={s.session_id}
                  onClick={() => loadSession(s.session_id)}
                  className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${s.session_id === sessionId ? 'bg-indigo-500/20 border border-indigo-500/30' : 'hover:bg-slate-800/50'}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 truncate">{s.preview}</p>
                    <p className="text-xs text-slate-500">{s.message_count} messages</p>
                  </div>
                  <button onClick={(e) => deleteSession(s.session_id, e)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col glass-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-indigo-500/20">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Bot size={20} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">AI Tutor</h2>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-slate-400">Online · Gemini AI</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
          {loading && (
            <div className="flex gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Bot size={16} className="text-indigo-400" />
              </div>
              <div className="chat-ai px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <div className="px-6 pb-3 grid grid-cols-2 gap-2">
            {QUICK_PROMPTS.map((qp, i) => (
              <button key={i} onClick={() => send(qp.prompt)}
                className="flex items-center gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-500/15 transition-all text-left group">
                <qp.icon size={16} className="text-indigo-400 flex-shrink-0" />
                <span className="text-xs text-slate-300 group-hover:text-white">{qp.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-6 py-4 border-t border-indigo-500/20">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask me anything about Data Science or ML... (Enter to send)"
              rows={2}
              className="input-field resize-none flex-1 text-sm"
              disabled={loading}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="btn-primary px-4 py-2 flex-shrink-0 self-end disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-1.5">Shift+Enter for new line · Powered by Gemini AI</p>
        </div>
      </div>
    </div>
  );
}
