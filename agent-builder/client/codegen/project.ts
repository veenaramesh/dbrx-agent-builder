import Mustache from 'mustache';
import JSZip from 'jszip';
import { AgentNodeData, EdgeData } from '../types';
import { generateAgentCode } from './index';

import databricksYmlTpl from './templates/dab/databricks.yml.mustache?raw';
import resourcesTpl from './templates/dab/resources.yml.mustache?raw';
import requirementsTpl from './templates/dab/requirements.mustache?raw';
import readmeTpl from './templates/dab/readme.mustache?raw';

export interface ProjectFile {
  path: string;   // relative path inside the zip folder
  content: string;
}

export const generateProject = (
  nodes: AgentNodeData[],
  edges: EdgeData[],
  agentName: string
): ProjectFile[] => {
  const bundleName = agentName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const llmNode  = nodes.find(n => n.type === 'llm');
  const vsNodes  = nodes.filter(n => n.type === 'vector_search');
  const ucfNodes = nodes.filter(n => n.type === 'uc_function');

  const view = {
    agentName,
    bundleName,
    llmEndpoint:     llmNode ? (llmNode.config as { endpointName: string }).endpointName : '',
    hasVectorSearch: vsNodes.length > 0,
    hasUCFunctions:  ucfNodes.length > 0,
  };

  return [
    { path: 'databricks.yml',                content: Mustache.render(databricksYmlTpl, view) },
    { path: 'resources/agent_deployment.yml', content: Mustache.render(resourcesTpl, view) },
    { path: 'requirements.txt',               content: Mustache.render(requirementsTpl, view) },
    { path: 'README.md',                      content: Mustache.render(readmeTpl, view) },
    { path: 'src/agent.py',                   content: generateAgentCode(nodes, edges, agentName) },
  ];
};

export const downloadProjectZip = async (
  nodes: AgentNodeData[],
  edges: EdgeData[],
  agentName: string
): Promise<void> => {
  const bundleName = agentName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const files = generateProject(nodes, edges, agentName);

  const zip = new JSZip();
  const folder = zip.folder(bundleName)!;
  files.forEach(({ path, content }) => folder.file(path, content));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${bundleName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
};
