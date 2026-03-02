import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer2, Hand, Cable, Undo2, Redo2,
  Bot, Cpu, Search, Wrench, X, Copy, Check,
  ChevronDown, ChevronRight, Code2, Trash2, Copy as CopyIcon,
} from 'lucide-react';
import { ToolType, AgentNodeData, AgentNodeType, LLMConfig, VectorSearchConfig, UCFunctionConfig, AgentConfig } from '../types';
import { NODE_COLORS, DATABRICKS_MODELS, DEFAULT_NODE_SIZE, DEFAULT_CONFIGS } from '../constants';

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
  onAgentNameChange: (name: string) => void;
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
  onAgentNameChange,
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
          Agent<span className="text-[#FF3621]">Builder</span>
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

      {/* Export Code */}
      <button
        onClick={onExportCode}
        className="flex items-center gap-2 px-3 h-8 bg-[#FF3621] hover:bg-[#e02d1a] text-white text-xs font-semibold rounded-md transition-colors"
        title="Export Agent Code"
      >
        <Code2 size={14} />
        Export Code
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
    title: 'Orchestration',
    items: [
      { type: 'agent', label: 'Agent', description: 'AI agent that orchestrates tools and models' },
    ],
  },
  {
    title: 'Models',
    items: [
      { type: 'llm', label: 'LLM', description: 'Databricks Foundation Model endpoint' },
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
    ],
  },
];

const sidebarIcons: Record<AgentNodeType, React.ReactNode> = {
  agent: <Bot size={14} />,
  llm: <Cpu size={14} />,
  vector_search: <Search size={14} />,
  uc_function: <Wrench size={14} />,
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
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Components</p>
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
        <p>• Drag components onto canvas</p>
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
}) => {
  if (!selectedNode) return null;

  const colors = NODE_COLORS[selectedNode.type];

  const updateConfig = (patch: Partial<LLMConfig & VectorSearchConfig & UCFunctionConfig & AgentConfig>) => {
    onUpdateNode({ ...selectedNode, config: { ...selectedNode.config, ...patch } });
  };

  const updateLabel = (label: string) => onUpdateNode({ ...selectedNode, label });

  const cfg = selectedNode.config as LLMConfig & VectorSearchConfig & UCFunctionConfig & AgentConfig;

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

        {/* ── Agent ── */}
        {selectedNode.type === 'agent' && (
          <>
            <Field label="Description">
              <textarea
                className={textareaCls}
                rows={3}
                value={cfg.description ?? ''}
                onChange={(e) => updateConfig({ description: e.target.value })}
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
          </>
        )}

        {/* ── LLM ── */}
        {selectedNode.type === 'llm' && (
          <>
            <Field label="Endpoint / Model">
              <select
                className={inputCls}
                value={cfg.model ?? DATABRICKS_MODELS[0]}
                onChange={(e) => updateConfig({ model: e.target.value, endpointName: e.target.value })}
              >
                {DATABRICKS_MODELS.map(m => (
                  <option key={m} value={m}>{m.replace('databricks-', '')}</option>
                ))}
                <option value="__custom__">Custom endpoint…</option>
              </select>
            </Field>
            {(cfg.model === '__custom__' || !DATABRICKS_MODELS.includes(cfg.endpointName ?? '')) && (
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

// ── Code Export Modal ─────────────────────────────────────────────────────────

const DAB_INIT_COMMAND = 'databricks bundle init https://github.com/veenaramesh/agentops-demo --config-file config.json';

interface CodeExportModalProps {
  code: string;
  configJson: string;
  onClose: () => void;
}

export const CodeExportModal: React.FC<CodeExportModalProps> = ({ code, configJson, onClose }) => {
  const [tab, setTab] = useState<'agent' | 'config'>('agent');
  const [copied, setCopied] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const activeContent = tab === 'agent' ? code : configJson;
  const activeLabel   = tab === 'agent' ? 'agent.py' : 'config.json';

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
            <span className="text-sm font-bold text-white">Generated Agent Code</span>
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
          {(['agent', 'config'] as const).map((t) => {
            const label = t === 'agent' ? 'agent.py' : 'config.json';
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => { setTab(t); setCopied(false); }}
                className={`px-4 py-2 text-[11px] font-mono font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-[#FF3621] text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
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
        <div className="px-4 py-2.5 border-t border-[#34606f] text-[10px] text-slate-500">
          Run <code className="text-slate-300 mx-1">databricks bundle init https://github.com/veenaramesh/agentops-demo --config-file config.json</code> to scaffold your project.
        </div>
      </div>
    </div>
  );
};

// ── Drop Preview ──────────────────────────────────────────────────────────────
// A small helper exported for drag-type display on the canvas

export const getDefaultSize = (type: AgentNodeType) => DEFAULT_NODE_SIZE[type];
export const getDefaultConfig = (type: AgentNodeType) => ({ ...DEFAULT_CONFIGS[type] });
