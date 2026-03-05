import { AgentNodeData, EdgeData, LLMConfig, UCFunctionConfig, VectorSearchConfig } from '../types';

// ── Config JSON ───────────────────────────────────────────────────────────────
// Maps canvas state → key-value pairs for:
//   databricks bundle init https://github.com/veenaramesh/agentops-demo \
//     --config-file config.json

const toProjectName = (agentName: string) =>
  agentName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^[^a-z]+/, '') || 'my_agent_project';

const toSnakeCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

// ── Shared sub-types ──────────────────────────────────────────────────────────

interface ToolDef {
  name: string;        // cfg.functionName
  catalog: string;
  schema: string;
  description: string;
  deploy: boolean;     // true = generate stub + deploy; false = call existing
}

interface RetrieverDef {
  name: string;          // toSnakeCase(node.label)
  endpoint_name: string;
  index_name: string;
  text_column: string;
  columns: string;       // comma-separated
  num_results: number;
}

interface WorkerLLMDef {
  name: string;               // toSnakeCase(node.label)
  endpoint_name: string;      // cfg.endpointName
  model: string;              // cfg.model
  tools: ToolDef[];           // ucf nodes → this worker LLM
  retrievers: RetrieverDef[]; // vs nodes → this worker LLM
}

interface SupervisorLLMDef {
  endpoint_name: string;
  model: string;
}

// PipelineLLMDef: one stage in a sequential chain (llm-A → llm-B → ...)
interface PipelineLLMDef {
  name: string;               // toSnakeCase(node.label)
  endpoint_name: string;
  model: string;
  tools: ToolDef[];           // ucf nodes → this stage's LLM
  retrievers: RetrieverDef[]; // vs nodes → this stage's LLM
}

// ParallelBranchDef: one branch in a parallel fan-out (agent → llm-A, agent → llm-B, ...)
interface ParallelBranchDef {
  name: string;               // toSnakeCase(node.label)
  endpoint_name: string;
  model: string;
  tools: ToolDef[];           // ucf nodes → this branch's LLM
  retrievers: RetrieverDef[]; // vs nodes → this branch's LLM
}

// ── BundleConfig ──────────────────────────────────────────────────────────────

