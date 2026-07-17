import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu, Search, Wrench, Database, CircleDot, Plus, Trash2, Loader2, X,
  Check, AlertTriangle, HelpCircle, UserCheck, RefreshCw, ArrowRight, ChevronDown, ChevronRight,
} from 'lucide-react';
import { NODE_COLORS } from '../constants';
import {
  listAgents, createAgent, deleteAgent, backendAvailable,
  verifyAgent, signOffAgent, promoteAgent,
  RegistryAgent, ToolRef, ToolKind, AgentInput, Stage, CheckStatus,
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
    id: 'sample-1', name: 'support_copilot', project: 'support_copilot', endpoint: 'support-copilot', app_url: '', experiment: '',
    model: 'databricks-meta-llama-3-3-70b-instruct', workspace: 'field-eng.cloud.databricks.com',
    stage: 'staging', registered_at: nowIso, updated_at: nowIso, status: 'ready', requests_24h: 4820,
    signed_off_by: 'veena.ramesh@databricks.com', signed_off_at: nowIso,
    tools: [
      { kind: 'uc_function', label: 'search_knowledge_base', detail: 'main.tools' },
      { kind: 'uc_function', label: 'get_user_profile', detail: 'main.tools' },
      { kind: 'vector_search', label: 'Product Docs Index', detail: 'main.rag.product_docs_index' },
      { kind: 'lakebase', label: 'conversation_memory', detail: 'support-lakebase' },
    ],
    readiness: {
      verified_at: nowIso, target_stage: 'prod', ready: true,
      checks: [
        { key: 'deployment', label: 'Deployed & serving', status: 'pass', detail: "Endpoint 'support-copilot' is READY.", blocking: true },
        { key: 'eval', label: 'Evaluation passing & fresh', status: 'pass', detail: 'Latest eval run passed gates (git a1b2c3d4).', blocking: true },
        { key: 'usage', label: 'Real usage (traffic, errors, latency)', status: 'pass', detail: '4,820 req/24h, 0.4% errors, p95 820ms.', blocking: false },
        { key: 'signoff', label: 'Human sign-off', status: 'pass', detail: 'Approved by veena.ramesh@databricks.com.', blocking: true },
      ],
    },
  },
  {
    id: 'sample-2', name: 'sales_researcher', project: 'sales_researcher', endpoint: 'sales-researcher', app_url: '', experiment: '',
    model: 'databricks-claude-3-7-sonnet', workspace: 'field-eng.cloud.databricks.com',
    stage: 'test', registered_at: nowIso, updated_at: nowIso, status: 'ready', requests_24h: 1290,
    signed_off_by: null, signed_off_at: null,
    tools: [
      { kind: 'uc_function', label: 'search_knowledge_base', detail: 'main.tools' },
      { kind: 'vector_search', label: 'Account Notes Index', detail: 'main.rag.account_notes_index' },
    ],
    readiness: {
      verified_at: nowIso, target_stage: 'staging', ready: false,
      checks: [
        { key: 'deployment', label: 'Deployed & serving', status: 'pass', detail: "Endpoint 'sales-researcher' is READY.", blocking: true },
        { key: 'eval', label: 'Evaluation passing & fresh', status: 'pass', detail: 'Latest eval run passed gates.', blocking: true },
        { key: 'usage', label: 'Real usage (traffic, errors, latency)', status: 'warn', detail: '1,290 req/24h, p95 4.6s (near budget).', blocking: false },
        { key: 'signoff', label: 'Human sign-off', status: 'manual', detail: "Awaiting a reviewer's approval to promote.", blocking: true },
      ],
    },
  },
  {
    id: 'sample-3', name: 'sql_analyst', project: 'sql_analyst', endpoint: 'sql-analyst', app_url: '', experiment: '',
    model: 'databricks-meta-llama-3-1-405b-instruct', workspace: 'field-eng.cloud.databricks.com',
    stage: 'dev', registered_at: nowIso, updated_at: nowIso, status: 'failed', requests_24h: 0,
    signed_off_by: null, signed_off_at: null,
    tools: [
      { kind: 'uc_function', label: 'run_sql_query', detail: 'main.analytics' },
      { kind: 'lakebase', label: 'orders_db', detail: 'analytics-lakebase' },
    ],
    readiness: {
      verified_at: nowIso, target_stage: 'test', ready: false,
      checks: [
        { key: 'deployment', label: 'Deployed & serving', status: 'pass', detail: "Endpoint 'sql-analyst' is READY.", blocking: true },
        { key: 'eval', label: 'Evaluation passing & fresh', status: 'fail', detail: 'Latest eval run failed one or more block-tier gates.', blocking: true },
        { key: 'usage', label: 'Real usage (traffic, errors, latency)', status: 'unknown', detail: 'No usage recorded yet.', blocking: false },
        { key: 'signoff', label: 'Human sign-off', status: 'manual', detail: "Awaiting a reviewer's approval to promote.", blocking: true },
      ],
    },
  },
  {
    id: 'sample-4', name: 'onboarding_bot', project: 'onboarding_bot', endpoint: '', app_url: '', experiment: '',
    model: 'databricks-meta-llama-3-3-70b-instruct', workspace: 'field-eng.cloud.databricks.com',
    stage: 'dev', registered_at: nowIso, updated_at: nowIso, status: 'unknown', requests_24h: null,
    signed_off_by: null, signed_off_at: null,
    tools: [{ kind: 'uc_function', label: 'create_ticket', detail: 'main.tools' }],
    readiness: null,
  },
];

