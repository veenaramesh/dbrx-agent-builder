import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer2, Hand, Cable, Undo2, Redo2,
  Cpu, Search, Wrench, X, Copy, Check,
  ChevronDown, ChevronRight, Code2, Trash2, Copy as CopyIcon,
  Loader2, Square, Database, Settings,
  Rocket, ArrowRight, ShieldCheck, FlaskConical,
} from 'lucide-react';
import { ToolType, AgentNodeData, AgentNodeType, LLMConfig, VectorSearchConfig, UCFunctionConfig, GroupConfig, LakebaseConfig, ProjectSettings, CICDConfig, CICDProvider, PromotionGate, CICDEnvironment, CloudProvider, MemoryType, EvalDatasetSource } from '../types';
import { NODE_COLORS, DEFAULT_NODE_SIZE, DEFAULT_CONFIGS, DEFAULT_CICD_CONFIG } from '../constants';

// ── Logo ──────────────────────────────────────────────────────────────────────

const AgentBuilderLogo = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="8" width="18" height="12" rx="3" stroke="#FF3621" strokeWidth="2" fill="none" />
    <path d="M8 8V6a4 4 0 0 1 8 0v2" stroke="#FF3621" strokeWidth="2" strokeLinecap="round" />
    <circle cx="9" cy="14" r="1.5" fill="#FF3621" />
    <circle cx="15" cy="14" r="1.5" fill="#FF3621" />
    <path d="M9 17.5c0 0 1 1.5 3 1.5s3-1.5 3-1.5" stroke="#FF3621" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ── Header ────────────────────────────────────────────────────────────────────

interface HeaderProps {
  agentName: string;
  currentTool: ToolType;
  setTool: (t: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExportCode: () => void;
  onDeploy: () => void;
  isDeploying: boolean;
  onAgentNameChange: (name: string) => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  agentName,
  currentTool,
  setTool,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExportCode,
  onDeploy,
  isDeploying,
  onAgentNameChange,
  onOpenSettings,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(agentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditedName(agentName); }, [agentName]);
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const saveName = () => {
    const trimmed = editedName.trim();
    if (trimmed) onAgentNameChange(trimmed);
    else setEditedName(agentName);
    setIsEditingName(false);
  };

  const tools: { id: ToolType; icon: React.ReactNode; title: string }[] = [
    { id: 'select', icon: <MousePointer2 size={15} />, title: 'Select (V)' },
    { id: 'hand', icon: <Hand size={15} />, title: 'Pan (H)' },
    { id: 'connect', icon: <Cable size={15} />, title: 'Connect (C)' },
  ];

