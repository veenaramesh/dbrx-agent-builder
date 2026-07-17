// Deploy-to-workspace API client.
//
// Sends the client-rendered project files to the backend, which writes them
// into the logged-in user's workspace (as the user, via the App's forwarded
// token) and returns where they landed plus the next-step commands.

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const url = (path: string) => `${API_BASE}${path}`;

export interface DeployRequest {
  project_name: string;
  initial_agent_name: string;
  display_name?: string;   // human-facing name from the builder (e.g. "Customer Support Agent")
  files: Record<string, string>;
}

export interface DeployResult {
  workspace_path: string;   // where the files were written
  user: string;             // whose workspace (resolved server-side)
  commands: string[];       // bundle init / deploy next steps
}

export async function deployToWorkspace(req: DeployRequest): Promise<DeployResult> {
  const res = await fetch(url('/api/deploy'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch { /* keep status text */ }
    throw new Error(detail);
  }
  return (await res.json()) as DeployResult;
}
