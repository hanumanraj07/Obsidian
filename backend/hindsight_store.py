"""
hindsight_store.py
-------------------
Event storage + escalation pattern detection + Hindsight memory integration.

Two backends — set USE_HINDSIGHT env var to choose:

  Path A  USE_HINDSIGHT=true  (requires Docker + pip install hindsight-client)
  ─────────────────────────────────────────────────────────────────────────────
  Events are stored in Hindsight via retain().
  Patterns are detected via recall() and reflect().
  The in-memory mirror (_event_store) is ALSO kept so GET /events always works.

  Path B  USE_HINDSIGHT=false  (default — zero external dependencies)
  ─────────────────────────────────────────────────────────────────────────────
  Pure in-memory dict keyed by category.
  Pattern detection via cost heuristic (>50% expensive calls → suggestion).

Hindsight API used (confirmed from README + SDK source):
  client.aretain(bank_id=str, content=str)          → store a memory fact
  client.arecall(bank_id=str, query=str)             → semantic search over memories
  client.areflect(bank_id=str, query=str)            → LLM-reasoned answer from memories
"""

from __future__ import annotations

import asyncio
import collections
import json
import logging
import os
import time
from typing import Optional

logger = logging.getLogger("obsidian.hindsight")

# ── Config ────────────────────────────────────────────────────────────────────
USE_HINDSIGHT: bool = os.getenv("USE_HINDSIGHT", "false").lower() == "true"
HINDSIGHT_URL: str = os.getenv("HINDSIGHT_URL", "http://localhost:8888")
HINDSIGHT_BANK_ID: str = "obsidian-audit"   # single bank for all audit events

# Cost above which a call is considered "expensive" ($0.006/call proxy)
EXPENSIVE_COST_THRESHOLD: float = float(os.getenv("EXPENSIVE_COST_THRESHOLD", "0.006"))

# ── Hindsight client (lazy-loaded only when USE_HINDSIGHT=true) ───────────────
_hindsight_client = None


def _get_hindsight():
    global _hindsight_client
    if _hindsight_client is None:
        try:
            from hindsight_client import Hindsight  # type: ignore
            _hindsight_client = Hindsight(base_url=HINDSIGHT_URL)
            logger.info("Hindsight client connected to %s", HINDSIGHT_URL)
        except ImportError:
            raise RuntimeError(
                "hindsight-client is not installed. Run: pip install hindsight-client"
            )
        except Exception as exc:
            raise RuntimeError(
                f"Could not connect to Hindsight at {HINDSIGHT_URL}: {exc}\n"
                "Make sure the Docker container is running."
            )
    return _hindsight_client


# ── In-memory mirror (always active — used for GET /events) ──────────────────
# Structure: { category → [{ timestamp_ms, category, audit_event }, ...] }
_event_store: dict[str, list[dict]] = collections.defaultdict(list)
_total_event_count: int = 0

# ── Policy change events (stored separately for now, or in _event_store with special category)
POLICY_CHANGE_CATEGORY = "__policy_change__"


def _build_memory_text(category: str, audit_event: dict) -> str:
    """Build a rich, category-keyed text summary for Hindsight retain().

    Writing category explicitly in multiple forms lets Hindsight's fact
    extraction surface category-level cost patterns in recall/reflect.
    """
    action   = audit_event.get("action", "allow")
    model    = audit_event.get("model") or "unknown"
    cost     = float(audit_event.get("cost_total") or 0)
    latency  = float(audit_event.get("latency_used_ms") or 0)

    return (
        f"Audit event for category '{category}': "
        f"query routed to model {model} in enforce mode. "
        f"Action={action}. "
        f"Cost=${cost:.5f} per query. "
        f"Latency={latency:.0f}ms. "
        f"The '{category}' category cost ${cost:.5f} for this request."
    )


# ── Public API ────────────────────────────────────────────────────────────────

async def store_event(category: str, audit_event: dict) -> None:
    """
    Persist one audit event.
    - Always writes to the in-memory mirror (for GET /events).
    - If USE_HINDSIGHT=true, also calls Hindsight aretain().
    """
    global _total_event_count

    record = {
        "timestamp_ms": audit_event.get("timestamp_ms", time.time() * 1000),
        "category": category,
        "audit_event": audit_event,
    }

    # Always keep in-memory mirror for the dashboard
    _event_store[category].append(record)
    _total_event_count += 1

    if USE_HINDSIGHT:
        try:
            client = _get_hindsight()
            text = _build_memory_text(category, audit_event)
            await client.aretain(bank_id=HINDSIGHT_BANK_ID, content=text)
            logger.debug("Hindsight aretain OK: %s", text[:80])
        except Exception as exc:
            # Don't crash the API request if Hindsight is slow/down
            logger.warning("Hindsight aretain failed (continuing): %s", exc)


