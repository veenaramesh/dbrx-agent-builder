export interface AgentTemplateConfig {
  agentName: string;
  description: string;
  maxIterations: number;
  retrieverVarName: string | null; // null if no vector search node
}

export const agentTemplate = (cfg: AgentTemplateConfig) => `\
# ── Agent Definition ──────────────────────────────────────
class MyAgent(ChatModel):
    """
    ${cfg.description}
    Max iterations: ${cfg.maxIterations}
    """

    def predict(self, context, request: ChatRequest, params=None) -> ChatResponse:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages += [m.to_dict() for m in request.messages]
${cfg.retrieverVarName ? `
        # Retrieve relevant context
        user_query = request.messages[-1].content
        context_docs = retrieve_${cfg.retrieverVarName}(user_query)
        if context_docs:
            context_str = "\\n".join([str(doc) for doc in context_docs])
            messages.insert(1, {"role": "system", "content": f"Relevant context:\\n{context_str}"})
` : ''}
        # Call LLM
        client = w.serving_endpoints.query(
            name=LLM_ENDPOINT,
            messages=messages,
            **LLM_PARAMS,
        )
        reply = client.choices[0].message.content
        return ChatResponse(choices=[{"message": ChatMessage(role="assistant", content=reply)}])
`;

export const mlflowRegistrationTemplate = (agentName: string) => `\
# ── Register with MLflow ──────────────────────────────────
mlflow.set_registry_uri("databricks-uc")

with mlflow.start_run():
    model_info = mlflow.pyfunc.log_model(
        artifact_path="agent",
        python_model=MyAgent(),
    )

# Register: agents.register_agent("${agentName}", model_info.model_uri)
`;
