export interface LLMTemplateConfig {
  endpointName: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

export const llmTemplate = (cfg: LLMTemplateConfig) => `\
# ── LLM Configuration ─────────────────────────────────────
LLM_ENDPOINT = "${cfg.endpointName}"
SYSTEM_PROMPT = """
${cfg.systemPrompt}
"""
LLM_PARAMS = {"max_tokens": ${cfg.maxTokens}, "temperature": ${cfg.temperature}}
`;