  return (
    <div className="h-[48px] bg-[#1B3139] border-b border-[#2e5060] flex items-center px-3.5 gap-2.5 z-50 flex-shrink-0">
      {/* Logo + name */}
      <div className="flex items-center gap-2">
        <AgentBuilderLogo size={22} />
        <span className="text-[15px] font-bold text-white">
          Agent Brick <span className="text-[#FF3621]">Builder</span>
        </span>
      </div>

      <div className="w-px h-[22px] bg-[#34606f] mx-1" />

      {/* Agent name */}
      <div className="flex items-center gap-1.5 text-xs text-white/50">
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName();
              if (e.key === 'Escape') { setEditedName(agentName); setIsEditingName(false); }
            }}
            className="text-white font-medium bg-[#243f49] px-2 py-0.5 rounded border border-[#FF3621] outline-none min-w-[140px] text-xs"
          />
        ) : (
          <span
            className="text-white font-medium cursor-pointer hover:text-[#FF3621] transition-colors"
            onClick={() => setIsEditingName(true)}
            title="Click to rename"
          >
            {agentName}
          </span>
        )}
      </div>

      <div className="w-px h-[22px] bg-[#34606f] mx-1" />

      {/* Undo / Redo */}
      <button onClick={onUndo} disabled={!canUndo}
        className="w-8 h-8 rounded-md flex items-center justify-center text-white/60 hover:bg-[#243f49] hover:text-white disabled:opacity-30 transition-all"
        title="Undo (⌘Z)"
      ><Undo2 size={15} /></button>
      <button onClick={onRedo} disabled={!canRedo}
        className="w-8 h-8 rounded-md flex items-center justify-center text-white/60 hover:bg-[#243f49] hover:text-white disabled:opacity-30 transition-all"
        title="Redo (⌘Y)"
      ><Redo2 size={15} /></button>

      <div className="w-px h-[22px] bg-[#34606f] mx-1" />

      {/* Tools */}
      {tools.map(t => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          title={t.title}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
            currentTool === t.id
              ? 'bg-[#FF3621] text-white'
              : 'text-white/60 hover:bg-[#243f49] hover:text-white'
          }`}
        >
          {t.icon}
        </button>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <button
        onClick={onOpenSettings}
        className="w-8 h-8 flex items-center justify-center rounded-md text-white/60 hover:bg-[#243f49] hover:text-white transition-all"
        title="Project Settings"
      >
        <Settings size={15} />
      </button>

      {/* Export Code */}
      <button
        onClick={onExportCode}
        className="flex items-center gap-2 px-3 h-8 bg-[#243f49] hover:bg-[#2e5060] text-white text-xs font-semibold rounded-md transition-colors border border-[#34606f]"
        title="Export Agent Code"
      >
        <Code2 size={14} />
        Export Code
      </button>

      {/* Deploy to Workspace */}
      <button
        onClick={onDeploy}
        disabled={isDeploying}
        className="flex items-center gap-2 px-3 h-8 bg-[#FF3621] hover:bg-[#e02d1a] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-md transition-colors"
        title="Write the DAB into your Databricks workspace"
      >
        {isDeploying ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
        {isDeploying ? 'Deploying…' : 'Deploy to Workspace'}
      </button>
    </div>
  );
};

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarSection {
  title: string;
  items: { type: AgentNodeType; label: string; description: string }[];
}

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: 'Models',
    items: [
      { type: 'llm', label: 'LLM', description: 'Tool-calling LLM — connect tools directly' },
    ],
  },
  {
    title: 'Retrievers',
    items: [
      { type: 'vector_search', label: 'Vector Search', description: 'Databricks Vector Search index' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { type: 'uc_function', label: 'UC Function', description: 'Unity Catalog function as a tool' },
      { type: 'lakebase', label: 'Lakebase', description: 'Postgres database as a query tool' },
    ],
  },
  {
    title: 'Annotations',
    items: [
      { type: 'group', label: 'Group', description: 'Visual group box to annotate agents' },
    ],
  },
];

const sidebarIcons: Record<AgentNodeType, React.ReactNode> = {
  llm: <Cpu size={14} />,
  vector_search: <Search size={14} />,
  uc_function: <Wrench size={14} />,
  group: <Square size={14} />,
  lakebase: <Database size={14} />,
};

interface SidebarProps {
  onDragStart: (e: React.DragEvent, type: AgentNodeType, label: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onDragStart }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = (title: string) =>
    setCollapsed(prev => ({ ...prev, [title]: !prev[title] }));

  return (
    <div className="w-[220px] bg-slate-800 flex flex-col flex-shrink-0 overflow-y-auto custom-scrollbar border-r border-slate-700">
      <div className="px-3 py-3 border-b border-slate-700">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Bricks</p>
      </div>

      {SIDEBAR_SECTIONS.map(section => (
        <div key={section.title} className="border-b border-slate-700">
          <button
            onClick={() => toggleSection(section.title)}
            className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            {section.title}
            {collapsed[section.title]
              ? <ChevronRight size={12} />
              : <ChevronDown size={12} />}
          </button>

          {!collapsed[section.title] && (
            <div className="px-2 pb-2 space-y-1">
              {section.items.map(item => {
                const colors = NODE_COLORS[item.type];
                return (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, item.type, item.label)}
                    className="group flex items-center gap-2.5 px-2 py-2 rounded-lg border cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-all select-none"
                    style={{ backgroundColor: colors.headerBg, borderColor: `${colors.borderColor}50` }}
                    title={item.description}
                  >
                    <div style={{ color: colors.borderColor }}>{sidebarIcons[item.type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold leading-tight" style={{ color: colors.headerText }}>
                        {item.label}
                      </div>
                      <div className="text-[9px] text-slate-400 leading-tight mt-0.5 truncate group-hover:text-slate-300">
                        {item.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Usage tip */}
      <div className="mt-auto px-3 py-3 text-[9px] text-slate-500 leading-relaxed">
        <p className="font-semibold text-slate-400 mb-1">Tips</p>
        <p>• Drag bricks onto canvas</p>
        <p>• Use <strong className="text-slate-300">Connect</strong> tool to wire them</p>
        <p>• Click to select &amp; edit properties</p>
        <p>• Double-click to rename</p>
      </div>
    </div>
  );
};

// ── Right Panel (Properties) ──────────────────────────────────────────────────

interface RightPanelProps {
  selectedNode: AgentNodeData | null;
  onUpdateNode: (node: AgentNodeData) => void;
  onDeleteNode: (id: string) => void;
  onDuplicateNode: (node: AgentNodeData) => void;
  onClose: () => void;
  models: string[];
}

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1">
    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const inputCls = 'w-full text-xs text-[#1B3139] bg-[#F4F6F8] border border-[#DDE3E8] rounded px-2 py-1.5 outline-none focus:border-[#2272B4] focus:ring-1 focus:ring-[#2272B4]/20 transition-colors font-mono';
const textareaCls = inputCls + ' resize-none';

export const RightPanel: React.FC<RightPanelProps> = ({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
  onClose,
  models,
}) => {
  if (!selectedNode) return null;

  const colors = NODE_COLORS[selectedNode.type];

  const updateConfig = (patch: Partial<LLMConfig & VectorSearchConfig & UCFunctionConfig & GroupConfig & LakebaseConfig>) => {
    onUpdateNode({ ...selectedNode, config: { ...selectedNode.config, ...patch } });
  };

  const updateLabel = (label: string) => onUpdateNode({ ...selectedNode, label });

  const cfg = selectedNode.config as LLMConfig & VectorSearchConfig & UCFunctionConfig & GroupConfig & LakebaseConfig;

  return (
    <div className="w-[280px] flex-shrink-0 bg-white border-l border-[#DDE3E8] flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#DDE3E8]">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded flex items-center justify-center"
            style={{ backgroundColor: colors.headerBg }}
          >
            <span style={{ color: colors.borderColor }}>
              {sidebarIcons[selectedNode.type]}
            </span>
          </div>
          <span className="text-[11px] font-bold text-[#1B3139] uppercase tracking-wide">
            {NODE_COLORS[selectedNode.type].label}
          </span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded">
          <X size={14} />
        </button>
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
        {/* Label — all node types */}
        <Field label="Label">
          <input
            className={inputCls}
            value={selectedNode.label}
            onChange={(e) => updateLabel(e.target.value)}
          />
        </Field>


        {/* ── LLM ── */}
        {selectedNode.type === 'llm' && (
          <>
            <Field label="Endpoint / Model">
              <select
                className={inputCls}
                value={cfg.model ?? models[0]}
                onChange={(e) => updateConfig({ model: e.target.value, endpointName: e.target.value })}
              >
                {models.map(m => (
                  <option key={m} value={m}>{m.replace('databricks-', '')}</option>
                ))}
                <option value="__custom__">Custom endpoint…</option>
              </select>
            </Field>
            {(cfg.model === '__custom__' || !models.includes(cfg.endpointName ?? '')) && (
              <Field label="Custom Endpoint Name">
                <input
                  className={inputCls}
                  placeholder="my-fine-tuned-model"
                  value={cfg.endpointName ?? ''}
                  onChange={(e) => updateConfig({ endpointName: e.target.value })}
                />
              </Field>
            )}
            <Field label="Max Tokens">
              <input
                className={inputCls}
                type="number"
                min={1}
                max={16384}
                value={cfg.maxTokens ?? 1000}
                onChange={(e) => updateConfig({ maxTokens: parseInt(e.target.value) || 1000 })}
              />
            </Field>
            <Field label={`Temperature: ${(cfg.temperature ?? 0.1).toFixed(1)}`}>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={cfg.temperature ?? 0.1}
                onChange={(e) => updateConfig({ temperature: parseFloat(e.target.value) })}
                className="w-full h-1.5 rounded appearance-none cursor-pointer accent-[#FF3621]"
              />
              <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                <span>0 (precise)</span>
                <span>2 (creative)</span>
              </div>
            </Field>
            <Field label="System Prompt">
              <textarea
                className={textareaCls}
                rows={5}
                value={cfg.systemPrompt ?? ''}
                placeholder="You are a helpful assistant."
                onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
              />
            </Field>
            <Field label="Max Iterations">
              <input
                className={inputCls}
                type="number"
                min={1}
                max={100}
                value={cfg.maxIterations ?? 10}
                onChange={(e) => updateConfig({ maxIterations: parseInt(e.target.value) || 10 })}
              />
            </Field>
            <p className="text-[10px] text-slate-400 -mt-2 leading-relaxed">
              Max tool-calling rounds before the agent stops and returns a response.
            </p>
          </>
        )}

        {/* ── Vector Search ── */}
        {selectedNode.type === 'vector_search' && (
          <>
            <Field label="Endpoint Name">
              <input
                className={inputCls}
                placeholder="my-vs-endpoint"
                value={cfg.endpointName ?? ''}
                onChange={(e) => updateConfig({ endpointName: e.target.value })}
              />
            </Field>
            <Field label="Index Name">
              <input
                className={inputCls}
                placeholder="catalog.schema.index_name"
                value={cfg.indexName ?? ''}
                onChange={(e) => updateConfig({ indexName: e.target.value })}
              />
            </Field>
            <Field label="Text Column">
              <input
                className={inputCls}
                placeholder="content"
                value={cfg.textColumn ?? ''}
                onChange={(e) => updateConfig({ textColumn: e.target.value })}
              />
            </Field>
            <Field label="Columns to Return">
              <input
                className={inputCls}
                placeholder="id, content, source"
                value={cfg.columns ?? ''}
                onChange={(e) => updateConfig({ columns: e.target.value })}
              />
              <p className="text-[9px] text-slate-400 mt-0.5">Comma-separated column names</p>
            </Field>
            <Field label="Num Results">
              <input
                className={inputCls}
                type="number"
                min={1}
                max={50}
                value={cfg.numResults ?? 5}
                onChange={(e) => updateConfig({ numResults: parseInt(e.target.value) || 5 })}
              />
            </Field>
            {/* Chunked table toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={cfg.hasChunkedTable ?? false}
                  onChange={(e) => updateConfig({ hasChunkedTable: e.target.checked })}
                />
                <div className={`w-8 h-4 rounded-full transition-colors ${(cfg.hasChunkedTable ?? false) ? 'bg-[#00A972]' : 'bg-slate-300'}`} />
                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${(cfg.hasChunkedTable ?? false) ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-[11px] font-medium text-slate-700">
                {(cfg.hasChunkedTable ?? false) ? 'Using existing chunked table' : 'Generate ingestion pipeline'}
              </span>
            </label>
            <p className="text-[10px] text-slate-400 -mt-0.5">
              {(cfg.hasChunkedTable ?? false)
                ? 'The scaffold will sync from your existing chunked Delta table.'
                : 'The scaffold will include a DLT pipeline for document ingestion and chunking.'}
            </p>
          </>
        )}

        {/* ── UC Function ── */}
        {selectedNode.type === 'uc_function' && (
          <>
            <Field label="Catalog">
              <input
                className={inputCls}
                placeholder="main"
                value={cfg.catalog ?? ''}
                onChange={(e) => updateConfig({ catalog: e.target.value })}
              />
            </Field>
            <Field label="Schema">
              <input
                className={inputCls}
                placeholder="default"
                value={cfg.schema ?? ''}
                onChange={(e) => updateConfig({ schema: e.target.value })}
              />
            </Field>
            <Field label="Function Name">
              <input
                className={inputCls}
                placeholder="my_function"
                value={cfg.functionName ?? ''}
                onChange={(e) => updateConfig({ functionName: e.target.value })}
              />
            </Field>
            {/* Full path preview */}
            <div className="text-[9px] font-mono text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
              {cfg.catalog || 'catalog'}.{cfg.schema || 'schema'}.{cfg.functionName || 'function_name'}
            </div>
            {/* Deploy toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={cfg.deploy ?? true}
                  onChange={(e) => updateConfig({ deploy: e.target.checked })}
                />
                <div className={`w-8 h-4 rounded-full transition-colors ${(cfg.deploy ?? true) ? 'bg-[#F7A600]' : 'bg-slate-300'}`} />
                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${(cfg.deploy ?? true) ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-[11px] font-medium text-slate-700">
                {(cfg.deploy ?? true) ? 'Deploy this function' : 'Call existing function'}
              </span>
            </label>
            <p className="text-[10px] text-slate-400 -mt-0.5">
              {(cfg.deploy ?? true)
                ? 'Generates a stub .py file and deploys it to UC via the tools bundle.'
                : 'References an already-deployed UC function by its full path.'}
            </p>
            <Field label="Description (optional)">
              <textarea
                className={textareaCls}
                rows={3}
                placeholder="What does this function do?"
                value={cfg.description ?? ''}
                onChange={(e) => updateConfig({ description: e.target.value })}
              />
            </Field>
          </>
        )}

        {/* ── Group ── */}
        {selectedNode.type === 'group' && (
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Groups are visual annotations only — they do not affect code generation.
            Double-click the canvas group to rename it. Drag corners to resize.
          </p>
        )}

        {/* ── Lakebase ── */}
        {selectedNode.type === 'lakebase' && (
          <>
            <Field label="Instance Name">
              <input
                className={inputCls}
                placeholder="my-lakebase-instance"
                value={cfg.instanceName ?? ''}
                onChange={(e) => updateConfig({ instanceName: e.target.value })}
              />
            </Field>
            <Field label="Memory Type">
              <select
                className={inputCls}
                value={cfg.memoryType ?? 'short_term'}
                onChange={(e) => updateConfig({ memoryType: e.target.value as MemoryType })}
              >
                <option value="short_term">Short-term (conversation history)</option>
                <option value="long_term">Long-term (cross-session memory)</option>
                <option value="both">Both</option>
              </select>
            </Field>
            <Field label="Description (optional)">
              <textarea
                className={textareaCls}
                rows={3}
                placeholder="Query the orders Lakebase Postgres database."
                value={cfg.description ?? ''}
                onChange={(e) => updateConfig({ description: e.target.value })}
              />
            </Field>
            <p className="text-[10px] text-slate-400 leading-relaxed -mt-2">
              Connects to LLM as a Postgres query tool. Memory type configures the LangGraph checkpointer.
            </p>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-[#DDE3E8] px-3 py-2.5 flex gap-2">
        <button
          onClick={() => onDuplicateNode(selectedNode)}
          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-2 py-1.5 transition-colors"
        >
          <CopyIcon size={12} />
          Duplicate
        </button>
        <button
          onClick={() => onDeleteNode(selectedNode.id)}
          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded px-2 py-1.5 transition-colors"
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </div>
  );
};

// ── Context Menu ──────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number;
  y: number;
  nodeId: string | null;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, nodeId, onDelete, onDuplicate, onClose }) => {
  if (!nodeId) return null;

  return (
    <div
      className="fixed z-[200] bg-white border border-[#DDE3E8] rounded-lg shadow-floating py-1 min-w-[160px] text-[12px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 text-[#1B3139] transition-colors"
        onClick={() => { onDuplicate(); onClose(); }}
      >
        <CopyIcon size={13} className="text-slate-400" />
        Duplicate
      </button>
      <div className="h-px bg-[#DDE3E8] my-1" />
      <button
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-red-50 text-red-600 transition-colors"
        onClick={() => { onDelete(); onClose(); }}
      >
        <Trash2 size={13} />
        Delete
      </button>
    </div>
  );
};

// ── Deploy Result Modal ───────────────────────────────────────────────────────

interface DeployResultModalProps {
  result: { workspace_path: string; user: string; commands: string[] } | null;
  error: string | null;
  onClose: () => void;
}

export const DeployResultModal: React.FC<DeployResultModalProps> = ({ result, error, onClose }) => {
  const [copied, setCopied] = useState(false);
  const cmds = result?.commands.join('\n') ?? '';

  const copyCmds = () => {
    navigator.clipboard.writeText(cmds).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-[560px] max-w-[92vw]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-[14px] font-bold text-slate-800">
            {error ? 'Deploy failed' : 'Deployed to workspace'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>

        {error ? (
          <div className="p-5">
            <p className="text-[12px] text-red-600 leading-relaxed">{error}</p>
            <p className="text-[11px] text-slate-400 mt-3">
              If you're running locally, deploy needs the backend and a Databricks login.
              Inside the App it writes to your workspace automatically.
            </p>
          </div>
        ) : result && (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Wrote files to</p>
              <code className="block text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono break-all">
                {result.workspace_path}
              </code>
              <p className="text-[10px] text-slate-400 mt-1">in {result.user}'s workspace</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Next steps — run from a workspace terminal</p>
                <button onClick={copyCmds} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-[#FF3621]">
                  {copied ? <Check size={11} /> : <Copy size={11} />}{copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="text-[11px] text-slate-700 bg-slate-900 text-slate-100 rounded-lg px-3 py-2.5 font-mono overflow-x-auto whitespace-pre">
{result.commands.join('\n')}
              </pre>
              <p className="text-[10px] text-slate-400 mt-2">
                <code>bundle init</code> renders the agentops-stacks project from your <code>config.json</code>;
                <code> bundle deploy</code> ships it to Databricks.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end px-5 py-3.5 border-t border-slate-100">
          <button onClick={onClose} className="px-3 h-9 rounded-lg bg-[#1B3139] text-white text-[12px] font-semibold hover:bg-[#243f49]">Done</button>
        </div>
      </div>
    </div>
  );
};

// ── Code Export Modal ─────────────────────────────────────────────────────────

const DAB_INIT_COMMAND = 'databricks bundle init https://github.com/databricks-solutions/agentops-stacks --config-file config.json';

interface CodeExportModalProps {
  dabConfigJson: string;
  manifestJson: string;
  cicdWorkflow?: string;
  cicdProvider?: string;
  onClose: () => void;
}

const CICD_FILE_NAMES: Record<string, string> = {
  github_actions: '.github/workflows/deploy.yml',
  azure_devops:   'azure-pipelines.yml',
  gitlab_ci:      '.gitlab-ci.yml',
};

export const CodeExportModal: React.FC<CodeExportModalProps> = ({ dabConfigJson, manifestJson, cicdWorkflow, cicdProvider, onClose }) => {
  type TabType = 'config' | 'manifest' | 'cicd';
  const [tab, setTab] = useState<TabType>('config');
  const [copied, setCopied] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const hasCICD = !!cicdWorkflow;
  const cicdFileName = cicdProvider ? CICD_FILE_NAMES[cicdProvider] ?? 'ci-cd.yml' : 'ci-cd.yml';
  const activeContent = tab === 'config' ? dabConfigJson : tab === 'manifest' ? manifestJson : (cicdWorkflow ?? '');
  const activeLabel   = tab === 'config' ? 'config.json (agentops-stacks)' : tab === 'manifest' ? 'agents_manifest.json' : cicdFileName;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(DAB_INIT_COMMAND).then(() => {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1B3139] rounded-xl shadow-2xl w-[720px] max-w-[90vw] max-h-[80vh] flex flex-col border border-[#34606f]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#34606f]">
          <div className="flex items-center gap-2">
            <Code2 size={16} className="text-[#FF3621]" />
            <span className="text-sm font-bold text-white">Export Configuration</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[#243f49] hover:bg-[#2e5060] border border-[#34606f] text-white transition-colors"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : `Copy ${activeLabel}`}
            </button>
            <button
              onClick={handleCopyCmd}
              className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[#FF3621] hover:bg-[#e02d1a] text-white transition-colors"
            >
              {copiedCmd ? <Check size={13} /> : <CopyIcon size={13} />}
              {copiedCmd ? 'Copied!' : 'Copy DAB command'}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#34606f]">
          {([
            { id: 'config' as TabType, label: 'config.json' },
            { id: 'manifest' as TabType, label: 'agents_manifest.json' },
            ...(hasCICD ? [{ id: 'cicd' as TabType, label: cicdFileName }] : []),
          ]).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setCopied(false); }}
                className={`px-4 py-2 text-[11px] font-mono font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-[#FF3621] text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          <pre className="text-[11px] text-[#e2e8f0] font-mono leading-relaxed whitespace-pre">
            {activeContent}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#34606f] text-[10px] text-slate-500 leading-relaxed">
          <span className="text-slate-400 font-medium">1.</span> <code className="text-slate-300">databricks bundle init https://github.com/databricks-solutions/agentops-stacks --config-file config.json</code><br />
          <span className="text-slate-400 font-medium">2.</span> Copy <code className="text-slate-300">agents_manifest.json</code> into the project, then run <code className="text-slate-300">python scripts/generate_agents.py</code>
        </div>
      </div>
    </div>
  );
};

