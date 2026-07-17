import JSZip from 'jszip';
import Mustache from 'mustache';
import { AgentNodeData, CICDConfig, CloudProvider, EdgeData, LakebaseConfig, LLMConfig, MemoryType, ProjectSettings, UCFunctionConfig, VectorSearchConfig } from '../types';
import { DEFAULT_CICD_CONFIG } from '../constants';
// @ts-ignore
import readmeTpl from './templates/dab/readme.mustache?raw';

// ── Config JSON ───────────────────────────────────────────────────────────────
// Maps canvas state → key-value pairs for:
//   databricks bundle init https://github.com/databricks-solutions/agentops-stacks \
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

interface LakebaseDef {
  name: string;          // toSnakeCase(node.label)
  instance_name: string;
  description: string;
}

// AgentDef: one LLM node = one independent agent (src/agents/<name>/).
// Agents don't orchestrate each other — they're peers that may reuse the same
// tool/retriever/lakebase components (src/components/).
interface AgentDef {
  name: string;               // toSnakeCase(node.label)
  endpoint_name: string;      // cfg.endpointName
  model: string;              // cfg.model
  system_prompt: string;      // cfg.systemPrompt
  max_iterations: number;     // cfg.maxIterations — controls inner ReAct loop
  tools: ToolDef[];           // ucf nodes wired → this agent
  retrievers: RetrieverDef[]; // vs nodes wired → this agent
  lakebase_tools: LakebaseDef[]; // lakebase nodes wired → this agent
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
  llm_max_iterations: number;
  github_runner_group: string;
  // All nodes (for stubs, resource YAMLs, deployment notebooks)
  tools: ToolDef[];
  retrievers: RetrieverDef[];
  // All agents (one per LLM node); each carries the components wired to it.
  agents: AgentDef[];
  has_lakebase: boolean;
  lakebase_instance_name: string;
  // CI/CD
  cicd: CICDConfig;
}

// ── AgentOps Stacks config (maps graph → databricks_template_schema.json) ────

export interface AgentOpsStacksConfig {
  input_project_name: string;
  input_root_dir: string;
  input_initial_agent_name: string;
  input_cloud: 'aws' | 'azure' | 'gcp';
  input_cicd_platform: 'github_actions' | 'github_actions_for_github_enterprise_servers' | 'azure_devops' | 'gitlab';
  input_use_vector_search: 'yes' | 'no';
  input_has_chunked_table: 'yes' | 'no';
  input_use_lakebase: 'yes' | 'no';
  input_memory_type: 'short_term' | 'long_term' | 'both';
  input_use_uc_functions: 'yes' | 'no';
  input_uc_functions_exist: 'yes' | 'no';
  input_eval_dataset_source: 'synthetic' | 'manual' | 'production_traces' | 'existing';
}

// Map our CICDProvider to agentops-stacks enum values
const mapCICDProvider = (provider: string): AgentOpsStacksConfig['input_cicd_platform'] => {
  switch (provider) {
    case 'azure_devops':  return 'azure_devops';
    case 'gitlab_ci':     return 'gitlab';
    default:              return 'github_actions';
  }
};

