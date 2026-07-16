// Agent Library registry API client.
//
// Talks to the FastAPI backend (VITE_API_URL in dev; same-origin when served
// by the Databricks App). When no backend is reachable — e.g. the static
// GitHub Pages build — callers fall back to sample data so the tab still
// renders.

export type ToolKind = 'uc_function' | 'vector_search' | 'lakebase';
export type AgentStatus = 'unknown' | 'ready' | 'updating' | 'failed';

export interface ToolRef {
  kind: ToolKind;
  label: string;
  detail: string;
}

export interface RegistryAgent {
  id: string;
  name: string;
  endpoint: string;
  app_url: string;
  model: string;
  workspace: string;
  tools: ToolRef[];
  registered_at: string;
  updated_at: string;
  status: AgentStatus;
  requests_24h: number | null;
}

export interface AgentInput {
  name: string;
  endpoint?: string;
  app_url?: string;
  model?: string;
  workspace?: string;
  tools?: ToolRef[];
}

// Same-origin ('') when the App serves us; VITE_API_URL in local dev.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

const url = (path: string) => `${API_BASE}${path}`;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export async function listAgents(): Promise<RegistryAgent[]> {
  return json<RegistryAgent[]>(await fetch(url('/api/agents')));
}

export async function createAgent(input: AgentInput): Promise<RegistryAgent> {
  return json<RegistryAgent>(
    await fetch(url('/api/agents'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
}

export async function updateAgent(id: string, patch: Partial<AgentInput>): Promise<RegistryAgent> {
  return json<RegistryAgent>(
    await fetch(url(`/api/agents/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteAgent(id: string): Promise<void> {
  await json<void>(await fetch(url(`/api/agents/${id}`), { method: 'DELETE' }));
}

// Quick reachability probe so the UI can decide between live vs sample data.
export async function backendAvailable(): Promise<boolean> {
  try {
    const res = await fetch(url('/api/health'));
    return res.ok;
  } catch {
    return false;
  }
}