export interface BundleConfig {
  project_name: string;
  uc_catalog: string;
  databricks_host: string;
  include_retriever: 'yes' | 'no';
  include_tools: 'yes' | 'no';
  include_agent: 'yes';
  include_evaluation: 'yes' | 'no';
  vector_search_endpoint: string;
  llm_model_name: string;
  github_runner_group: string;
  // All nodes (for stubs, resource YAMLs, deployment notebooks)
  tools: ToolDef[];
  retrievers: RetrieverDef[];
  // Connectivity-filtered: only nodes with edge → agent
  agent_tools: ToolDef[];
  agent_retrievers: RetrieverDef[];
  // Multi-LLM topology
  workflow_pattern: 'single' | 'supervisor_worker' | 'sequential' | 'parallel';
  supervisor_llm: SupervisorLLMDef | null;
  worker_llms: WorkerLLMDef[];
  pipeline_stages: PipelineLLMDef[];   // ordered chain for sequential pattern
  parallel_branches: ParallelBranchDef[]; // branches for parallel fan-out pattern
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeToolDef = (n: AgentNodeData): ToolDef => {
  const cfg = n.config as UCFunctionConfig;
  return { name: cfg.functionName, catalog: cfg.catalog, schema: cfg.schema, description: cfg.description, deploy: cfg.deploy ?? true };
};

const makeRetrieverDef = (n: AgentNodeData): RetrieverDef => {
  const cfg = n.config as VectorSearchConfig;
  return {
    name:          toSnakeCase(n.label) || 'retriever',
    endpoint_name: cfg.endpointName,
    index_name:    cfg.indexName,
    text_column:   cfg.textColumn,
    columns:       cfg.columns,
    num_results:   cfg.numResults,
  };
};

// ── buildBundleConfig ─────────────────────────────────────────────────────────

export const buildBundleConfig = (
  nodes: AgentNodeData[],
  edges: EdgeData[],
  agentName: string,
  host?: string,
): BundleConfig => {
  // Group nodes are purely cosmetic — exclude from codegen
  const codeNodes = nodes.filter(n => n.type !== 'group');
  const agentNode = codeNodes.find(n => n.type === 'agent');
  const llmNodes  = codeNodes.filter(n => n.type === 'llm');
  const vsNodes   = codeNodes.filter(n => n.type === 'vector_search');
  const ucfNodes  = codeNodes.filter(n => n.type === 'uc_function');

  const firstLLMCfg = llmNodes[0]?.config as LLMConfig | undefined;
  const vsCfg       = vsNodes[0]?.config as VectorSearchConfig | undefined;
  const ucfCfg      = ucfNodes[0]?.config as UCFunctionConfig | undefined;

  // ── All nodes (for stubs / resource YAMLs) ────────────────────────────────
  const tools      = ucfNodes.map(makeToolDef);
  const retrievers = vsNodes.map(makeRetrieverDef);

  // ── Connectivity: which nodes have a direct edge → agent (or primary LLM) ─
  // When there's no agent node, tools connect directly to the primary LLM
  // (single tool-calling agent pattern). Use the first LLM as the target.
  const primaryLLMForTools = agentNode ? undefined : llmNodes[0];
  const connectedToAgent = agentNode
    ? new Set(edges.filter(e => e.target === agentNode.id).map(e => e.source))
    : primaryLLMForTools
      ? new Set(edges.filter(e => e.target === primaryLLMForTools.id).map(e => e.source))
      : new Set<string>();

  const agent_tools      = ucfNodes.filter(n => connectedToAgent.has(n.id)).map(makeToolDef);
  const agent_retrievers = vsNodes.filter(n => connectedToAgent.has(n.id)).map(makeRetrieverDef);

  // ── Multi-LLM topology ────────────────────────────────────────────────────

  // LLM-to-LLM edges drive the sequential pipeline pattern.
  const llmToLLMEdges = edges.filter(
    e => llmNodes.some(n => n.id === e.source) && llmNodes.some(n => n.id === e.target)
  );

  // Edges from agent → each LLM node (used for supervisor and parallel detection).
  const agentToLLMEdges = agentNode
    ? edges.filter(e => e.source === agentNode.id && llmNodes.some(n => n.id === e.target))
    : [];

  // Worker LLMs: llm nodes that have an edge INTO the agent (llm → agent).
  // Only relevant when there are no LLM-to-LLM edges.
  const workerLLMNodes = agentNode && llmToLLMEdges.length === 0
    ? llmNodes.filter(n => edges.some(e => e.source === n.id && e.target === agentNode.id))
    : [];

  // Supervisor LLM: the llm node that the agent points TO (agent → llm).
  const supervisorLLMId = agentNode
    ? edges.find(e => e.source === agentNode.id && llmNodes.some(n => n.id === e.target))?.target
    : undefined;
  const supervisorLLMNode = supervisorLLMId
    ? llmNodes.find(n => n.id === supervisorLLMId)
    : llmNodes.find(n => !workerLLMNodes.includes(n)); // fallback: first non-worker LLM

  const supervisor_llm: SupervisorLLMDef | null = supervisorLLMNode
    ? (() => {
        const cfg = supervisorLLMNode.config as LLMConfig;
        return { endpoint_name: cfg.endpointName, model: cfg.model };
      })()
    : null;

  // Each worker gets the ucf/vs nodes connected to it.
  const worker_llms: WorkerLLMDef[] = workerLLMNodes.map(workerNode => {
    const cfg = workerNode.config as LLMConfig;
    const connectedToWorker = new Set(
      edges.filter(e => e.target === workerNode.id).map(e => e.source)
    );
    return {
      name:          toSnakeCase(workerNode.label) || `worker_${workerNode.id}`,
      endpoint_name: cfg.endpointName,
      model:         cfg.model,
      tools:         ucfNodes.filter(n => connectedToWorker.has(n.id)).map(makeToolDef),
      retrievers:    vsNodes.filter(n => connectedToWorker.has(n.id)).map(makeRetrieverDef),
    };
  });

  // ── Sequential pipeline: walk llm→llm edges to build ordered stages ──────
  // Start from the LLM the agent connects to; if none, pick the LLM with no
  // incoming LLM edge (i.e. the head of the chain).
  const llmTargetIds = new Set(llmToLLMEdges.map(e => e.target));
  const chainStart = llmToLLMEdges.length > 0
    ? (supervisorLLMNode ?? llmNodes.find(n => !llmTargetIds.has(n.id)))
    : undefined;

  const pipeline_stages: PipelineLLMDef[] = [];
  if (chainStart) {
    let current: AgentNodeData | undefined = chainStart;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      const cfg = current.config as LLMConfig;
      const connectedToStage = new Set(
        edges.filter(e => e.target === current!.id).map(e => e.source)
      );
      pipeline_stages.push({
        name:          toSnakeCase(current.label) || `stage_${pipeline_stages.length + 1}`,
        endpoint_name: cfg.endpointName,
        model:         cfg.model,
        tools:         ucfNodes.filter(n => connectedToStage.has(n.id)).map(makeToolDef),
        retrievers:    vsNodes.filter(n => connectedToStage.has(n.id)).map(makeRetrieverDef),
      });
      const nextEdge = llmToLLMEdges.find(e => e.source === current!.id);
      current = nextEdge ? llmNodes.find(n => n.id === nextEdge.target) : undefined;
    }
  }

