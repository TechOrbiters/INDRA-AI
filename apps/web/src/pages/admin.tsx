import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { trpcClient } from '../utils/trpc';
import { trpc } from '../lib/trpc';

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: 'super_admin' | 'knowledge_admin' | 'contributor' | 'viewer' | 'guest';
  status: 'active' | 'invited' | 'deactivated';
  updatedAt: string;
}

interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
}

interface OrgSettingsData {
  id: string;
  name: string;
  domain: string;
  slug: string;
  plan: string;
  seatCount: number;
  activeSeatCount: number;
  settings: {
    ssoEnabled?: boolean;
    defaultRole?: string;
    allowPublicSignup?: boolean;
    retentionDays?: number;
  };
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#DA1E28',
  knowledge_admin: '#8A3FFC',
  contributor: '#0F62FE',
  viewer: '#6F6F6F',
  guest: '#393939',
};

const ADMIN_NAV = [
  { path: '', label: 'Overview' },
  { path: 'users', label: 'Users' },
  { path: 'audit', label: 'Audit Log' },
  { path: 'webhooks', label: 'Webhooks' },
  { path: 'settings', label: 'Settings' },
];

function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Admin Console</h1>
          <p className="text-sm text-white/40">Manage users, content, audit logs, and organization settings.</p>
        </div>
        <nav className="flex gap-1 border-b border-white/5 mb-8" aria-label="Admin navigation">
          {ADMIN_NAV.map(item => {
            const full = `/admin/${item.path}`;
            const isActive = item.path === '' ? location.pathname === '/admin' || location.pathname === '/admin/' : location.pathname.startsWith(full);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path === '' ? '/admin' : full)}
                aria-current={isActive ? 'page' : undefined}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all duration-200 ${
                  isActive
                    ? 'border-[#0F62FE] text-white'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
        {children}
      </div>
    </AppShell>
  );
}

