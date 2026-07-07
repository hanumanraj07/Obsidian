"""
main.py — Obsidian FastAPI Backend
------------------------------------
Endpoints:
  POST   /query    → run a query through cascadeflow+Groq, store audit event
  GET    /events   → full event history sorted by timestamp (for dashboard)
  GET    /insights → Hindsight-powered routing suggestion (on demand)
  DELETE /session  → reset the cascadeflow budget session for a fresh demo run

Start:
  $env:GROQ_API_KEY = "gsk_..."
  uvicorn main:app --reload --port 8000

Optional Hindsight (requires Docker + hindsight-client):
  $env:USE_HINDSIGHT = "true"
  $env:HINDSIGHT_URL  = "http://localhost:8888"
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from obsidian_core import classify_category, reset_session, run_query
from hindsight_store import (
    check_escalation_pattern,
    get_all_events,
    get_insights,
    store_event,
)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("obsidian")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Obsidian API",
    description=(
        "AI decision audit and cost governance backend. "
        "Every query is routed through cascadeflow (enforce mode) and logged."
    ),
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────
class QueryRequest(BaseModel):
    query: str


class QueryResponse(BaseModel):
    response: str
    category: str
    blocked: bool                           # True when cascadeflow issued stop/deny
    audit_event: dict[str, Any]
    summary: dict[str, Any]
    routing_suggestion: Optional[dict[str, Any]]


class EventRecord(BaseModel):
    timestamp_ms: float
    category: str
    audit_event: dict[str, Any]


class EventsResponse(BaseModel):
    total: int
    events: list[EventRecord]


class SessionResetResponse(BaseModel):
    message: str
    previous_summary: dict[str, Any]


class InsightsResponse(BaseModel):
    recall: Optional[str]
    reflect: Optional[str]
    routing_suggestion: Optional[dict[str, Any]]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/query", response_model=QueryResponse, summary="Run a customer support query through Obsidian")
async def query_endpoint(body: QueryRequest) -> QueryResponse:
    """
    Route `body.query` through cascadeflow enforce mode → Groq → audit trail.

    **Budget enforcement:** The cascadeflow session is persistent across calls.
    Once the $0.02 cumulative budget is exhausted, `blocked=true` and
    `audit_event.action="stop"` / `reason="budget_exceeded"` are returned.
    Use `DELETE /session` to reset the budget for a new demo run.

    **Compliance gating:** Sensitive queries may trigger `action="switch_model"`
    (routed to a compliant model) or `action="stop"` (no approved model found).
    """
    if not body.query.strip():
        raise HTTPException(status_code=422, detail="query must not be empty")

    logger.info("Received query: %r", body.query[:80])

    # 1. Classify
    category = classify_category(body.query)
    logger.info("Category: %s", category)

    # 2. Run through cascadeflow + Groq (persistent session accumulates cost)
    answer, trace_events, summary = run_query(body.query)

    # 3. Pick the most recent trace event for this call
    audit_event: dict[str, Any] = trace_events[-1] if trace_events else {
        "action": "unknown",
        "model": None,
        "cost_total": 0.0,
        "latency_used_ms": 0.0,
        "decision_mode": "enforce",
        "timestamp_ms": time.time() * 1000,
        "run_id": "n/a",
        "step": 0,
        "reason": "no_trace",
        "query": body.query,
    }

    # Determine if the query was blocked (stop or deny_tool)
    blocked = audit_event.get("action") in ("stop", "deny_tool")

    # 4. Store in Hindsight (or in-memory fallback)
    await store_event(category, audit_event)

    # 5. Check escalation pattern (every 10 events)
    routing_suggestion = await check_escalation_pattern()

    logger.info(
        "Query done | category=%s action=%s blocked=%s cost_total=%.5f budget_remaining=%s",
        category,
        audit_event.get("action"),
        blocked,
        audit_event.get("cost_total", 0),
        summary.get("budget_remaining", "?"),
    )

    return QueryResponse(
        response=answer,
        category=category,
        blocked=blocked,
        audit_event=audit_event,
        summary=summary,
        routing_suggestion=routing_suggestion,
    )


@app.get("/events", response_model=EventsResponse, summary="Full audit event history for the dashboard")
async def events_endpoint() -> EventsResponse:
    """Return all stored audit events sorted ascending by timestamp_ms."""
    events = get_all_events()
    return EventsResponse(
        total=len(events),
        events=[EventRecord(**e) for e in events],
    )


@app.get("/insights", response_model=InsightsResponse, summary="Hindsight-powered routing insights")
async def insights_endpoint() -> InsightsResponse:
    """
    Query Hindsight memory for pattern-based routing insights.

    - **recall**: which category is escalated to expensive models most often
    - **reflect**: suggested routing rule to reduce cost
    - **routing_suggestion**: structured suggestion dict (same format as in /query)

    Falls back gracefully if Hindsight is not running (USE_HINDSIGHT=false).
    """
    recall_text, reflect_text, suggestion = await get_insights()
    return InsightsResponse(
        recall=recall_text,
        reflect=reflect_text,
        routing_suggestion=suggestion,
    )


@app.delete("/session", response_model=SessionResetResponse, summary="Reset budget session for a fresh demo run")
async def reset_session_endpoint() -> SessionResetResponse:
    """
    Close the current cascadeflow session (clears accumulated cost/budget)
    and start a fresh one with the full $DEMO_BUDGET.

    Use this between hackathon demo runs so judges see the budget enforcement
    from scratch each time.
    """
    previous = reset_session()
    logger.info("Session reset. Previous cost: %.5f", previous.get("cost", 0))
    return SessionResetResponse(
        message="Budget session reset. New $0.02 cap is active.",
        previous_summary=previous,
    )


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok"}