export const buildAgentOpsStacksConfig = (
  nodes: AgentNodeData[],
  edges: EdgeData[],
  agentName: string,
  settings?: ProjectSettings,
): AgentOpsStacksConfig => {
  const projectName = toProjectName(agentName);
  const llmNodes  = nodes.filter(n => n.type === 'llm');
  const vsNodes   = nodes.filter(n => n.type === 'vector_search');
  const ucfNodes  = nodes.filter(n => n.type === 'uc_function');
  const lbNodes   = nodes.filter(n => n.type === 'lakebase');

  // Initial agent name: first LLM label, snake-cased, or 'default'
  const firstLLM = llmNodes[0];
  const initialAgentName = firstLLM
    ? toSnakeCase(firstLLM.label) || 'default'
    : 'default';

  // Vector search: use first VS node's hasChunkedTable config
  const hasVS = vsNodes.length > 0;
  const firstVSCfg = vsNodes[0]?.config as VectorSearchConfig | undefined;
  const hasChunkedTable = firstVSCfg?.hasChunkedTable ?? false;

  // Lakebase: derive from nodes or project settings
  const hasLakebase = lbNodes.length > 0 || (settings?.checkpointEnabled ?? false);
  const firstLBCfg = lbNodes[0]?.config as LakebaseConfig | undefined;
  const memoryType: MemoryType = firstLBCfg?.memoryType ?? 'short_term';

  // UC functions: if ALL have deploy=false, they already exist
  const hasUCF = ucfNodes.length > 0;
  const allExist = ucfNodes.length > 0 && ucfNodes.every(n => !(n.config as UCFunctionConfig).deploy);

  return {
    input_project_name:      projectName,
    input_root_dir:          projectName,
    input_initial_agent_name: initialAgentName,
    input_cloud:             settings?.cloud ?? 'aws',
    input_cicd_platform:     mapCICDProvider(settings?.cicd?.provider ?? 'github_actions'),
    input_use_vector_search: hasVS ? 'yes' : 'no',
    input_has_chunked_table: hasVS && hasChunkedTable ? 'yes' : 'no',
    input_use_lakebase:      hasLakebase ? 'yes' : 'no',
    input_memory_type:       memoryType,
    input_use_uc_functions:  hasUCF ? 'yes' : 'no',
    input_uc_functions_exist: hasUCF && allExist ? 'yes' : 'no',
    input_eval_dataset_source: settings?.evalDatasetSource ?? 'synthetic',
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeToolDef = (n: AgentNodeData): ToolDef => {
  const cfg = n.config as UCFunctionConfig;
  return { name: cfg.functionName, catalog: cfg.catalog, schema: cfg.schema, description: cfg.description, deploy: cfg.deploy ?? true };
};

const makeLakebaseDef = (n: AgentNodeData): LakebaseDef => {
  const cfg = n.config as LakebaseConfig;
  return {
    name:          toSnakeCase(n.label) || 'lakebase_tool',
    instance_name: cfg.instanceName,
    description:   cfg.description ?? '',
  };
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
  settings?: ProjectSettings,
): BundleConfig => {
  // Group nodes are visual-only. Everything else is a code node.
  const codeNodes = nodes.filter(n => n.type !== 'group');
  const lbNodes   = codeNodes.filter(n => n.type === 'lakebase');
  const llmNodes  = codeNodes.filter(n => n.type === 'llm');
  const vsNodes   = codeNodes.filter(n => n.type === 'vector_search');
  const ucfNodes  = codeNodes.filter(n => n.type === 'uc_function');

  const firstLLMCfg = llmNodes[0]?.config as LLMConfig | undefined;
  const vsCfg       = vsNodes[0]?.config as VectorSearchConfig | undefined;
  const ucfCfg      = ucfNodes[0]?.config as UCFunctionConfig | undefined;

  // ── Shared components (for stubs / resource YAMLs) ────────────────────────
  // A component wired to multiple agents is reused across them (src/components/).
  const tools      = ucfNodes.map(makeToolDef);
  const retrievers = vsNodes.map(makeRetrieverDef);

  // ── Agents: one per LLM node ──────────────────────────────────────────────
  // Each agent owns the tool/retriever/lakebase nodes wired directly into it.
  // Agents are peers — no orchestration between them.
  const agents: AgentDef[] = llmNodes.map((llmNode, i) => {
    const cfg = llmNode.config as LLMConfig;
    const connected = new Set(
      edges.filter(e => e.target === llmNode.id).map(e => e.source)
    );
    return {
      name:           toSnakeCase(llmNode.label) || `agent_${i + 1}`,
      endpoint_name:  cfg.endpointName,
      model:          cfg.model,
      system_prompt:  cfg.systemPrompt ?? '',
      max_iterations: cfg.maxIterations ?? 10,
      tools:          ucfNodes.filter(n => connected.has(n.id)).map(makeToolDef),
      retrievers:     vsNodes.filter(n => connected.has(n.id)).map(makeRetrieverDef),
      lakebase_tools: lbNodes.filter(n => connected.has(n.id)).map(makeLakebaseDef),
    };
  });

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
    llm_max_iterations:     firstLLMCfg?.maxIterations ?? 10,
    github_runner_group:    'Default',
    tools,
    retrievers,
    agents,
    has_lakebase:           settings?.checkpointEnabled ?? false,
    lakebase_instance_name: settings?.checkpointInstanceName ?? '',
    cicd:                   settings?.cicd ?? DEFAULT_CICD_CONFIG,
  };
};

// ── CI/CD workflow generation ─────────────────────────────────────────────────

export const generateCICDWorkflow = (config: BundleConfig): string => {
  const { cicd, project_name } = config;
  if (!cicd.enabled) return '';

  switch (cicd.provider) {
    case 'github_actions':  return generateGitHubActionsWorkflow(config);
    case 'azure_devops':    return generateAzureDevOpsWorkflow(config);
    case 'gitlab_ci':       return generateGitLabCIWorkflow(config);
    default:                return '';
  }
};

const evaluationStep = (config: BundleConfig, indent: string, envLabel: string) => {
  if (!config.cicd.runEvaluationOnDeploy) return '';
  const lines = [
    '',
    `${indent}- name: Run Agent Evaluation (${envLabel})`,
    `${indent}  run: |`,
    `${indent}    databricks bundle run ${config.project_name}_evaluation`,
  ];
  if (config.cicd.promotionGate === 'evaluation_threshold') {
    lines.push(
      `${indent}    # Check evaluation score meets threshold`,
      `${indent}    score=$(databricks bundle run ${config.project_name}_evaluation --output json | jq -r '.score')`,
      `${indent}    if (( $(echo "$score < ${config.cicd.evaluationThreshold / 100}" | bc -l) )); then`,
      `${indent}      echo "Evaluation score $score below threshold ${config.cicd.evaluationThreshold}%"`,
      `${indent}      exit 1`,
      `${indent}    fi`,
    );
  }
  return lines.join('\n');
};

const generateGitHubActionsWorkflow = (config: BundleConfig): string => {
  const { cicd, project_name } = config;
  const needsApproval = cicd.promotionGate === 'manual';

  return `name: Deploy ${project_name}

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

jobs:
  validate:
    name: Validate Bundle
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: databricks/setup-cli@main
      - name: Validate bundle
        run: databricks bundle validate
        env:
          DATABRICKS_HOST: \${{ secrets.STAGING_DATABRICKS_HOST }}
          DATABRICKS_TOKEN: \${{ secrets.STAGING_DATABRICKS_TOKEN }}

  deploy-staging:
    name: Deploy to Staging
    needs: validate
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: databricks/setup-cli@main
      - name: Deploy to staging
        run: databricks bundle deploy --target staging
        env:
          DATABRICKS_HOST: \${{ secrets.STAGING_DATABRICKS_HOST }}
          DATABRICKS_TOKEN: \${{ secrets.STAGING_DATABRICKS_TOKEN }}${evaluationStep(config, '      ', 'Staging')}

  deploy-production:
    name: Deploy to Production
    needs: deploy-staging${needsApproval ? '\n    # Requires manual approval in GitHub environment settings' : ''}
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: databricks/setup-cli@main
      - name: Deploy to production
        run: databricks bundle deploy --target production
        env:
          DATABRICKS_HOST: \${{ secrets.PROD_DATABRICKS_HOST }}
          DATABRICKS_TOKEN: \${{ secrets.PROD_DATABRICKS_TOKEN }}
`;
};

const generateAzureDevOpsWorkflow = (config: BundleConfig): string => {
  const { cicd, project_name } = config;

  return `trigger:
  branches:
    include:
      - main

pool:
  vmImage: 'ubuntu-latest'

stages:
  - stage: Validate
    displayName: 'Validate Bundle'
    jobs:
      - job: validate
        steps:
          - task: UsePythonVersion@0
            inputs:
              versionSpec: '3.10'
          - script: |
              curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh
              databricks bundle validate
            env:
              DATABRICKS_HOST: $(STAGING_DATABRICKS_HOST)
              DATABRICKS_TOKEN: $(STAGING_DATABRICKS_TOKEN)

  - stage: DeployStaging
    displayName: 'Deploy to Staging'
    dependsOn: Validate
    jobs:
      - deployment: staging
        environment: staging
        strategy:
          runOnce:
            deploy:
              steps:
                - script: |
                    curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh
                    databricks bundle deploy --target staging
                  env:
                    DATABRICKS_HOST: $(STAGING_DATABRICKS_HOST)
                    DATABRICKS_TOKEN: $(STAGING_DATABRICKS_TOKEN)

  - stage: DeployProduction
    displayName: 'Deploy to Production'
    dependsOn: DeployStaging
    jobs:
      - deployment: production
        environment: production
        strategy:
          runOnce:
            deploy:
              steps:
                - script: |
                    curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh
                    databricks bundle deploy --target production
                  env:
                    DATABRICKS_HOST: $(PROD_DATABRICKS_HOST)
                    DATABRICKS_TOKEN: $(PROD_DATABRICKS_TOKEN)
`;
};

const generateGitLabCIWorkflow = (config: BundleConfig): string => {
  const { cicd, project_name } = config;

  return `stages:
  - validate
  - deploy-staging
  - deploy-production

variables:
  DATABRICKS_CLI_VERSION: "latest"

.setup-cli: &setup-cli
  before_script:
    - curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh

validate:
  stage: validate
  <<: *setup-cli
  script:
    - databricks bundle validate
  variables:
    DATABRICKS_HOST: $STAGING_DATABRICKS_HOST
    DATABRICKS_TOKEN: $STAGING_DATABRICKS_TOKEN

deploy-staging:
  stage: deploy-staging
  <<: *setup-cli
  script:
    - databricks bundle deploy --target staging
  variables:
    DATABRICKS_HOST: $STAGING_DATABRICKS_HOST
    DATABRICKS_TOKEN: $STAGING_DATABRICKS_TOKEN
  environment:
    name: staging

deploy-production:
  stage: deploy-production
  <<: *setup-cli
  script:
    - databricks bundle deploy --target production
  variables:
    DATABRICKS_HOST: $PROD_DATABRICKS_HOST
    DATABRICKS_TOKEN: $PROD_DATABRICKS_TOKEN
  environment:
    name: production
  when: ${cicd.promotionGate === 'manual' ? 'manual' : 'on_success'}
`;
};

// ── ZIP download (client-side) ────────────────────────────────────────────────

const CICD_PATHS: Record<string, string> = {
  github_actions: '.github/workflows/deploy.yml',
  azure_devops:   'azure-pipelines.yml',
  gitlab_ci:      '.gitlab-ci.yml',
};

// buildProjectFiles: the single source of truth for the set of files a project
// exports. Both the ZIP download and the deploy-to-workspace flow reuse this,
// so the two never drift. Returns a { path: content } map plus derived metadata
// the deploy flow needs (project name, initial agent name).
// Registry-shaped tool reference (matches the backend ToolRef / Library card).
export interface RegistryToolRef {
  kind: 'uc_function' | 'vector_search' | 'lakebase';
  label: string;
  detail: string;
}

// A flat, Library-facing summary of one agent's model + components.
export interface AgentSummary {
  name: string;
  model: string;
  endpoint: string;
  tools: RegistryToolRef[];
}

export interface ProjectFiles {
  projectName: string;
  initialAgentName: string;
  files: Record<string, string>;
  // Per-agent summary for Library registration (model, endpoint, tools).
  agents: AgentSummary[];
}

export const buildProjectFiles = (
  nodes: AgentNodeData[],
  edges: EdgeData[],
  agentName: string,
  host?: string,
  settings?: ProjectSettings,
): ProjectFiles => {
  const full = buildBundleConfig(nodes, edges, agentName, host, settings);
  const stacksConfig = buildAgentOpsStacksConfig(nodes, edges, agentName, settings);

  // Manifest = full config minus cicd (that's a separate file).
  const { cicd: _cicd, ...manifest } = full;

  const readme = Mustache.render(readmeTpl, {
    agentName,
    projectName: full.project_name,
    agentCount: full.agents.length,
    initialAgentName: stacksConfig.input_initial_agent_name,
    hasMultipleAgents: full.agents.length > 1,
    hasVectorSearch: full.include_retriever === 'yes',
    hasUCFunctions: full.include_tools === 'yes',
    hasCICD: full.cicd.enabled,
    llmEndpoint: full.llm_model_name,
  });

  const files: Record<string, string> = {
    'config.json': JSON.stringify(stacksConfig, null, 2),
    'agents_manifest.json': JSON.stringify(manifest, null, 2),
    'README.md': readme,
  };

  if (full.cicd.enabled) {
    const cicdYaml = generateCICDWorkflow(full);
    const cicdPath = CICD_PATHS[full.cicd.provider] ?? 'ci-cd.yml';
    if (cicdYaml) files[cicdPath] = cicdYaml;
  }

  const agents: AgentSummary[] = full.agents.map(a => ({
    name: a.name,
    model: a.model,
    endpoint: a.endpoint_name,
    tools: [
      ...a.tools.map(t => ({
        kind: 'uc_function' as const,
        label: t.name,
        detail: `${t.catalog}.${t.schema}`,
      })),
      ...a.retrievers.map(r => ({
        kind: 'vector_search' as const,
        label: r.name,
        detail: r.index_name,
      })),
      ...a.lakebase_tools.map(l => ({
        kind: 'lakebase' as const,
        label: l.name,
        detail: l.instance_name,
      })),
    ],
  }));

  return {
    projectName: full.project_name,
    initialAgentName: stacksConfig.input_initial_agent_name,
    files,
    agents,
  };
};

export const downloadProjectZip = async (
  nodes: AgentNodeData[],
  edges: EdgeData[],
  agentName: string,
  host?: string,
  settings?: ProjectSettings,
): Promise<void> => {
  const { projectName, files } = buildProjectFiles(nodes, edges, agentName, host, settings);

  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${projectName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
};
