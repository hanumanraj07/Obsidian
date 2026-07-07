"""
obsidian_core.py
-----------------
cascadeflow-wrapped Groq handler + query category classifier.
Used by main.py (FastAPI) for every POST /query request.

Budget enforcement design
--------------------------
cascadeflow's budget check fires BEFORE each call using the current run's
accumulated cost. The `HarnessRunContext` stores cost as a plain float — it's
the same object across calls. But because cascadeflow uses a `ContextVar` to
store the active run, each async FastAPI handler starts with `get_current_run()`
returning None.

Fix: We keep ONE persistent `HarnessRunContext` object in `_active_ctx`. At the
start of each `run_query()` call, we call `_current_run.set(_active_ctx)` to
re-register it in the current async context. The budget accumulates across
calls because it's the same object, and the enforce check fires correctly.

To reset the budget mid-demo, call `reset_session()` or hit DELETE /session.
"""

from __future__ import annotations

import os
import threading
from dotenv import load_dotenv
import cascadeflow
from cascadeflow.harness.api import HarnessRunContext, _current_run, run as _cf_run
from cascadeflow.schema.exceptions import BudgetExceededError, HarnessStopError
from openai import OpenAI

# Load environment variables from .env file
load_dotenv()

# ── Groq client (OpenAI-compatible) ──────────────────────────────────────────
_groq_client = OpenAI(
    api_key=os.environ["GROQ_API_KEY"],
    base_url="https://api.groq.com/openai/v1",
)

# ── cascadeflow: enforce mode ─────────────────────────────────────────────────
cascadeflow.init(mode="enforce")

MODEL = "qwen/qwen3-32b"
DEMO_BUDGET = float(os.getenv("DEMO_BUDGET", "0.02"))

# ── Persistent HarnessRunContext ──────────────────────────────────────────────
_session_lock = threading.Lock()
_active_ctx: HarnessRunContext | None = None
_session_cm: object | None = None   # the cascadeflow.run() context manager


def _make_ctx() -> HarnessRunContext:
    """Create a fresh HarnessRunContext via cascadeflow.run().__enter__()."""
    cm = _cf_run(budget=DEMO_BUDGET, max_tool_calls=10)
    ctx = cm.__enter__()
    return ctx, cm


def _ensure_session() -> HarnessRunContext:
    """Return (or lazily create) the persistent HarnessRunContext."""
    global _active_ctx, _session_cm
    with _session_lock:
        if _active_ctx is None:
            _active_ctx, _session_cm = _make_ctx()
    return _active_ctx


def reset_session() -> dict:
    """Close the current session and start a fresh one. Returns the old summary."""
    global _active_ctx, _session_cm
    with _session_lock:
        old_summary: dict = {}
        if _active_ctx is not None:
            try:
                old_summary = _active_ctx.summary()
            except Exception:
                pass
        if _session_cm is not None:
            try:
                _session_cm.__exit__(None, None, None)
            except Exception:
                pass
        _active_ctx, _session_cm = _make_ctx()
    return old_summary


# ── Category classifier ───────────────────────────────────────────────────────
_CATEGORY_RULES: list[tuple[list[str], str]] = [
    (["order", "#", "tracking", "shipment", "delivery", "where is my"], "order_status"),
    (["refund", "money back", "charge", "cancel", "return"], "refund"),
    (["credit card", "ssn", "password", "cvv", "card number", "bank account",
      "social security", "date of birth", "personal"], "sensitive_data"),
]


def classify_category(query: str) -> str:
    """Return one of: order_status | refund | sensitive_data | general_faq."""
    lower = query.lower()
    for keywords, category in _CATEGORY_RULES:
        if any(kw in lower for kw in keywords):
            return category
    return "general_faq"


# ── cascadeflow agent decorator ───────────────────────────────────────────────
@cascadeflow.harness_agent(
    budget=DEMO_BUDGET,
    compliance="gdpr",
    kpi_weights={"quality": 0.6, "cost": 0.3, "latency": 0.1},
)
def _handle_query(query: str) -> str:
    """Inner LLM call — instrumented by cascadeflow."""
    resp = _groq_client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": query}],
    )
    return resp.choices[0].message.content


def run_query(query: str) -> tuple[str, list[dict], dict]:
    """
    Run a query through the persistent cascadeflow enforce-mode session.

    Key: We call `_current_run.set(ctx)` at the start of every request so the
    cascadeflow interceptor sees the same accumulated-cost HarnessRunContext
    regardless of which async task is calling us.
    """
    ctx = _ensure_session()

    # Re-register the persistent context in the current async task's ContextVar
    _current_run.set(ctx)

    try:
        answer = _handle_query(query)
    except BudgetExceededError as exc:
        answer = (
            f"[BUDGET STOP] ${abs(getattr(exc, 'remaining', 0)):.4f} over the "
            f"${DEMO_BUDGET:.4f} cap. Query blocked by Obsidian. "
            f"Use DELETE /session to reset for a new demo run."
        )
    except HarnessStopError as exc:
        answer = f"[POLICY STOP] {getattr(exc, 'reason', str(exc))}"
    except Exception as exc:
        answer = f"[ERROR] {exc}"

    try:
        trace_events = ctx.trace()
        summary = ctx.summary()
    except Exception:
        trace_events = []
        summary = {}

    return answer, trace_events, summary