  // Parallel fan-out: agent connects to 2+ LLMs directly, no worker/sequential edges.
  const parallelBranchNodes =
    llmToLLMEdges.length === 0 && workerLLMNodes.length === 0 && agentToLLMEdges.length > 1
      ? agentToLLMEdges.map(e => llmNodes.find(n => n.id === e.target)!).filter(Boolean)
      : [];

  const parallel_branches: ParallelBranchDef[] = parallelBranchNodes.map(branchNode => {
    const cfg = branchNode.config as LLMConfig;
    const connectedToBranch = new Set(
      edges.filter(e => e.target === branchNode.id).map(e => e.source)
    );
    return {
      name:          toSnakeCase(branchNode.label) || `branch_${parallelBranchNodes.indexOf(branchNode) + 1}`,
      endpoint_name: cfg.endpointName,
      model:         cfg.model,
      tools:         ucfNodes.filter(n => connectedToBranch.has(n.id)).map(makeToolDef),
      retrievers:    vsNodes.filter(n => connectedToBranch.has(n.id)).map(makeRetrieverDef),
    };
  });

  const workflow_pattern: 'single' | 'supervisor_worker' | 'sequential' | 'parallel' =
    pipeline_stages.length > 1    ? 'sequential'
    : worker_llms.length > 0      ? 'supervisor_worker'
    : parallel_branches.length > 1 ? 'parallel'
    : 'single';

  return {
    project_name:           toProjectName(agentName),
    uc_catalog:             ucfCfg?.catalog ?? 'main',
    databricks_host:        host ?? 'https://',
    include_retriever:      vsNodes.length  > 0 ? 'yes' : 'no',
    include_tools:          ucfNodes.length > 0 ? 'yes' : 'no',
    include_agent:          'yes',
    include_evaluation:     'yes',
    vector_search_endpoint: vsCfg?.endpointName || 'vs_endpoint',
    llm_model_name:         firstLLMCfg?.endpointName ?? 'databricks-meta-llama-3-3-70b-instruct',
    github_runner_group:    'Default',
    tools,
    retrievers,
    agent_tools,
    agent_retrievers,
    workflow_pattern,
    supervisor_llm,
    worker_llms,
    pipeline_stages,
    parallel_branches,
  };
};

// ── ZIP download ──────────────────────────────────────────────────────────────

export const downloadProjectZip = async (
  nodes: AgentNodeData[],
  edges: EdgeData[],
  agentName: string,
  host?: string,
): Promise<void> => {
  const config = buildBundleConfig(nodes, edges, agentName, host);

  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }
  );

  const blob = await response.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${config.project_name}.zip`;
  a.click();
  URL.revokeObjectURL(url);
};