async def store_policy_change_event(change: dict) -> None:
    """Store a policy change event in the audit trail."""
    global _total_event_count
    timestamp_ms = time.time() * 1000
    audit_event = {
        "action": "policy_change",
        "model": None,
        "cost_total": 0.0,
        "latency_used_ms": 0.0,
        "decision_mode": "governance",
        "timestamp_ms": timestamp_ms,
        "run_id": "policy_change",
        "step": 0,
        "reason": change["reason"],
        "query": None,
        "old_model": change["old_model"],
        "new_model": change["new_model"],
        "affected_category": change["category"],
    }
    record = {
        "timestamp_ms": timestamp_ms,
        "category": POLICY_CHANGE_CATEGORY,
        "audit_event": audit_event,
    }
    _event_store[POLICY_CHANGE_CATEGORY].append(record)
    _total_event_count += 1

def get_all_events() -> list[dict]:
    """Return all stored events sorted ascending by timestamp_ms."""
    all_events: list[dict] = []
    for events in _event_store.values():
        all_events.extend(events)
    return sorted(all_events, key=lambda e: e["timestamp_ms"])


async def check_escalation_pattern() -> Optional[dict]:
    """
    After every 10 total events, check if any category is over-escalated.

    In-memory mode: cost heuristic (>50% calls above EXPENSIVE_COST_THRESHOLD).
    Hindsight mode: delegates to get_insights() which calls arecall/areflect.

    Returns a routing_suggestion dict or None.
    """
    if _total_event_count == 0 or _total_event_count % 10 != 0:
        return None

    if USE_HINDSIGHT:
        try:
            _, _, suggestion = await get_insights()
            return suggestion
        except Exception as exc:
            logger.warning("Hindsight check_escalation_pattern failed: %s", exc)
            return None

    # In-memory heuristic
    suggestions: list[dict] = []
    for category, events in _event_store.items():
        # Exclude internal policy-change pseudo-category from pattern detection
        # This avoids skewing cost/escalation calculations with our own audit events
        if category == POLICY_CHANGE_CATEGORY or len(events) < 2:
            continue
        expensive = sum(
            1 for e in events
            if e["audit_event"].get("cost_total", 0) > EXPENSIVE_COST_THRESHOLD
        )
        rate = expensive / len(events)
        if rate > 0.5:
            suggestions.append({
                "category": category,
                "escalation_rate": round(rate, 2),
                "suggestion": (
                    f"{int(rate * 100)}% of '{category}' queries used a heavy model "
                    f"(cost > ${EXPENSIVE_COST_THRESHOLD:.4f}/call). "
                    f"Suggested fix: route routine '{category}' queries to "
                    f"llama-3.1-8b-instant (free tier) and reserve qwen3-32b for "
                    f"complex cases only."
                ),
            })

    return suggestions[0] if suggestions else None


async def get_insights() -> tuple[Optional[str], Optional[str], Optional[dict]]:
    """
    Query Hindsight for pattern-based routing insights.

    Returns:
        recall_text  – raw recall answer (what categories are over-escalated)
        reflect_text – LLM-reasoned routing rule suggestion
        suggestion   – structured dict for the API response
    """
    if not USE_HINDSIGHT:
        # Fall back to in-memory heuristic
        suggestion = await check_escalation_pattern() if _total_event_count > 0 else None
        return None, None, suggestion

    try:
        client = _get_hindsight()

        recall_text: Optional[str] = None
        reflect_text: Optional[str] = None

        # arecall: semantic search over stored memory facts
        # Returns an object with .results = list[RecallResult]
        recall_result = await client.arecall(
            bank_id=HINDSIGHT_BANK_ID,
            query="which query category is most expensive and gets routed to heavy models most often",
        )
        if recall_result is not None:
            # SDK returns a RecallResponse object with .results list
            results = getattr(recall_result, "results", None)
            if results:
                # Join the text of each memory fact into a readable summary
                recall_text = "\n".join(
                    f"- {getattr(r, 'text', str(r))}"
                    for r in results
                    if getattr(r, "text", None)
                )
            else:
                recall_text = str(recall_result) or None

        # areflect: LLM-reasoned answer that synthesises all memories
        # Returns an object with .text = str
        reflect_result = await client.areflect(
            bank_id=HINDSIGHT_BANK_ID,
            query=(
                "Based on the audit history of query categories and their costs, "
                "which category (order_status, refund, sensitive_data, or general_faq) "
                "is routed to the most expensive model most often? "
                "Suggest a concrete routing rule: which category should use a cheaper model "
                "like llama-3.1-8b-instant instead, and why? Give a specific cost saving estimate."
            ),
        )
        if reflect_result is not None:
            # SDK returns a ReflectResponse object with .text = str
            reflect_text = getattr(reflect_result, "text", None) or str(reflect_result)
            # Strip leading markdown wrapper if present
            if reflect_text and reflect_text.startswith("text="):
                reflect_text = reflect_text[5:].strip('"')

        # Build structured suggestion from the reflect response
        suggestion: Optional[dict] = None
        if reflect_text and "don't have information" not in reflect_text.lower():
            suggestion = {
                "source": "hindsight_reflect",
                "suggestion": reflect_text,
                "recall_context": recall_text,
            }
        elif recall_text:
            # Reflect didn't produce useful output — return recall summary instead
            suggestion = {
                "source": "hindsight_recall",
                "suggestion": recall_text,
                "recall_context": recall_text,
            }

        return recall_text, reflect_text, suggestion

    except Exception as exc:
        logger.warning("Hindsight get_insights failed: %s", exc)
        return None, None, None


