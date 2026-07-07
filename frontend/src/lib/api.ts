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
  action: "allow" | "stop";
  budget_state: BudgetState;
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

export async function postAsk(question: string): Promise<{ answer: string }> {
  const res = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error("Failed to ask Obsidian");
  return res.json();
}