// ── Presentational helpers ────────────────────────────────────────────────────
const TOOL_META: Record<ToolKind, { icon: React.ReactNode; color: string; label: string }> = {
  uc_function:   { icon: <Wrench size={11} />,  color: NODE_COLORS.uc_function.borderColor,   label: 'UC Function' },
  vector_search: { icon: <Search size={11} />,  color: NODE_COLORS.vector_search.borderColor, label: 'Vector Search' },
  lakebase:      { icon: <Database size={11} />, color: NODE_COLORS.lakebase.borderColor,      label: 'Lakebase' },
};

// Promotion lifecycle stages.
const STAGE_META: Record<Stage, { label: string; color: string }> = {
  dev:     { label: 'Dev',     color: '#64748b' },
  test:    { label: 'Test',    color: '#0ea5e9' },
  staging: { label: 'Staging', color: '#8b5cf6' },
  prod:    { label: 'Prod',    color: '#16a34a' },
};

const StageBadge = ({ stage }: { stage: Stage }) => {
  const m = STAGE_META[stage] ?? STAGE_META.dev;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: `${m.color}18`, color: m.color }}>
      {m.label}
    </span>
  );
};

const CHECK_META: Record<CheckStatus, { icon: React.ReactNode; color: string }> = {
  pass:    { icon: <Check size={12} />,          color: '#16a34a' },
  warn:    { icon: <AlertTriangle size={12} />,  color: '#d97706' },
  fail:    { icon: <X size={12} />,              color: '#dc2626' },
  manual:  { icon: <UserCheck size={12} />,      color: '#8b5cf6' },
  unknown: { icon: <HelpCircle size={12} />,     color: '#94a3b8' },
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

// Readiness scorecard shown inside a card.
const ReadinessPanel = ({ agent, live, busy, onVerify, onSignoff, onPromote }: {
  agent: RegistryAgent; live: boolean; busy: boolean;
  onVerify: () => void; onSignoff: (approved: boolean) => void; onPromote: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const r = agent.readiness;
  const nextLabel = r?.target_stage ? STAGE_META[r.target_stage].label : null;

  const verdict = !r
    ? { text: 'Not verified', color: '#94a3b8', bg: '#f1f5f9' }
    : r.ready
      ? { text: nextLabel ? `Ready to promote to ${nextLabel}` : 'Ready', color: '#16a34a', bg: '#f0fdf4' }
      : { text: nextLabel ? `Not ready for ${nextLabel}` : 'Not ready', color: '#b45309', bg: '#fffbeb' };

  return (
    <div className="px-4 py-3 border-t border-slate-100">
      {/* Verdict row */}
      <div className="flex items-center justify-between">
        <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1.5 min-w-0">
          {r && (expanded ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />)}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold"
            style={{ backgroundColor: verdict.bg, color: verdict.color }}>
            {r?.ready ? <Check size={11} /> : <CircleDot size={9} />}
            {verdict.text}
          </span>
        </button>
        {live && (
          <button onClick={onVerify} disabled={busy}
            className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-[#FF3621] disabled:opacity-50"
            title="Recompute readiness from live workspace state">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Verify
          </button>
        )}
      </div>

      {/* Expandable checklist */}
      {expanded && r && (
        <div className="mt-2.5 space-y-1.5">
          {r.checks.map(c => {
            const m = CHECK_META[c.status];
            return (
              <div key={c.key} className="flex items-start gap-2 text-[11px]">
                <span className="flex-shrink-0 mt-[1px]" style={{ color: m.color }}>{m.icon}</span>
                <div className="min-w-0">
                  <span className="font-medium text-slate-700">{c.label}</span>
                  {!c.blocking && <span className="ml-1 text-[9px] text-slate-400">(non-blocking)</span>}
                  <p className="text-slate-400 leading-snug">{c.detail}</p>
                </div>
              </div>
            );
          })}
          <p className="text-[9px] text-slate-300 pt-0.5">verified {r.verified_at.slice(0, 16).replace('T', ' ')}</p>
        </div>
      )}

      {/* Actions */}
      {live && (
        <div className="mt-3 flex items-center gap-2">
          {agent.signed_off_by ? (
            <button onClick={() => onSignoff(false)} disabled={busy}
              className="flex items-center gap-1 px-2.5 h-7 rounded-md border border-slate-200 text-[10px] font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50">
              <UserCheck size={11} className="text-violet-500" /> Signed off · revoke
            </button>
          ) : (
            <button onClick={() => onSignoff(true)} disabled={busy}
              className="flex items-center gap-1 px-2.5 h-7 rounded-md border border-violet-200 text-[10px] font-medium text-violet-600 hover:bg-violet-50 disabled:opacity-50">
              <UserCheck size={11} /> Sign off
            </button>
          )}
          <button onClick={onPromote} disabled={busy || !r?.ready || !nextLabel}
            className="flex items-center gap-1 px-2.5 h-7 rounded-md bg-[#FF3621] hover:bg-[#e02d1a] text-white text-[10px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            title={r?.ready ? `Promote to ${nextLabel}` : 'Satisfy all blocking checks first'}>
            Promote{nextLabel ? ` → ${nextLabel}` : ''} <ArrowRight size={11} />
          </button>
        </div>
      )}
    </div>
  );
};

const AgentCard = ({ agent, live, canDelete, onDelete, onVerify, onSignoff, onPromote }: {
  agent: RegistryAgent; live: boolean; canDelete: boolean;
  onDelete: (id: string) => void;
  onVerify: (id: string) => Promise<void>;
  onSignoff: (id: string, approved: boolean) => Promise<void>;
  onPromote: (id: string) => Promise<void>;
}) => {
  const llm = NODE_COLORS.llm.borderColor;
  const [busy, setBusy] = useState(false);
  const wrap = (fn: () => Promise<void>) => async () => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col group">
      <div className="flex items-start gap-3 p-4 border-b border-slate-100">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${llm}15` }}>
          <Cpu size={18} color={llm} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-bold text-slate-800 truncate" title={agent.name}>{agent.name}</h3>
            <StageBadge stage={agent.stage} />
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

      <ReadinessPanel
        agent={agent} live={live} busy={busy}
        onVerify={wrap(() => onVerify(agent.id))}
        onSignoff={(approved) => wrap(() => onSignoff(agent.id, approved))()}
        onPromote={wrap(() => onPromote(agent.id))}
      />
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
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all');
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

  const replace = (updated: RegistryAgent) =>
    setAgents(prev => prev.map(a => (a.id === updated.id ? updated : a)));

  const handleVerify = async (id: string) => { replace(await verifyAgent(id)); };
  const handleSignoff = async (id: string, approved: boolean) => { replace(await signOffAgent(id, approved)); };
  const handlePromote = async (id: string) => {
    try { replace(await promoteAgent(id)); }
    catch (e) { alert(e instanceof Error ? e.message : 'Promote failed'); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter(a => {
      if (stageFilter !== 'all' && a.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.tools.some(t => t.label.toLowerCase().includes(q))
      );
    });
  }, [agents, query, stageFilter]);

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
              {(['all', 'dev', 'test', 'staging', 'prod'] as const).map(s => (
                <button key={s} onClick={() => setStageFilter(s)}
                  className={`px-3 h-8 rounded-md text-[11px] font-medium capitalize transition-all ${
                    stageFilter === s ? 'bg-[#1B3139] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
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
              {filtered.map(a => (
                <AgentCard key={a.id} agent={a} live={live} canDelete={live}
                  onDelete={handleDelete} onVerify={handleVerify}
                  onSignoff={handleSignoff} onPromote={handlePromote} />
              ))}
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