// ── Project Settings Modal ────────────────────────────────────────────────────

const CICD_PROVIDERS: { id: CICDProvider; label: string; icon: string }[] = [
  { id: 'github_actions', label: 'GitHub Actions', icon: 'GH' },
  { id: 'azure_devops',   label: 'Azure DevOps',  icon: 'Az' },
  { id: 'gitlab_ci',      label: 'GitLab CI',     icon: 'GL' },
];

const PROMOTION_GATES: { id: PromotionGate; label: string; description: string }[] = [
  { id: 'manual',                label: 'Manual Approval',       description: 'Require a human to approve promotion to production' },
  { id: 'tests_pass',           label: 'Tests Pass',             description: 'Promote automatically when all tests pass' },
  { id: 'evaluation_threshold', label: 'Evaluation Threshold',   description: 'Promote when agent evaluation score meets threshold' },
];

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; color?: string }> = ({ checked, onChange, color = '#0d9488' }) => (
  <div className="relative">
    <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
    <div
      className="w-8 h-4 rounded-full transition-colors cursor-pointer"
      style={{ backgroundColor: checked ? color : '#cbd5e1' }}
      onClick={() => onChange(!checked)}
    />
    <div
      className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform pointer-events-none ${checked ? 'translate-x-4' : 'translate-x-0'}`}
    />
  </div>
);

const EnvironmentFields: React.FC<{
  label: string;
  env: CICDEnvironment;
  onChange: (env: CICDEnvironment) => void;
  color: string;
}> = ({ label, env, onChange, color }) => (
  <div className="border border-slate-200 rounded-lg p-3 space-y-2.5">
    <div className="flex items-center gap-2 mb-1">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">{label}</span>
    </div>
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Workspace Host</label>
      <input
        className={inputCls}
        placeholder="https://adb-xxxx.azuredatabricks.net"
        value={env.workspaceHost}
        onChange={e => onChange({ ...env, workspaceHost: e.target.value })}
      />
    </div>
    <div className="flex gap-2">
      <div className="flex-1">
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Catalog</label>
        <input
          className={inputCls}
          placeholder="main"
          value={env.catalog}
          onChange={e => onChange({ ...env, catalog: e.target.value })}
        />
      </div>
      <div className="flex-1">
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Schema</label>
        <input
          className={inputCls}
          placeholder="default"
          value={env.schema}
          onChange={e => onChange({ ...env, schema: e.target.value })}
        />
      </div>
    </div>
  </div>
);

interface ProjectSettingsModalProps {
  settings: ProjectSettings;
  onUpdate: (s: ProjectSettings) => void;
  onClose: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ settings, onUpdate, onClose }) => {
  const [local, setLocal] = useState<ProjectSettings>({
    ...settings,
    cicd: settings.cicd ?? DEFAULT_CICD_CONFIG,
  });
  const [activeTab, setActiveTab] = useState<'general' | 'cicd'>('general');

  const cicd = local.cicd;
  const updateCICD = (patch: Partial<CICDConfig>) =>
    setLocal(prev => ({ ...prev, cicd: { ...prev.cicd, ...patch } }));

  const save = () => { onUpdate(local); onClose(); };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[520px] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <h2 className="text-sm font-bold text-slate-800">Project Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 mt-3">
          {([
            { id: 'general' as const, label: 'General', icon: <Settings size={12} /> },
            { id: 'cicd' as const, label: 'CI / CD', icon: <Rocket size={12} /> },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#FF3621] text-[#FF3621]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Cloud Provider */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Cloud Provider
                </p>
                <div className="flex gap-2">
                  {([
                    { id: 'aws' as CloudProvider, label: 'AWS' },
                    { id: 'azure' as CloudProvider, label: 'Azure' },
                    { id: 'gcp' as CloudProvider, label: 'GCP' },
                  ]).map(c => (
                    <button
                      key={c.id}
                      onClick={() => setLocal(prev => ({ ...prev, cloud: c.id }))}
                      className={`flex-1 px-3 py-2 rounded-lg border text-[11px] font-semibold transition-all ${
                        local.cloud === c.id
                          ? 'border-[#FF3621] bg-[#FF3621]/5 text-[#FF3621]'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Determines CI/CD auth blocks in the generated scaffold.
                </p>
              </div>

              {/* Lakebase Checkpointing */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Lakebase Checkpointing
                </p>

                <label className="flex items-center gap-2.5 cursor-pointer select-none mb-3">
                  <Toggle
                    checked={local.checkpointEnabled}
                    onChange={v => setLocal(prev => ({ ...prev, checkpointEnabled: v }))}
                  />
                  <span className="text-[12px] font-medium text-slate-700">Enable conversation checkpointing</span>
                </label>

                {local.checkpointEnabled && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Instance Name
                      </label>
                      <input
                        className={inputCls}
                        placeholder="my-lakebase-instance"
                        value={local.checkpointInstanceName}
                        onChange={e => setLocal(prev => ({ ...prev, checkpointInstanceName: e.target.value }))}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Thread ID priority:{' '}
                      <code className="text-slate-500">custom_inputs.conversation_id</code> → new{' '}
                      <code className="text-slate-500">uuid7()</code> per request.
                    </p>
                  </div>
                )}
              </div>

              {/* Evaluation */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Evaluation
                </p>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Eval Dataset Source
                  </label>
                  <select
                    className={inputCls}
                    value={local.evalDatasetSource}
                    onChange={e => setLocal(prev => ({ ...prev, evalDatasetSource: e.target.value as EvalDatasetSource }))}
                  >
                    <option value="synthetic">Synthetic — generate a golden dataset with an LLM simulator</option>
                    <option value="manual">Manual — scaffold a notebook with example rows to fill in</option>
                    <option value="production_traces">Production traces — build from traces filtered by tag</option>
                    <option value="existing">Existing — skip dataset creation (I already have one)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    How the evaluation dataset for this agent is created.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cicd' && (
            <div className="space-y-5">
              {/* Enable CI/CD */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <Toggle
                  checked={cicd.enabled}
                  onChange={v => updateCICD({ enabled: v })}
                  color="#FF3621"
                />
                <span className="text-[12px] font-medium text-slate-700">Enable CI/CD pipeline</span>
              </label>

              {cicd.enabled && (
                <>
                  {/* Provider */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Provider</p>
                    <div className="flex gap-2">
                      {CICD_PROVIDERS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => updateCICD({ provider: p.id })}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-semibold transition-all ${
                            cicd.provider === p.id
                              ? 'border-[#FF3621] bg-[#FF3621]/5 text-[#FF3621]'
                              : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-[9px] font-bold bg-slate-100 rounded px-1 py-0.5">{p.icon}</span>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Environments */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Environments</p>
                    <div className="space-y-3">
                      <EnvironmentFields
                        label="Staging"
                        env={cicd.staging}
                        onChange={staging => updateCICD({ staging })}
                        color="#f59e0b"
                      />
                      <div className="flex justify-center">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <ArrowRight size={14} />
                        </div>
                      </div>
                      <EnvironmentFields
                        label="Production"
                        env={cicd.production}
                        onChange={production => updateCICD({ production })}
                        color="#22c55e"
                      />
                    </div>
                  </div>

                  {/* Promotion Gate */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Promotion Gate</p>
                    <div className="space-y-1.5">
                      {PROMOTION_GATES.map(gate => (
                        <label
                          key={gate.id}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                            cicd.promotionGate === gate.id
                              ? 'border-[#FF3621] bg-[#FF3621]/5'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="promotionGate"
                            checked={cicd.promotionGate === gate.id}
                            onChange={() => updateCICD({ promotionGate: gate.id })}
                            className="mt-0.5 accent-[#FF3621]"
                          />
                          <div>
                            <span className="text-[11px] font-semibold text-slate-700">{gate.label}</span>
                            <p className="text-[10px] text-slate-400 mt-0.5">{gate.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    {cicd.promotionGate === 'evaluation_threshold' && (
                      <div className="mt-3 ml-6">
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                          Minimum Score: {cicd.evaluationThreshold}%
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={cicd.evaluationThreshold}
                          onChange={e => updateCICD({ evaluationThreshold: parseInt(e.target.value) })}
                          className="w-full h-1.5 rounded appearance-none cursor-pointer accent-[#FF3621]"
                        />
                        <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                          <span>0%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Run evaluation on deploy */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <Toggle
                      checked={cicd.runEvaluationOnDeploy}
                      onChange={v => updateCICD({ runEvaluationOnDeploy: v })}
                    />
                    <div>
                      <span className="text-[12px] font-medium text-slate-700">Run evaluation on staging deploy</span>
                      <p className="text-[10px] text-slate-400">Execute agent evaluation suite after deploying to staging</p>
                    </div>
                  </label>

                  {/* Pipeline preview */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Pipeline Preview</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: 'Push', icon: <Code2 size={10} />, color: '#6366f1' },
                        { label: 'Validate', icon: <ShieldCheck size={10} />, color: '#0ea5e9' },
                        { label: 'Deploy Staging', icon: <Rocket size={10} />, color: '#f59e0b' },
                        ...(cicd.runEvaluationOnDeploy
                          ? [{ label: 'Evaluate', icon: <FlaskConical size={10} />, color: '#8b5cf6' }]
                          : []),
                        { label: cicd.promotionGate === 'manual' ? 'Approve' : 'Gate', icon: <ShieldCheck size={10} />, color: '#ef4444' },
                        { label: 'Deploy Prod', icon: <Rocket size={10} />, color: '#22c55e' },
                      ].map((step, i, arr) => (
                        <React.Fragment key={step.label}>
                          <div
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-white"
                            style={{ backgroundColor: step.color }}
                          >
                            {step.icon}
                            {step.label}
                          </div>
                          {i < arr.length - 1 && <ArrowRight size={10} className="text-slate-300" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-slate-100">
          <button
            onClick={save}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#FF3621] hover:bg-[#e02d1a] text-white text-xs font-semibold rounded-md transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Drop Preview ──────────────────────────────────────────────────────────────
// A small helper exported for drag-type display on the canvas

export const getDefaultSize = (type: AgentNodeType) => DEFAULT_NODE_SIZE[type];
export const getDefaultConfig = (type: AgentNodeType) => ({ ...DEFAULT_CONFIGS[type] });
