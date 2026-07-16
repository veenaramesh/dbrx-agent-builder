import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Search, Wrench, Database, CircleDot, ExternalLink } from 'lucide-react';
import { NODE_COLORS } from '../constants';

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

// ── Mock production agents ────────────────────────────────────────────────────
// NOTE: placeholder data. Wiring to a live Databricks workspace (serving
// endpoints / apps + the tools each agent references) is the next step.

type AgentStatus = 'ready' | 'updating' | 'failed';

interface LibToolRef {
  kind: 'uc_function' | 'vector_search' | 'lakebase';
  label: string;   // display name
  detail: string;  // catalog.schema / index / instance
}

interface LibAgent {
  name: string;
  endpoint: string;
  model: string;
  status: AgentStatus;
  workspace: string;
  updated: string;      // relative, mock
  requests24h: number;  // mock traffic
  tools: LibToolRef[];
}

const MOCK_AGENTS: LibAgent[] = [
  {
    name: 'support_copilot',
    endpoint: 'support-copilot',
    model: 'databricks-meta-llama-3-3-70b-instruct',
    status: 'ready',
    workspace: 'field-eng.cloud.databricks.com',
    updated: '2h ago',
    requests24h: 4820,
    tools: [
      { kind: 'uc_function', label: 'search_knowledge_base', detail: 'main.tools' },
      { kind: 'uc_function', label: 'get_user_profile', detail: 'main.tools' },
      { kind: 'vector_search', label: 'Product Docs Index', detail: 'main.rag.product_docs_index' },
      { kind: 'lakebase', label: 'conversation_memory', detail: 'support-lakebase' },
    ],
  },
  {
    name: 'sales_researcher',
    endpoint: 'sales-researcher',
    model: 'databricks-claude-3-7-sonnet',
    status: 'ready',
    workspace: 'field-eng.cloud.databricks.com',
    updated: '1d ago',
    requests24h: 1290,
    tools: [
      { kind: 'uc_function', label: 'search_knowledge_base', detail: 'main.tools' },
      { kind: 'vector_search', label: 'Account Notes Index', detail: 'main.rag.account_notes_index' },
    ],
  },
  {
    name: 'sql_analyst',
    endpoint: 'sql-analyst',
    model: 'databricks-meta-llama-3-1-405b-instruct',
    status: 'updating',
    workspace: 'field-eng.cloud.databricks.com',
    updated: '12m ago',
    requests24h: 640,
    tools: [
      { kind: 'uc_function', label: 'run_sql_query', detail: 'main.analytics' },
      { kind: 'lakebase', label: 'orders_db', detail: 'analytics-lakebase' },
    ],
  },
  {
    name: 'onboarding_bot',
    endpoint: 'onboarding-bot',
    model: 'databricks-meta-llama-3-3-70b-instruct',
    status: 'failed',
    workspace: 'field-eng.cloud.databricks.com',
    updated: '3d ago',
    requests24h: 0,
    tools: [
      { kind: 'uc_function', label: 'create_ticket', detail: 'main.tools' },
    ],
  },
];

// ── Small presentational helpers ──────────────────────────────────────────────

const STATUS_META: Record<AgentStatus, { label: string; color: string; dot: string }> = {
  ready:    { label: 'Ready',    color: '#166534', dot: '#22c55e' },
  updating: { label: 'Updating', color: '#92400e', dot: '#f59e0b' },
  failed:   { label: 'Failed',   color: '#991b1b', dot: '#ef4444' },
};

const TOOL_META: Record<LibToolRef['kind'], { icon: React.ReactNode; color: string; label: string }> = {
  uc_function:   { icon: <Wrench size={11} />,  color: NODE_COLORS.uc_function.borderColor,   label: 'UC Function' },
  vector_search: { icon: <Search size={11} />,  color: NODE_COLORS.vector_search.borderColor, label: 'Vector Search' },
  lakebase:      { icon: <Database size={11} />, color: NODE_COLORS.lakebase.borderColor,      label: 'Lakebase' },
};

