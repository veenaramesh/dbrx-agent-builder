import Mustache from 'mustache';
import JSZip from 'jszip';
import { AgentNodeData, EdgeData } from '../types';
import { generateAgentCode } from './index';

import readmeTpl from './templates/dab/readme.mustache?raw';

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
}

export const buildBundleConfig = (
  nodes: AgentNodeData[],
  agentName: string
): BundleConfig => {
  const llmNode  = nodes.find(n => n.type === 'llm');
  const vsNodes  = nodes.filter(n => n.type === 'vector_search');
  const ucfNodes = nodes.filter(n => n.type === 'uc_function');

  const llmCfg = llmNode?.config as { endpointName: string; model: string } | undefined;
  const vsCfg  = vsNodes[0]?.config as { endpointName: string } | undefined;
  const ucfCfg = ucfNodes[0]?.config as { catalog: string } | undefined;

  return {
    project_name:           toProjectName(agentName),
    uc_catalog:             ucfCfg?.catalog ?? 'main',
    databricks_host:        'https://',                    // user fills in
    include_retriever:      vsNodes.length  > 0 ? 'yes' : 'no',
    include_tools:          ucfNodes.length > 0 ? 'yes' : 'no',
    include_agent:          'yes',
    include_evaluation:     'yes',
    vector_search_endpoint: vsCfg?.endpointName || 'vs_endpoint',
    llm_model_name:         llmCfg?.endpointName ?? 'databricks-meta-llama-3-3-70b-instruct',
    github_runner_group:    'Default',
  };
};

// ── Project files ─────────────────────────────────────────────────────────────

export interface ProjectFile {
  path: string;
  content: string;
}

export const generateProject = (
  nodes: AgentNodeData[],
  edges: EdgeData[],
  agentName: string
): ProjectFile[] => {
  const config     = buildBundleConfig(nodes, agentName);
  const vsNodes    = nodes.filter(n => n.type === 'vector_search');
  const ucfNodes   = nodes.filter(n => n.type === 'uc_function');
  const llmNode    = nodes.find(n => n.type === 'llm');
  const llmCfg     = llmNode?.config as { endpointName: string } | undefined;

  const readmeView = {
    agentName,
    projectName:         config.project_name,
    hasVectorSearch:     vsNodes.length > 0,
    hasUCFunctions:      ucfNodes.length > 0,
    llmEndpoint:         llmCfg?.endpointName ?? '',
    includeEvaluation:   true,
  };

  return [
    {
      path:    'config.json',
      content: JSON.stringify(config, null, 2),
    },
    {
      path:    'src/agent.py',
      content: generateAgentCode(nodes, edges, agentName),
    },
    {
      path:    'README.md',
      content: Mustache.render(readmeTpl, readmeView),
    },
  ];
};

// ── ZIP download ──────────────────────────────────────────────────────────────

export const downloadProjectZip = async (
  nodes: AgentNodeData[],
  edges: EdgeData[],
  agentName: string
): Promise<void> => {
  const config  = buildBundleConfig(nodes, agentName);
  const files   = generateProject(nodes, edges, agentName);

  const zip     = new JSZip();
  const folder  = zip.folder(config.project_name)!;
  files.forEach(({ path, content }) => folder.file(path, content));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${config.project_name}.zip`;
  a.click();
  URL.revokeObjectURL(url);
};