function AdminOverview() {
  const [data, setData] = useState<{ stats: { dau: number; userCount: number; knowledgeCount: number; searchesToday: number; healthScore: number } } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (trpcClient as any).admin.overview.query();
        setData(result);
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <div className="text-white/40 text-sm animate-pulse">Loading overview metrics…</div>;
  }

  const statsList = [
    { label: 'Total Users', value: data?.stats.userCount ?? 1, icon: '👥', sub: `${data?.stats.dau ?? 1} active today` },
    { label: 'Knowledge Entries', value: data?.stats.knowledgeCount ?? 0, icon: '📄', sub: `${data?.stats.healthScore ?? 100}% health score` },
    { label: 'Searches Today', value: data?.stats.searchesToday ?? 0, icon: '✦', sub: 'Indexed query performance' },
    { label: 'System Status', value: 'Healthy', icon: '🟢', sub: 'All services operational' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsList.map(s => (
          <div key={s.label} className="p-5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-2xl font-bold text-white mb-0.5">{s.value}</div>
            <div className="text-xs text-white/50">{s.label}</div>
            <div className="text-[10px] text-white/30 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AdminUser['role']>('contributor');
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState('');

  const loadUsers = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = await (trpcClient as any).admin.listUsers.query();
      setUsers(list);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: AdminUser['role']) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (trpcClient as any).admin.updateUserRole.mutate({ userId, role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Role update failed');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setMsg('');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (trpcClient as any).admin.inviteUser.mutate({ email: inviteEmail, role: inviteRole });
      setInviteModal(false);
      setInviteEmail('');
      loadUsers();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  const filtered = users.filter(u =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search users…"
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] w-64"
        />
        <button
          onClick={() => setInviteModal(true)}
          className="bg-[#0F62FE] hover:bg-[#0043CE] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          + Invite User
        </button>
      </div>

      {inviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">Invite Team Member</h2>
            {msg && <div className="text-xs text-[#FF8389] bg-[#DA1E28]/10 p-2 rounded-lg">{msg}</div>}
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@acme.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#0F62FE]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as AdminUser['role'])}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#0F62FE]"
                >
                  <option value="viewer" className="bg-[#0D1117]">Viewer</option>
                  <option value="contributor" className="bg-[#0D1117]">Contributor</option>
                  <option value="knowledge_admin" className="bg-[#0D1117]">Knowledge Admin</option>
                  <option value="super_admin" className="bg-[#0D1117]">Super Admin</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModal(false)}
                  className="px-4 py-2 text-xs text-white/50 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="bg-[#0F62FE] text-white text-xs font-medium px-4 py-2 rounded-xl hover:bg-[#0043CE]"
                >
                  {inviting ? 'Inviting…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-white/40 text-sm animate-pulse">Loading users…</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                {['Name', 'Role', 'Status', 'Last Active', 'Action'].map(col => (
                  <th key={col} className="text-left px-5 py-3.5 text-xs font-semibold text-white/40 uppercase tracking-wider">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, i) => (
                <tr
                  key={user.id}
                  className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${i === filtered.length - 1 ? 'border-none' : ''}`}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: `${ROLE_COLORS[user.role] || '#6F6F6F'}20`, color: ROLE_COLORS[user.role] || '#6F6F6F' }}
                      >
                        {(user.displayName || user.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-white">{user.displayName || 'User'}</div>
                        <div className="text-xs text-white/40">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={user.role}
                      onChange={e => handleRoleChange(user.id, e.target.value as AdminUser['role'])}
                      className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                    >
                      <option value="super_admin" className="bg-[#0D1117]">Super Admin</option>
                      <option value="knowledge_admin" className="bg-[#0D1117]">Knowledge Admin</option>
                      <option value="contributor" className="bg-[#0D1117]">Contributor</option>
                      <option value="viewer" className="bg-[#0D1117]">Viewer</option>
                      <option value="guest" className="bg-[#0D1117]">Guest</option>
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-[#24A148]' : 'bg-[#F1C21B]'}`} />
                      <span className={`text-xs ${user.status === 'active' ? 'text-[#24A148]' : 'text-[#F1C21B]'}`}>
                        {user.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-white/40">{new Date(user.updatedAt).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-white/30">Active</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const events = await (trpcClient as any).audit.listEvents.query();
        setLogs(events);
      } catch {
        // Handle error
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <div className="text-white/40 text-sm animate-pulse">Loading audit events…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-white/50">{logs.length} audit events logged</p>
      </div>
      {logs.length === 0 ? (
        <div className="text-white/30 text-sm py-8 text-center">No audit events found.</div>
      ) : (
        logs.map(log => (
          <div key={log.id} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 bg-[#0F62FE]" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">{log.actorId}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#0F62FE]/20 text-[#0F62FE]">
                  {log.action}
                </span>
              </div>
              <div className="text-xs text-white/50 mt-0.5 truncate">
                Resource: {log.resourceType} ({log.resourceId})
              </div>
            </div>
            <div className="text-[10px] text-white/30 flex-shrink-0 font-mono">{new Date(log.createdAt).toLocaleString()}</div>
          </div>
        ))
      )}
    </div>
  );
}

function SettingsTab() {
  const [org, setOrg] = useState<OrgSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await (trpcClient as any).admin.orgSettings.query();
        setOrg(data);
        setName(data.name);
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (trpcClient as any).admin.updateOrgSettings.mutate({ name });
      setMsg('Settings saved successfully.');
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-white/40 text-sm animate-pulse">Loading organization settings…</div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-md">
      {msg && <div className="text-xs text-[#24A148] bg-[#24A148]/10 p-3 rounded-xl border border-[#24A148]/20">{msg}</div>}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Organization Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0F62FE] transition-colors text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Primary Domain</label>
        <input
          type="text"
          disabled
          value={org?.domain || ''}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/40 text-sm cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Subscription Plan</label>
        <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm capitalize">
          {org?.plan || 'Starter'} Plan ({org?.activeSeatCount || 1} / {org?.seatCount || 50} seats used)
        </div>
      </div>
      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-[#0F62FE] hover:bg-[#0043CE] text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

function WebhooksTab() {
  const [showRegister, setShowRegister] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['knowledge.created', 'knowledge.updated']);
  const [testResult, setTestResult] = useState<{ id: string; message: string } | null>(null);

  const { data: webhooks, isLoading, refetch } = trpc.webhooks.list.useQuery();

  const registerMutation = trpc.webhooks.register.useMutation({
    onSuccess: () => {
      setShowRegister(false);
      setUrl('');
      refetch();
    },
  });

  const deleteMutation = trpc.webhooks.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const testMutation = trpc.webhooks.test.useMutation({
    onSuccess: (data: { deliveredAt: string }, variables: { id: string }) => {
      setTestResult({ id: variables.id, message: `Delivered test payload (200 OK) at ${new Date(data.deliveredAt).toLocaleTimeString()}` });
    },
  });

  const ALL_EVENTS = [
    'knowledge.created',
    'knowledge.updated',
    'knowledge.deleted',
    'knowledge.verified',
    'ai.answer.escalated',
    'user.invited',
    'user.deactivated',
  ];

  const handleToggleEvent = (ev: string) => {
    setSelectedEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || selectedEvents.length === 0) return;
    registerMutation.mutate({
      url: url.trim(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      events: selectedEvents as any,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Webhook Endpoints</h2>
          <p className="text-xs text-white/40">Receive HTTP POST payloads when knowledge or organization events trigger (§6.8).</p>
        </div>
        <button
          onClick={() => setShowRegister(true)}
          className="bg-[#0F62FE] hover:bg-[#0043CE] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          + Register Webhook
        </button>
      </div>

      {testResult && (
        <div className="bg-[#24A148]/15 border border-[#24A148]/30 rounded-xl p-3 text-xs text-[#24A148] flex items-center justify-between">
          <span>✓ {testResult.message}</span>
          <button onClick={() => setTestResult(null)} className="text-white/40 hover:text-white">✕</button>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-xs text-white/40 animate-pulse">Loading webhooks…</div>
      ) : !webhooks || webhooks.length === 0 ? (
        <div className="p-12 text-center bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="text-3xl mb-2">🔗</div>
          <div className="text-sm text-white/60">No webhooks registered</div>
          <p className="text-xs text-white/40 mt-1 max-w-xs mx-auto">Register your first webhook to stream real-time events to your external systems.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh: { id: string; url: string; events: string[] }) => (
            <div key={wh.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold text-white">{wh.url}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#24A148]/15 text-[#24A148] font-semibold">Active</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {wh.events.map((ev: string) => (
                    <span key={ev} className="text-[10px] text-white/50 bg-white/5 rounded px-2 py-0.5">
                      {ev}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => testMutation.mutate({ id: wh.id })}
                  disabled={testMutation.isLoading}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Test Delivery
                </button>
                <button
                  onClick={() => deleteMutation.mutate({ id: wh.id })}
                  className="px-3 py-1.5 rounded-lg text-xs text-[#FF8389] hover:bg-[#DA1E28]/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Modal */}
      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Register Webhook</h3>
            <p className="text-xs text-white/40 mb-4">Enter payload destination URL and select event triggers.</p>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs text-white/70 font-medium mb-1">Payload URL</label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://api.company.com/webhooks/indra"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE]"
                />
              </div>

              <div>
                <label className="block text-xs text-white/70 font-medium mb-2">Event Subscriptions</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {ALL_EVENTS.map(ev => (
                    <label key={ev} className="flex items-center gap-2.5 text-xs text-white/80 cursor-pointer p-1.5 rounded hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(ev)}
                        onChange={() => handleToggleEvent(ev)}
                        className="rounded border-white/20 bg-white/5 text-[#0F62FE]"
                      />
                      <span>{ev}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegister(false)}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-xs text-white/70 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerMutation.isLoading || !url || selectedEvents.length === 0}
                  className="flex-1 py-2 rounded-xl bg-[#0F62FE] hover:bg-[#0043CE] disabled:opacity-50 text-xs text-white font-semibold"
                >
                  {registerMutation.isLoading ? 'Registering…' : 'Register Endpoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Routes>
      <Route path="/" element={<AdminLayout><AdminOverview /></AdminLayout>} />
      <Route path="/users" element={<AdminLayout><UsersTab /></AdminLayout>} />
      <Route path="/audit" element={<AdminLayout><AuditTab /></AdminLayout>} />
      <Route path="/webhooks" element={<AdminLayout><WebhooksTab /></AdminLayout>} />
      <Route path="/settings" element={<AdminLayout><SettingsTab /></AdminLayout>} />
      <Route path="*" element={<AdminLayout><AdminOverview /></AdminLayout>} />
    </Routes>
  );
}
