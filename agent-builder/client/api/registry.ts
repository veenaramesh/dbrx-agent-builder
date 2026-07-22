// Agent Library registry API client.
//
// Talks to the FastAPI backend (VITE_API_URL in dev; same-origin when served
// by the Databricks App). When no backend is reachable — e.g. the static
// GitHub Pages build — callers fall back to sample data so the tab still
// renders.

export type ToolKind = 'uc_function' | 'vector_search' | 'lakebase';
export type AgentStatus = 'unknown' | 'ready' | 'updating' | 'failed';
export type Stage = 'dev' | 'test' | 'staging' | 'prod';
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'manual' | 'unknown';

export interface ToolRef {
  kind: ToolKind;
  label: string;
  detail: string;
}

export interface ReadinessCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  blocking: boolean;
}

export interface Readiness {
  verified_at: string;
  target_stage: Stage | null;
  ready: boolean;
  checks: ReadinessCheck[];
}

export interface RegistryAgent {
  id: string;
  name: string;
  project: string;
  endpoint: string;
  app_url: string;
  experiment: string;
  experiment_id: string;
  bundle_path: string;
  model: string;
  workspace: string;
  stage: Stage;
  tools: ToolRef[];
  registered_at: string;
  updated_at: string;
  status: AgentStatus;
  requests_24h: number | null;
  signed_off_by: string | null;
  signed_off_at: string | null;
  readiness: Readiness | null;
}

export interface AgentInput {
  name: string;
  endpoint?: string;
  app_url?: string;
  experiment?: string;
  bundle_path?: string;
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

// Recompute the readiness scorecard from live workspace state.
export async function verifyAgent(id: string): Promise<RegistryAgent> {
  return json<RegistryAgent>(await fetch(url(`/api/agents/${id}/verify`), { method: 'POST' }));
}

// Toggle the human promotion sign-off.
export async function signOffAgent(id: string, approved: boolean): Promise<RegistryAgent> {
  return json<RegistryAgent>(
    await fetch(url(`/api/agents/${id}/signoff`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    }),
  );
}

// Advance to the next stage (requires a ready verdict; 409 otherwise).
export async function promoteAgent(id: string): Promise<RegistryAgent> {
  return json<RegistryAgent>(await fetch(url(`/api/agents/${id}/promote`), { method: 'POST' }));
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

export interface WorkspaceConfig {
  host: string; // workspace base URL, '' when unknown
}

// Workspace context for building deep links (folder, experiment, endpoint).
export async function getConfig(): Promise<WorkspaceConfig> {
  try {
    return json<WorkspaceConfig>(await fetch(url('/api/config')));
  } catch {
    return { host: '' };
  }
}
