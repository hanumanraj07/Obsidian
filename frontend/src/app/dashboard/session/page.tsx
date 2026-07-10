"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { deleteSession } from "@/lib/api";
import { formatINR } from "@/lib/currency";
import { useDashboardData } from "@/components/DashboardContext";
import { showToast } from "@/components/Toast";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, RotateCcw } from "lucide-react";

export default function SessionPage() {
  const { events, refreshData: fetchData } = useDashboardData();
  const [resetting, setResetting] = useState(false);
  const [uptime, setUptime] = useState("00:00:00");
  const sessionStart = useRef(Date.now());
  const [previousSessionSummary, setPreviousSessionSummary] = useState<any>(null);

  useEffect(() => {
    const t = setInterval(() => {
      const e = Date.now() - sessionStart.current;
      const h = Math.floor(e / 3600000), m = Math.floor((e % 3600000) / 60000), s = Math.floor((e % 60000) / 1000);
      setUptime(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset the session and budget? This cannot be undone.")) return;
    setResetting(true);
    try {
      const res = await deleteSession();
      sessionStart.current = Date.now();
      setUptime("00:00:00");
      setPreviousSessionSummary(res?.previous_summary);
      showToast(res?.message ?? "Session reset successfully!", "success");
      await fetchData();
    } catch (e: any) {
      showToast(e?.message ?? "Failed to reset session", "error");
    } finally {
      setResetting(false);
    }
  };

  const latest = events.length > 0 ? events[events.length - 1]?.audit_event : null;
  const budget = useMemo(() => {
    if (!latest?.budget_state) return { remaining: 0.02, max: 0.02, pct: 100 };
    const { remaining, max } = latest.budget_state;
    return { remaining, max, pct: Math.max(0, (remaining / max) * 100) };
  }, [latest]);

  const isWarning = latest && (latest.action === "stop" || (latest.budget_state?.remaining ?? 1) <= 0);
  const budgetBarColor = isWarning ? "#F87171" : budget.pct < 40 ? "#FBBF24" : "#34D399";
  const totalSpend = events.reduce((sum, e) => sum + (e.audit_event.cost_total ?? 0), 0);
  const totalQueries = events.length;
  const blockedQueries = events.filter(e => e.audit_event.action === "stop").length;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "800px", margin: "0 auto" }}>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Activity size={18} style={{ color: "var(--color-accent-light)" }} />
              </div>
              Current Session
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span className="status-dot online" />
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Active for <span className="font-mono-data" style={{ color: "var(--color-text-secondary)" }}>{uptime}</span></span>
            </div>
          </div>
          <button onClick={handleReset} disabled={resetting} className="btn btn-danger" style={{ padding: "8px 16px" }}>
            {resetting ? <span className="animate-spin" style={{ display: "inline-block", width: 14, height: 14 }}>⟳</span> : <RotateCcw size={14} />}
            Reset Session
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: "24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: "150px", height: "150px", background: "radial-gradient(circle at top right, rgba(99,102,241,0.06), transparent)", pointerEvents: "none" }} />

        {/* Budget Gauge */}
        <div style={{ background: "var(--color-surface-elevated)", borderRadius: "12px", padding: "24px", border: "1px solid var(--color-border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "12px" }}>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: "10.5px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Budget Remaining</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <span className="font-mono-data" style={{ fontSize: "32px", fontWeight: 700, color: budgetBarColor, lineHeight: 1 }}>{formatINR(budget.remaining, 5)}</span>
                <span className="font-mono-data" style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>/ {formatINR(budget.max)}</span>
              </div>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 600, color: budgetBarColor, background: `${budgetBarColor}18`, padding: "4px 12px", borderRadius: "999px" }}>
              {isWarning ? "EXHAUSTED" : budget.pct > 60 ? "HEALTHY" : "LOW"}
            </span>
          </div>
          <div className="progress-track" style={{ height: "10px", background: "rgba(255,255,255,0.06)" }}>
            <motion.div className="progress-fill" initial={{ width: "100%" }} animate={{ width: `${budget.pct}%` }} transition={{ type: "spring", stiffness: 60, damping: 20 }} style={{ background: budgetBarColor }} />
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginTop: "20px" }}>
          {[
            { label: "Total Spend", value: formatINR(totalSpend, 5), color: "var(--color-accent-light)" },
            { label: "Total Queries", value: String(totalQueries), color: "var(--color-text-primary)" },
            { label: "Blocked", value: String(blockedQueries), color: blockedQueries > 0 ? "var(--color-danger)" : "var(--color-text-muted)" },
          ].map(s => (
            <div key={s.label} style={{ padding: "14px", background: "var(--color-surface-elevated)", border: "1px solid var(--color-border-subtle)", borderRadius: "10px" }}>
              <p style={{ margin: "0 0 4px", fontSize: "11px", color: "var(--color-text-muted)" }}>{s.label}</p>
              <p className="font-mono-data" style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {previousSessionSummary && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="card" style={{ padding: "20px", background: "var(--color-accent-dim)", borderColor: "rgba(99,102,241,0.2)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "13.5px", fontWeight: 600, color: "var(--color-accent-light)" }}>Previous Session Summary</h3>
            <div className="code-block">{JSON.stringify(previousSessionSummary, null, 2)}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
