
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface BudgetState {
  max: number;
  remaining: number;
}

export interface AuditEvent {
  timestamp_ms: number;
  category: string;
  model: string;
  cost_total: number;
  latency_used_ms: number;
  action: "allow" | "stop" | "policy_change";
  budget_state?: BudgetState;
  [key: string]: any;
}

export interface EventRecord {
  timestamp_ms: number;
  category: string;
  audit_event: AuditEvent;
}

export interface EventsResponse {
  total: number;
  events: EventRecord[];
}

export interface Insights {
  recall: any;
  reflect: any;
  routing_suggestion: any;
}

export async function getEvents(): Promise<EventsResponse> {
  const res = await fetch(`${API_URL}/events`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

export async function getInsights(): Promise<Insights> {
  const res = await fetch(`${API_URL}/insights`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch insights");
  return res.json();
}

export async function getRoutingPolicy(): Promise<{ policy: Record<string, string> }> {
  const res = await fetch(`${API_URL}/routing-policy`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch routing policy");
  return res.json();
}

export async function postQuery(query: string): Promise<any> {
  const res = await fetch(`${API_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error("Failed to post query");
  return res.json();
}

export async function deleteSession(): Promise<void> {
  const res = await fetch(`${API_URL}/session`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to reset session");
}

// Updated: only applySuggestion remains (uses /apply-suggestion endpoint)
export async function applySuggestion(): Promise<any> {
  const res = await fetch(`${API_URL}/apply-suggestion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to apply latest suggestion");
  return res.json();
}
