export interface UCFTool {
  fullName: string;
  description: string;
}

export const ucFunctionsTemplate = (tools: UCFTool[]) => `\
# ── Unity Catalog Function Tools ──────────────────────────
uc_tools = [
${tools.map(t => `    # ${t.description || t.fullName}\n    "${t.fullName}",`).join('\n')}
]
`;
