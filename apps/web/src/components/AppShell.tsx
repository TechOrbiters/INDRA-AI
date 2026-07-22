import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, X, CheckCheck } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  icon: string;
  label: string;
  to: string;
  match?: string;
}

const NAV: NavItem[] = [
  { icon: '⊞', label: 'Dashboard', to: '/dashboard' },
  { icon: '🔍', label: 'Search', to: '/search' },
  { icon: '📁', label: 'Collections', to: '/collections' },
  { icon: '🎯', label: 'Experts', to: '/experts' },
  { icon: '💚', label: 'Health', to: '/knowledge/health' },
  { icon: '⚡', label: 'Meetings', to: '/meetings' },
  { icon: '📚', label: 'Knowledge', to: '/knowledge/create', match: '/knowledge' },
  { icon: '🕸', label: 'Graph', to: '/graph' },
  { icon: '⚙', label: 'Admin', to: '/admin', match: '/admin' },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const { data: notifications, refetch: refetchNotifs } = trpc.notifications.list.useQuery(
    undefined,
    { refetchInterval: 30_000 } // poll every 30s
  );

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => refetchNotifs(),
  });

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetchNotifs(),
  });

  const unreadCount = (notifications ?? []).filter((n: { read: boolean }) => !n.read).length;

  // Close notification panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = (item: NavItem) => {
    const path = item.match ?? item.to;
    return location.pathname.startsWith(path);
  };

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.displayName || 'User';
  const displayInitial = displayName.charAt(0).toUpperCase();
  const displayEmail = user?.email || '';

  const NOTIF_TYPE_ICONS: Record<string, string> = {
    knowledge_review_requested: '📝',
    knowledge_mentioned: '💬',
    knowledge_expired: '⏰',
    expert_match: '🧑‍💼',
    integration_error: '⚠️',
    invite_accepted: '✅',
    ai_answer_escalation: '🤖',
  };

  return (
    <div className="min-h-screen bg-[#080B14] text-white flex">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-60 bg-[#0D1117] border-r border-white/5 z-40 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation sidebar"
      >
        {/* Logo */}
        <div className="p-5 border-b border-white/5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">I</span>
          </div>
          <span className="font-bold text-base tracking-tight">
            INDRA <span className="text-[#8A3FFC]">AI</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => (
            <button
              key={item.to}
              onClick={() => { navigate(item.to); setSidebarOpen(false); }}
              aria-current={isActive(item) ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive(item)
                  ? 'bg-[#0F62FE]/15 text-white border border-[#0F62FE]/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-3 p-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC] flex items-center justify-center text-xs font-bold flex-shrink-0">
              {displayInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{displayName}</div>
              <div className="text-[10px] text-white/40 truncate">{displayEmail}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full text-left text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 h-14 border-b border-white/5 bg-[#080B14]/80 backdrop-blur-md">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 text-white/70 hover:text-white transition-colors"
          >
            ☰
          </button>

          {/* Brand (mobile) */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC] flex items-center justify-center">
              <span className="text-white font-bold text-xs">I</span>
            </div>
            <span className="font-bold text-sm text-white">INDRA AI</span>
          </div>

          {/* Right: notification bell */}
          <div className="relative ml-auto" ref={notifRef}>
            <button
              id="notification-bell"
              aria-label={`Notifications — ${unreadCount} unread`}
              onClick={() => setNotifOpen(prev => !prev)}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white/60 hover:text-white"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification dropdown */}
            {notifOpen && (
              <div className="absolute right-0 top-11 w-80 bg-[#0D1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <h4 className="text-sm font-semibold text-white">Notifications</h4>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllReadMutation.mutate()}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                      >
                        <CheckCheck className="w-3 h-3" /> Mark all read
                      </button>
                    )}
                    <button onClick={() => setNotifOpen(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {!notifications || notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Bell className="w-8 h-8 text-gray-600" />
                      <p className="text-sm text-gray-500">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((notif: {
                      id: string;
                      type: string;
                      title: string;
                      body: string;
                      read: boolean;
                      resourceUrl?: string | null;
                      createdAt: string | Date;
                    }) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          if (!notif.read) markReadMutation.mutate({ id: notif.id });
                          if (notif.resourceUrl) navigate(notif.resourceUrl);
                          setNotifOpen(false);
                        }}
                        className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5 ${
                          !notif.read ? 'bg-indigo-500/5' : ''
                        }`}
                      >
                        <span className="text-xl flex-shrink-0 mt-0.5">
                          {NOTIF_TYPE_ICONS[notif.type] || '📩'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${notif.read ? 'text-gray-300' : 'text-white'}`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
                          <p className="text-[10px] text-gray-600 mt-1">
                            {new Date(notif.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
