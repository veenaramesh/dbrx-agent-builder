import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Search, Wrench, Database, CircleDot, Plus, Trash2, Loader2, X } from 'lucide-react';
import { NODE_COLORS } from '../constants';
import {
  listAgents, createAgent, deleteAgent, backendAvailable,
  RegistryAgent, AgentStatus, ToolRef, ToolKind, AgentInput,
} from '../api/registry';

// ── Agent Brick Builder logo (mirrors the editor header) ─────────────────────
const AgentBuilderLogo = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="8" width="18" height="12" rx="3" stroke="#FF3621" strokeWidth="2" fill="none" />
    <path d="M8 8V6a4 4 0 0 1 8 0v2" stroke="#FF3621" strokeWidth="2" strokeLinecap="round" />
    <circle cx="9" cy="14" r="1.5" fill="#FF3621" />
    <circle cx="15" cy="14" r="1.5" fill="#FF3621" />
    <path d="M9 17.5c0 0 1 1.5 3 1.5s3-1.5 3-1.5" stroke="#FF3621" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ── Sample data (fallback when no backend is reachable) ───────────────────────
const nowIso = '2026-07-16T00:00:00Z';
const SAMPLE_AGENTS: RegistryAgent[] = [
  {
    id: 'sample-1', name: 'support_copilot', endpoint: 'support-copilot', app_url: '',
    model: 'databricks-meta-llama-3-3-70b-instruct', workspace: 'field-eng.cloud.databricks.com',
    registered_at: nowIso, updated_at: nowIso, status: 'ready', requests_24h: 4820,
    tools: [
      { kind: 'uc_function', label: 'search_knowledge_base', detail: 'main.tools' },
      { kind: 'uc_function', label: 'get_user_profile', detail: 'main.tools' },
      { kind: 'vector_search', label: 'Product Docs Index', detail: 'main.rag.product_docs_index' },
      { kind: 'lakebase', label: 'conversation_memory', detail: 'support-lakebase' },
    ],
  },
  {
    id: 'sample-2', name: 'sales_researcher', endpoint: 'sales-researcher', app_url: '',
    model: 'databricks-claude-3-7-sonnet', workspace: 'field-eng.cloud.databricks.com',
    registered_at: nowIso, updated_at: nowIso, status: 'ready', requests_24h: 1290,
    tools: [
      { kind: 'uc_function', label: 'search_knowledge_base', detail: 'main.tools' },
      { kind: 'vector_search', label: 'Account Notes Index', detail: 'main.rag.account_notes_index' },
    ],
  },
  {
    id: 'sample-3', name: 'sql_analyst', endpoint: 'sql-analyst', app_url: '',
    model: 'databricks-meta-llama-3-1-405b-instruct', workspace: 'field-eng.cloud.databricks.com',
    registered_at: nowIso, updated_at: nowIso, status: 'updating', requests_24h: 640,
    tools: [
      { kind: 'uc_function', label: 'run_sql_query', detail: 'main.analytics' },
      { kind: 'lakebase', label: 'orders_db', detail: 'analytics-lakebase' },
    ],
  },
  {
    id: 'sample-4', name: 'onboarding_bot', endpoint: 'onboarding-bot', app_url: '',
    model: 'databricks-meta-llama-3-3-70b-instruct', workspace: 'field-eng.cloud.databricks.com',
    registered_at: nowIso, updated_at: nowIso, status: 'failed', requests_24h: 0,
    tools: [{ kind: 'uc_function', label: 'create_ticket', detail: 'main.tools' }],
  },
];

// ── Presentational helpers ────────────────────────────────────────────────────
const STATUS_META: Record<AgentStatus, { label: string; color: string; dot: string }> = {
  unknown:  { label: 'Unknown',  color: '#475569', dot: '#94a3b8' },
  ready:    { label: 'Ready',    color: '#166534', dot: '#22c55e' },
  updating: { label: 'Updating', color: '#92400e', dot: '#f59e0b' },
  failed:   { label: 'Failed',   color: '#991b1b', dot: '#ef4444' },
};

const TOOL_META: Record<ToolKind, { icon: React.ReactNode; color: string; label: string }> = {
  uc_function:   { icon: <Wrench size={11} />,  color: NODE_COLORS.uc_function.borderColor,   label: 'UC Function' },
  vector_search: { icon: <Search size={11} />,  color: NODE_COLORS.vector_search.borderColor, label: 'Vector Search' },
  lakebase:      { icon: <Database size={11} />, color: NODE_COLORS.lakebase.borderColor,      label: 'Lakebase' },
};

const StatusBadge = ({ status }: { status: AgentStatus }) => {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ backgroundColor: `${m.dot}1a`, color: m.color }}>
      <CircleDot size={9} style={{ color: m.dot }} />
      {m.label}
    </span>
  );
};

const ToolChip = ({ tool }: { tool: ToolRef }) => {
  const m = TOOL_META[tool.kind];
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px]"
      style={{ backgroundColor: `${m.color}12`, borderColor: `${m.color}33`, color: m.color }}
      title={`${m.label} · ${tool.detail}`}>
      {m.icon}
      <span className="font-medium">{tool.label}</span>
    </div>
  );
};

