import { AgentNodeData } from '../types';
import { EdgeData } from '../types';
import { headerTemplate } from './templates/header';
import { vectorSearchHeaderTemplate, vectorSearchTemplate, VSConfig } from './templates/vectorSearch';
import { ucFunctionsTemplate, UCFTool } from './templates/ucFunctions';
import { llmTemplate } from './templates/llm';
import { agentTemplate, mlflowRegistrationTemplate } from './templates/agent';

export const generateAgentCode = (
  nodes: AgentNodeData[],
  _edges: EdgeData[],
  agentName: string
): string => {
  const agentNode = nodes.find(n => n.type === 'agent');
  const llmNodes = nodes.filter(n => n.type === 'llm');
  const vsNodes = nodes.filter(n => n.type === 'vector_search');
  const ucfNodes = nodes.filter(n => n.type === 'uc_function');

  const sections: string[] = [];

  // 1. Header + imports
  sections.push(headerTemplate(agentName));

  // 2. Vector Search
  if (vsNodes.length > 0) {
    sections.push(vectorSearchHeaderTemplate());
    vsNodes.forEach(vs => {
      const cfg = vs.config as { endpointName: string; indexName: string; textColumn: string; columns: string; numResults: number };
      const vsConfig: VSConfig = {
        varName: vs.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        endpointName: cfg.endpointName,
        indexName: cfg.indexName,
        textColumn: cfg.textColumn,
        columns: cfg.columns,
        numResults: cfg.numResults,
      };
      sections.push(vectorSearchTemplate(vsConfig));
    });
  }

  // 3. UC Functions
  if (ucfNodes.length > 0) {
    const tools: UCFTool[] = ucfNodes.map(ucf => {
      const cfg = ucf.config as { catalog: string; schema: string; functionName: string; description: string };
      return {
        fullName: `${cfg.catalog}.${cfg.schema}.${cfg.functionName}`,
        description: cfg.description || ucf.label,
      };
    });
    sections.push(ucFunctionsTemplate(tools));
  }

  // 4. LLM
  if (llmNodes.length > 0) {
    const cfg = llmNodes[0].config as { endpointName: string; maxTokens: number; temperature: number; systemPrompt: string };
    sections.push(llmTemplate(cfg));
  }

  // 5. Agent class
  const agentCfg = agentNode
    ? (agentNode.config as { description: string; maxIterations: number })
    : { description: 'A Databricks AI agent', maxIterations: 10 };

  const firstVsVarName = vsNodes.length > 0
    ? vsNodes[0].label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    : null;

  sections.push(agentTemplate({
    agentName,
    description: agentCfg.description,
    maxIterations: agentCfg.maxIterations,
    retrieverVarName: firstVsVarName,
  }));

  // 6. MLflow registration
  sections.push(mlflowRegistrationTemplate(agentName));

  return sections.join('\n');
};