const StatusBadge = ({ status }: { status: AgentStatus }) => {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ backgroundColor: `${m.dot}1a`, color: m.color }}
    >
      <CircleDot size={9} style={{ color: m.dot }} />
      {m.label}
    </span>
  );
};

const ToolChip = ({ tool }: { tool: LibToolRef }) => {
  const m = TOOL_META[tool.kind];
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px]"
      style={{ backgroundColor: `${m.color}12`, borderColor: `${m.color}33`, color: m.color }}
      title={`${m.label} · ${tool.detail}`}
    >
      {m.icon}
      <span className="font-medium">{tool.label}</span>
    </div>
  );
};

const AgentCard = ({ agent }: { agent: LibAgent }) => {
  const llm = NODE_COLORS.llm.borderColor;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-slate-100">
        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${llm}15` }}
        >
          <Cpu size={18} color={llm} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-bold text-slate-800 truncate" title={agent.name}>{agent.name}</h3>
            <StatusBadge status={agent.status} />
          </div>
          <p className="text-[11px] text-slate-400 font-mono truncate" title={agent.model}>
            {agent.model.replace('databricks-', '')}
          </p>
        </div>
      </div>

      {/* Tools */}
      <div className="p-4 flex-1">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Tools &amp; Components ({agent.tools.length})
        </p>
        {agent.tools.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {agent.tools.map((t, i) => <ToolChip key={i} tool={t} />)}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 italic">No tools wired</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span title="Requests in the last 24h">
          {agent.requests24h.toLocaleString()} req / 24h
        </span>
        <span className="text-slate-400">updated {agent.updated}</span>
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export const AgentLibrary: React.FC = () => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AgentStatus>('all');

  const agents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_AGENTS.filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.tools.some(t => t.label.toLowerCase().includes(q))
      );
    });
  }, [query, statusFilter]);

  const totalTools = MOCK_AGENTS.reduce((n, a) => n + a.tools.length, 0);

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

        {/* Tab switcher */}
        <nav className="flex items-center gap-1">
          <Link
            to="/"
            className="px-3 h-8 flex items-center rounded-md text-[12px] font-medium text-white/60 hover:bg-[#243f49] hover:text-white transition-all"
          >
            Builder
          </Link>
          <Link
            to="/library"
            className="px-3 h-8 flex items-center rounded-md text-[12px] font-medium bg-[#FF3621] text-white"
          >
            Agent Library
          </Link>
        </nav>

        <div className="flex-1" />

        <span className="text-[11px] text-white/40 font-mono">
          {MOCK_AGENTS[0]?.workspace ?? 'not connected'}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* Title + stats */}
          <div className="flex items-end justify-between mb-5">
            <div>
              <h1 className="text-[22px] font-bold text-slate-800">Agent Library</h1>
              <p className="text-[13px] text-slate-500 mt-0.5">
                Agents deployed in your workspace and the tools they use.
              </p>
            </div>
            <div className="flex items-center gap-5 text-right">
              <div>
                <div className="text-[20px] font-bold text-slate-800">{MOCK_AGENTS.length}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">Agents</div>
              </div>
              <div>
                <div className="text-[20px] font-bold text-slate-800">{totalTools}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">Tool refs</div>
              </div>
            </div>
          </div>

          {/* Mockup notice */}
          <div className="mb-5 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
            <ExternalLink size={13} />
            Showing sample data. Connect a Databricks workspace to list live serving endpoints and their tools.
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-5">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search agents, models, tools…"
                className="w-full pl-9 pr-3 h-9 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 outline-none focus:border-[#FF3621]"
              />
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              {(['all', 'ready', 'updating', 'failed'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 h-8 rounded-md text-[11px] font-medium capitalize transition-all ${
                    statusFilter === s ? 'bg-[#1B3139] text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {agents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(a => <AgentCard key={a.name} agent={a} />)}
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 text-[13px]">
              No agents match your search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
