
export type AgentNodeType = 'supervisor' | 'router' | 'llm' | 'vector_search' | 'uc_function' | 'group' | 'lakebase';

export interface LLMConfig {
  endpointName: string;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  maxIterations: number;
}

export interface VectorSearchConfig {
  endpointName: string;
  indexName: string;
  columns: string;
  numResults: number;
  textColumn: string;
  hasChunkedTable: boolean; // true = user already has a chunked Delta table; false = scaffold generates ingestion pipeline
}

export interface UCFunctionConfig {
  catalog: string;
  schema: string;
  functionName: string;
  description: string;
  deploy: boolean;  // true = generate stub + deploy via tools bundle; false = call existing UC function
}

export interface RouterConfig {
  description: string;
}

export interface SupervisorConfig {
  description: string;
  maxIterations: number;
}

export interface GroupConfig {
  description: string;
}

export type MemoryType = 'short_term' | 'long_term' | 'both';

export interface LakebaseConfig {
  instanceName: string;
  description: string;
  memoryType: MemoryType; // agent memory type for LangGraph checkpointer
}

export type CloudProvider = 'aws' | 'azure' | 'gcp';

export type CICDProvider = 'github_actions' | 'azure_devops' | 'gitlab_ci';
export type PromotionGate = 'manual' | 'tests_pass' | 'evaluation_threshold';

export interface CICDEnvironment {
  workspaceHost: string;
  catalog: string;
  schema: string;
}

export interface CICDConfig {
  enabled: boolean;
  provider: CICDProvider;
  staging: CICDEnvironment;
  production: CICDEnvironment;
  promotionGate: PromotionGate;
  evaluationThreshold: number; // 0–100, used when promotionGate === 'evaluation_threshold'
  runEvaluationOnDeploy: boolean;
}

export interface ProjectSettings {
  checkpointEnabled: boolean;
  checkpointInstanceName: string;
  cloud: CloudProvider;
  hasEvalDataset: boolean;
  evalScorers: string; // comma-separated: relevance,groundedness,safety,chunk_relevance,guideline_adherence
  cicd: CICDConfig;
}

export type NodeConfig = LLMConfig | VectorSearchConfig | UCFunctionConfig | RouterConfig | SupervisorConfig | GroupConfig | LakebaseConfig;

export interface AgentNodeData {
  id: string;
  type: AgentNodeType;
  label: string;
  config: NodeConfig;
  x: number;
  y: number;
  width: number;
  height: number;
  locked?: boolean;
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
  sourcePort: PortPosition;
  targetPort: PortPosition;
  label?: string;
}

export type PortPosition = 'top' | 'right' | 'bottom' | 'left';

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

export type ToolType = 'select' | 'hand' | 'connect';

export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