async def ask_hindsight(query: str) -> str:
    """
    Query the audit history with a natural language question.

    Primary path  — USE_HINDSIGHT=true + Docker running:
        Uses Hindsight areflect (semantic memory over all stored facts).

    Fallback path — USE_HINDSIGHT=false OR Docker unreachable:
        Builds a structured summary of the in-memory _event_store and sends it
        to Groq directly so the user always gets a useful answer.
    """
    # ── Try Hindsight first (only if configured) ──────────────────────────────
    if USE_HINDSIGHT:
        try:
            client = _get_hindsight()
            reflect_result = await client.areflect(
                bank_id=HINDSIGHT_BANK_ID,
                query=query,
            )
            if reflect_result is not None:
                text = getattr(reflect_result, "text", None) or str(reflect_result)
                if text and text.startswith("text="):
                    text = text[5:].strip('"')
                return text
        except Exception as exc:
            logger.warning(
                "Hindsight unavailable (%s) — falling back to Groq in-memory analysis.", exc
            )

    # ── Groq fallback: synthesise from in-memory events ───────────────────────
    return await _ask_groq_with_context(query)


async def _ask_groq_with_context(query: str) -> str:
    """Answer a question using Groq with a structured summary of in-memory events."""
    import os
    from openai import OpenAI
    from dotenv import load_dotenv

    load_dotenv()

    all_events = get_all_events()
    if not all_events:
        return (
            "No audit events are in memory yet. Send some queries via the Live Query box "
            "and then ask me again — I'll have real data to reason about."
        )

    # Build a compact, structured context from up to 50 most-recent events
    lines: list[str] = [
        f"Total events in history: {len(all_events)}",
        "",
        "Recent audit events (most recent last):",
    ]
    for i, rec in enumerate(all_events[-50:], start=1):
        ae = rec.get("audit_event", {})
        bs = ae.get("budget_state") or {}
        lines.append(
            f"  [{i}] category={rec.get('category', '?')}"
            f"  action={ae.get('action', '?')}"
            f"  model={ae.get('model', '?')}"
            f"  cost=${ae.get('cost_total', 0):.5f}"
            f"  latency={ae.get('latency_used_ms', 0):.0f}ms"
            f"  budget_remaining=${bs.get('remaining', '?')}"
        )

    # Per-category summary
    from collections import defaultdict
    cat_stats: dict[str, dict] = defaultdict(lambda: {"count": 0, "total_cost": 0.0, "blocked": 0})
    for rec in all_events:
        ae = rec.get("audit_event", {})
        cat = rec.get("category", "unknown")
        cat_stats[cat]["count"] += 1
        cat_stats[cat]["total_cost"] += ae.get("cost_total", 0.0)
        if ae.get("action") in ("stop", "deny_tool"):
            cat_stats[cat]["blocked"] += 1

    lines.append("")
    lines.append("Per-category summary:")
    for cat, s in sorted(cat_stats.items(), key=lambda x: -x[1]["total_cost"]):
        avg = s["total_cost"] / s["count"] if s["count"] else 0
        lines.append(
            f"  {cat}: {s['count']} queries, "
            f"total=${s['total_cost']:.5f}, avg=${avg:.5f}/query, "
            f"blocked={s['blocked']}"
        )

    context = "\n".join(lines)

    groq_client = OpenAI(
        api_key=os.environ["GROQ_API_KEY"],
        base_url="https://api.groq.com/openai/v1",
    )

    system_prompt = (
        "You are Obsidian, an AI agent governance and cost audit assistant. "
        "You have access to a structured audit log of all LLM queries that have passed through "
        "the Obsidian governance engine. Answer the user's question concisely and insightfully "
        "using only the data provided. Be specific — reference actual costs, categories, and counts. "
        "If the question is hypothetical (e.g. 'what if budget was $0.01?'), reason carefully based on "
        "the data. Keep your answer under 150 words."
    )

    try:
        resp = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Audit data:\n{context}\n\nQuestion: {query}"},
            ],
            max_tokens=300,
        )
        return resp.choices[0].message.content or "No answer generated."
    except Exception as exc:
        logger.warning("Groq fallback ask failed: %s", exc)
        return f"Could not generate an answer: {exc}"

