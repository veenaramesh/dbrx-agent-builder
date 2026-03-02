export interface VSConfig {
  varName: string;
  endpointName: string;
  indexName: string;
  textColumn: string;
  columns: string;
  numResults: number;
}

export const vectorSearchTemplate = (vs: VSConfig) => `\
${vs.varName} = vsc.get_index(
    endpoint_name="${vs.endpointName}",
    index_name="${vs.indexName}",
)

def retrieve_${vs.varName}(query: str, num_results: int = ${vs.numResults}) -> list:
    results = ${vs.varName}.similarity_search(
        query_text=query,
        columns=[${vs.columns.split(',').map(c => `"${c.trim()}"`).join(', ')}],
        num_results=num_results,
    )
    return results.get("result", {}).get("data_array", [])
`;

export const vectorSearchHeaderTemplate = () => `\
# ── Vector Search Retrievers ──────────────────────────────
from databricks.vector_search.client import VectorSearchClient
vsc = VectorSearchClient()
`;