const AgentCard = ({ agent, onDelete, canDelete }: {
  agent: RegistryAgent; onDelete: (id: string) => void; canDelete: boolean;
}) => {
  const llm = NODE_COLORS.llm.borderColor;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col group">
      <div className="flex items-start gap-3 p-4 border-b border-slate-100">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${llm}15` }}>
          <Cpu size={18} color={llm} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-bold text-slate-800 truncate" title={agent.name}>{agent.name}</h3>
            <StatusBadge status={agent.status} />
          </div>
          <p className="text-[11px] text-slate-400 font-mono truncate" title={agent.model}>
            {agent.model ? agent.model.replace('databricks-', '') : '—'}
          </p>
        </div>
        {canDelete && (
          <button onClick={() => onDelete(agent.id)}
            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
            title="Remove from library">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="p-4 flex-1">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Tools &amp; Components ({agent.tools.length})
        </p>
        {agent.tools.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {agent.tools.map((t, i) => <ToolChip key={i} tool={t} />)}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 italic">No tools recorded</p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span title="Requests in the last 24h">
          {agent.requests_24h != null ? `${agent.requests_24h.toLocaleString()} req / 24h` : 'traffic —'}
        </span>
        {agent.endpoint && <span className="text-slate-400 font-mono truncate max-w-[45%]" title={agent.endpoint}>{agent.endpoint}</span>}
      </div>
    </div>
  );
};

// ── Add-agent modal ───────────────────────────────────────────────────────────
const AddAgentModal = ({ onAdd, onClose }: {
  onAdd: (input: AgentInput) => Promise<void>; onClose: () => void;
}) => {
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    try {
      await onAdd({ name: name.trim(), endpoint: endpoint.trim(), model: model.trim() });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add agent.');
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 h-9 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 outline-none focus:border-[#FF3621]';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-[420px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-[14px] font-bold text-slate-800">Add agent to library</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3.5">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Name *</label>
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="support_copilot" autoFocus />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Serving endpoint</label>
            <input className={inputCls} value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="support-copilot" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Model</label>
            <input className={inputCls} value={model} onChange={e => setModel(e.target.value)} placeholder="databricks-meta-llama-3-3-70b-instruct" />
          </div>
          <p className="text-[10px] text-slate-400">
            Tools &amp; components are captured automatically when an agent is deployed from the Builder.
          </p>
          {error && <p className="text-[11px] text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-100">
          <button onClick={onClose} className="px-3 h-9 rounded-lg text-[12px] font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#FF3621] hover:bg-[#e02d1a] disabled:opacity-50 text-white text-[12px] font-semibold">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add agent
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
export const AgentLibrary: React.FC = () => {
  const [agents, setAgents] = useState<RegistryAgent[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AgentStatus>('all');
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    const available = await backendAvailable();
    setLive(available);
    if (available) {
      try { setAgents(await listAgents()); }
      catch { setAgents([]); }
    } else {
      setAgents(SAMPLE_AGENTS);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (input: AgentInput) => {
    const created = await createAgent(input);
    setAgents(prev => [...prev, created]);
  };

  const handleDelete = async (id: string) => {
    await deleteAgent(id);
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.tools.some(t => t.label.toLowerCase().includes(q))
      );
    });
  }, [agents, query, statusFilter]);

  const totalTools = agents.reduce((n, a) => n + a.tools.length, 0);
  const workspace = agents.find(a => a.workspace)?.workspace ?? (live ? 'connected' : 'not connected');

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50">
      {/* Top nav */}
      <div className="h-[48px] bg-[#1B3139] border-b border-[#2e5060] flex items-center px-3.5 gap-2.5 z-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <AgentBuilderLogo size={22} />
          <span className="text-[15px] font-bold text-white">
            Agent Brick <span className="text-[#FF3621]">Builder</span>
          </span>
        </div>
        <div className="w-px h-[22px] bg-[#34606f] mx-1" />
        <nav className="flex items-center gap-1">
          <Link to="/" className="px-3 h-8 flex items-center rounded-md text-[12px] font-medium text-white/60 hover:bg-[#243f49] hover:text-white transition-all">Builder</Link>
          <Link to="/library" className="px-3 h-8 flex items-center rounded-md text-[12px] font-medium bg-[#FF3621] text-white">Agent Library</Link>
        </nav>
        <div className="flex-1" />
        <span className="text-[11px] text-white/40 font-mono">{workspace}</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h1 className="text-[22px] font-bold text-slate-800">Agent Library</h1>
              <p className="text-[13px] text-slate-500 mt-0.5">Agents registered in your workspace and the tools they use.</p>
            </div>
            <div className="flex items-center gap-5 text-right">
              <div>
                <div className="text-[20px] font-bold text-slate-800">{agents.length}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">Agents</div>
              </div>
              <div>
                <div className="text-[20px] font-bold text-slate-800">{totalTools}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">Tool refs</div>
              </div>
            </div>
          </div>

          {/* Live / sample notice */}
          {!live && (
            <div className="mb-5 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
              <CircleDot size={11} className="text-amber-500" />
              Showing sample data — the registry backend isn't reachable. Start it (agent-builder/server) to manage live agents.
            </div>
          )}

          {/* Filters + add */}
          <div className="flex items-center gap-2 mb-5">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search agents, models, tools…"
                className="w-full pl-9 pr-3 h-9 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 outline-none focus:border-[#FF3621]" />
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              {(['all', 'ready', 'updating', 'failed'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 h-8 rounded-md text-[11px] font-medium capitalize transition-all ${
                    statusFilter === s ? 'bg-[#1B3139] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                  {s}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            {live && (
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#FF3621] hover:bg-[#e02d1a] text-white text-[12px] font-semibold">
                <Plus size={14} /> Add agent
              </button>
            )}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-[13px] gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(a => <AgentCard key={a.id} agent={a} onDelete={handleDelete} canDelete={live} />)}
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 text-[13px]">
              {agents.length === 0 ? 'No agents registered yet.' : 'No agents match your search.'}
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddAgentModal onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
    </div>
  );
};
