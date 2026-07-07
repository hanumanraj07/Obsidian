
"""
main.py — Obsidian FastAPI Backend
------------------------------------
Endpoints:
  POST   /query               → Run a customer support query through Obsidian
  GET    /events              → Full audit event history sorted by timestamp
  GET    /insights            → Hindsight-powered routing insights (latest suggestion)
  DELETE /session             → Reset budget AND routing policy to defaults
  GET    /routing-policy      → Get current per-category routing policy
  POST   /apply-suggestion    → (MAIN) Apply latest available suggestion (UI uses this)
  POST   /apply-routing-fix   → (LEGACY) Apply explicit suggestion (kept for compatibility)

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

from obsidian_core import classify_category, reset_session, run_query, get_routing_policy, apply_routing_fix
from hindsight_store import (
    ask_hindsight,
    check_escalation_pattern,
    get_all_events,
    get_insights,
    store_event,
    store_policy_change_event,
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
    version="0.4.0",
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


class RoutingPolicyResponse(BaseModel):
    policy: dict[str, str]


class ApplyRoutingFixRequest(BaseModel):
    suggestion: dict[str, Any]


class ApplyRoutingFixResponse(BaseModel):
    success: bool
    message: str
    change: Optional[dict[str, Any]]


# ── Shared internal apply logic (single source of truth) ─────────────────────
async def _internal_apply_suggestion(suggestion: Optional[dict]) -> ApplyRoutingFixResponse:
    if not suggestion:
        return ApplyRoutingFixResponse(
            success=False,
            message="No actionable suggestion available yet",
            change=None,
        )
    success, message, change = apply_routing_fix(suggestion)
    if success and change:
        await store_policy_change_event(change)
    return ApplyRoutingFixResponse(
        success=success,
        message=message,
        change=change,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/query", response_model=QueryResponse, summary="Run a customer support query through Obsidian")
async def query_endpoint(body: QueryRequest) -> QueryResponse:
    if not body.query.strip():
        raise HTTPException(status_code=422, detail="query must not be empty")

    logger.info("Received query: %r", body.query[:80])

    category = classify_category(body.query)
    logger.info("Category: %s", category)

    answer, trace_events, summary = run_query(body.query)

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

    blocked = audit_event.get("action") in ("stop", "deny_tool")

    await store_event(category, audit_event)

    # Detect patterns and AUTO-APPLY fix!
    routing_suggestion = await check_escalation_pattern()
    
    # AUTO-APPLY: If valid, non-sensitive suggestion exists, apply it!
    if routing_suggestion and routing_suggestion.get("category") != "sensitive_data":
        logger.info("Autonomous fix detected — applying routing suggestion for category: %s", routing_suggestion.get("category"))
        success, message, change = obsidian.apply_routing_fix(routing_suggestion)
        if success and change:
            await hindsight_store.store_policy_change_event(change)
            logger.info("Autonomous fix applied successfully: %s", message)

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
    events = get_all_events()
    return EventsResponse(
        total=len(events),
        events=[EventRecord(**e) for e in events],
    )


@app.get("/insights", response_model=InsightsResponse, summary="Hindsight-powered routing insights")
async def insights_endpoint() -> InsightsResponse:
    recall_text, reflect_text, suggestion = await get_insights()
    return InsightsResponse(
        recall=recall_text,
        reflect=reflect_text,
        routing_suggestion=suggestion,
    )


@app.delete("/session", response_model=SessionResetResponse, summary="Reset budget session AND routing policy")
async def reset_session_endpoint() -> SessionResetResponse:
    previous = reset_session()
    logger.info("Session reset. Previous cost: %.5f", previous.get("cost", 0))
    return SessionResetResponse(
        message="Budget session AND routing policy reset. New $0.02 cap and default routing active.",
        previous_summary=previous,
    )


@app.get("/routing-policy", response_model=RoutingPolicyResponse, summary="Get current per-category routing policy")
async def routing_policy_endpoint() -> RoutingPolicyResponse:
    policy = get_routing_policy()
    return RoutingPolicyResponse(policy=policy)


@app.post("/apply-suggestion", response_model=ApplyRoutingFixResponse, summary="(MAIN ENDPOINT) Apply latest suggestion")
async def apply_suggestion_endpoint() -> ApplyRoutingFixResponse:
    logger.info("Received request to apply latest suggestion")
    _, _, suggestion = await get_insights()
    return await _internal_apply_suggestion(suggestion)


@app.post("/apply-routing-fix", response_model=ApplyRoutingFixResponse, summary="(LEGACY) Apply explicit suggestion")
async def apply_routing_fix_endpoint(body: ApplyRoutingFixRequest) -> ApplyRoutingFixResponse:
    logger.info("Received legacy apply-routing-fix request")
    return await _internal_apply_suggestion(body.suggestion)


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok"}
