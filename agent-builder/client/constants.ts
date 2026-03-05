
import { AgentNodeType, AgentNodeData, EdgeData, LLMConfig, VectorSearchConfig, UCFunctionConfig, AgentConfig, GroupConfig } from './types';

export const GRID_SIZE = 20;

export const NODE_COLORS: Record<AgentNodeType, {
  headerBg: string;
  headerText: string;
  borderColor: string;
  label: string;
}> = {
  agent: {
    headerBg: '#dbeafe',
    headerText: '#1d4ed8',
    borderColor: '#2272B4',
    label: 'Agent',
  },
  llm: {
    headerBg: '#fee2e2',
    headerText: '#991b1b',
    borderColor: '#FF3621',
    label: 'LLM',
  },
  vector_search: {
    headerBg: '#dcfce7',
    headerText: '#166534',
    borderColor: '#00A972',
    label: 'Vector Search',
  },
  uc_function: {
    headerBg: '#fef9c3',
    headerText: '#92400e',
    borderColor: '#F7A600',
    label: 'UC Function',
  },
  group: {
    headerBg: '#ede9fe',
    headerText: '#5b21b6',
    borderColor: '#7c3aed',
    label: 'Group',
  },
};

export const DATABRICKS_MODELS = [
  'databricks-meta-llama-3-3-70b-instruct',
  'databricks-meta-llama-3-1-405b-instruct',
  'databricks-meta-llama-3-1-70b-instruct',
  'databricks-dbrx-instruct',
  'databricks-mixtral-8x7b-instruct',
  'databricks-claude-3-7-sonnet',
  'databricks-gemini-2-0-flash-001',
];

export const DEFAULT_NODE_SIZE: Record<AgentNodeType, { width: number; height: number }> = {
  agent: { width: 180, height: 100 },
  llm: { width: 180, height: 110 },
  vector_search: { width: 190, height: 110 },
  uc_function: { width: 180, height: 90 },
  group: { width: 320, height: 220 },
};

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  endpointName: 'databricks-meta-llama-3-3-70b-instruct',
  model: 'databricks-meta-llama-3-3-70b-instruct',
  maxTokens: 1000,
  temperature: 0.1,
  systemPrompt: 'You are a helpful assistant.',
  maxIterations: 10,
};

export const DEFAULT_VECTOR_SEARCH_CONFIG: VectorSearchConfig = {
  endpointName: '',
  indexName: 'main.default.my_index',
  columns: 'id, content',
  numResults: 5,
  textColumn: 'content',
};

export const DEFAULT_UC_FUNCTION_CONFIG: UCFunctionConfig = {
  catalog: 'main',
  schema: 'default',
  functionName: 'my_function',
  description: '',
  deploy: true,
};

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  description: 'Routes between worker agents based on the query',
};

export const DEFAULT_GROUP_CONFIG: GroupConfig = {
  description: '',
};

export const DEFAULT_CONFIGS = {
  agent: DEFAULT_AGENT_CONFIG,
  llm: DEFAULT_LLM_CONFIG,
  vector_search: DEFAULT_VECTOR_SEARCH_CONFIG,
  uc_function: DEFAULT_UC_FUNCTION_CONFIG,
  group: DEFAULT_GROUP_CONFIG,
};

export const INITIAL_NODES: AgentNodeData[] = [
  {
    id: 'ucf-1',
    type: 'uc_function',
    label: 'search_knowledge_base',
    config: { catalog: 'main', schema: 'tools', functionName: 'search_knowledge_base', description: 'Search the knowledge base for relevant documents', deploy: true },
    x: 80, y: 120, width: 190, height: 90,
  },
  {
    id: 'ucf-2',
    type: 'uc_function',
    label: 'get_user_profile',
    config: { catalog: 'main', schema: 'tools', functionName: 'get_user_profile', description: 'Fetch user profile data', deploy: true },
    x: 80, y: 260, width: 190, height: 90,
  },
  {
    id: 'vs-1',
    type: 'vector_search',
    label: 'Product Docs Index',
    config: { endpointName: 'vs-endpoint', indexName: 'main.rag.product_docs_index', columns: 'id, content, source', numResults: 5, textColumn: 'content' },
    x: 80, y: 400, width: 190, height: 110,
  },
  {
    id: 'llm-1',
    type: 'llm',
    label: 'Llama 3.3 70B',
    config: { endpointName: 'databricks-meta-llama-3-3-70b-instruct', model: 'databricks-meta-llama-3-3-70b-instruct', maxTokens: 1024, temperature: 0.1, systemPrompt: 'You are a helpful customer support agent. Be concise and accurate.', maxIterations: 10 },
    x: 460, y: 260, width: 190, height: 110,
  },
];

export const INITIAL_EDGES: EdgeData[] = [
  { id: 'e1', source: 'ucf-1', target: 'llm-1', sourcePort: 'right', targetPort: 'left' },
  { id: 'e2', source: 'ucf-2', target: 'llm-1', sourcePort: 'right', targetPort: 'left' },
  { id: 'e3', source: 'vs-1', target: 'llm-1', sourcePort: 'right', targetPort: 'left' },
];
