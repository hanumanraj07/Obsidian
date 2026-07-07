
"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  getEvents,
  getInsights,
  getRoutingPolicy,
  postQuery,
  deleteSession,
  applySuggestion,
  type EventRecord,
  type AuditEvent,
} from "@/lib/api";

// Utility functions for formatting
const formatLatency = (ms: number): string => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms.toFixed(0)}ms`;
};

const formatTime = (timestampMs: number): string => {
  const date = new Date(timestampMs);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

const POLICY_CHANGE_CATEGORY = "__policy_change__";
const DEFAULT_MODEL = "qwen/qwen3-32b";
const CHEAP_MODEL = "llama-3.1-8b-instant";

export default function Home() {
  const [eventRecords, setEventRecords] = useState<EventRecord[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [routingPolicy, setRoutingPolicy] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [queryResponse, setQueryResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyingFix, setApplyingFix] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<any>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const [uptime, setUptime] = useState<string>("00:00");

  // Ask Obsidian chat state
  type ChatMessage = { role: "user" | "assistant"; text: string };
  const [askMessages, setAskMessages] = useState<ChatMessage[]>([]);
  const [askInput, setAskInput] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Update uptime
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - sessionStartRef.current;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setUptime(
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch data
  const fetchData = async () => {
    try {
      const [eventsRes, insightsData, policyRes] = await Promise.all([
        getEvents(),
        getInsights(),
        getRoutingPolicy(),
      ]);
      const sortedEvents = [...eventsRes.events].sort(
        (a, b) => b.timestamp_ms - a.timestamp_ms
      );
      setEventRecords(sortedEvents);
      setInsights(insightsData);
      setRoutingPolicy(policyRes.policy);
      setError(null);
    } catch (err) {
      setError("Failed to fetch data from backend");
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    pollingRef.current = setInterval(fetchData, 2500);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Handle query submission
  const handleSubmitQuery = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await postQuery(query);
      setQueryResponse(res.response || JSON.stringify(res));
      await fetchData();
      setQuery("");
    } catch (err) {
      setQueryResponse("Error posting query");
    } finally {
      setLoading(false);
    }
  };

  // Handle session reset
  const handleResetSession = async () => {
    try {
      await deleteSession();
      sessionStartRef.current = Date.now();
      setUptime("00:00");
      setFixResult(null);
      await fetchData();
      setQueryResponse("Session reset successfully!");
    } catch (err) {
      setQueryResponse("Error resetting session");
    }
  };

  // Handle applying routing fix
  const handleApplyFix = async () => {
    setApplyingFix(true);
    try {
      const result = await applySuggestion();
      setFixResult(result);
      await fetchData();
    } catch (err) {
      setFixResult({ success: false, message: "Failed to apply fix", change: null });
    } finally {
      setApplyingFix(false);
    }
  };

  // Find latest audit event for budget
  const latestQueryEvent = useMemo(() => {
    return eventRecords.find((e) => e.category !== POLICY_CHANGE_CATEGORY);
  }, [eventRecords]);

  const latestAuditEvent = latestQueryEvent?.audit_event;
  const budgetProgress = useMemo(() => {
    if (!latestAuditEvent?.budget_state) {
      return { remaining: 0.02, max: 0.02, percent: 100 };
    }
    const { remaining, max } = latestAuditEvent.budget_state;
    const percent = Math.max(0, (remaining / max) * 100);
    return { remaining, max, percent };
  }, [latestAuditEvent]);

  // Determine budget color
  const isBudgetWarning =
    latestAuditEvent &&
    (latestAuditEvent.action === "stop" || budgetProgress.percent <= 0);
  const isBudgetCaution = budgetProgress.percent < 40 && !isBudgetWarning;

  // Prepare chart data and policy change timestamps
  const chartData = useMemo(() => {
    return [...eventRecords]
      .filter((e) => e.category !== POLICY_CHANGE_CATEGORY)
      .reverse()
      .map((record, index) => ({
        index,
        cost: record.audit_event.cost_total,
        timestamp: formatTime(record.timestamp_ms),
        timestampMs: record.timestamp_ms,
      }));
  }, [eventRecords]);

  // Calculate cumulative cost
  const chartDataWithCumulative = useMemo(() => {
    let cumulative = 0;
    return chartData.map((d) => {
      cumulative += d.cost;
      return { ...d, cumulative };
    });
  }, [chartData]);

  // Get policy change events for chart markers
  const policyChangeTimestamps = useMemo(() => {
    return eventRecords
      .filter((e) => e.category === POLICY_CHANGE_CATEGORY)
      .map((e) => e.timestamp_ms);
  }, [eventRecords]);

  // Check if suggestion is for sensitive data
  const isSensitiveSuggestion =
    insights?.routing_suggestion?.category === "sensitive_data";

  return (
    <div className="min-h-screen p-6 md:p-10 bg-gradient-to-br from-[#09080d] via-[#0f172a] to-[#09080d] text-slate-200">
      {/* Header */}
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">
            Obsidian
          </h1>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse-dot" />
            <span className="font-mono-data text-slate-400">MONITORING</span>
            <span className="text-slate-700">·</span>
            <span className="font-mono-data text-slate-400">{uptime}</span>
            <span className="text-slate-700">·</span>
            <span className="font-mono-data text-slate-400">
              {eventRecords.length} events
            </span>
          </div>
        </div>
        <button
          onClick={handleResetSession}
          className="flex items-center gap-2 px-5 py-2 rounded-md border border-violet-500/30 bg-violet-950/30 text-violet-300 text-sm font-medium hover:bg-violet-900/40 transition-colors"
        >
          <span className="font-mono-data">RESET</span>
        </button>
      </header>

      {/* Budget Gauge */}
      <section
        className={`mb-12 border border-white/5 rounded-md p-8 ${
          isBudgetWarning
            ? "bg-red-950/20 animate-pulse-warning"
            : isBudgetCaution
            ? "bg-amber-950/10"
            : "bg-violet-950/10"
        }`}
      >
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">
              Budget Remaining
            </p>
            <p
              className={`text-6xl font-mono-data font-bold ${
                isBudgetWarning
                  ? "text-red-400"
                  : isBudgetCaution
                  ? "text-amber-400"
                  : "text-violet-400"
              }`}
            >
              ${budgetProgress.remaining.toFixed(4)}
            </p>
          </div>
          <p className="text-slate-500 font-mono-data text-lg">
            of ${budgetProgress.max.toFixed(2)}
          </p>
        </div>
        <div className="h-3 w-full bg-white/5 rounded-sm overflow-hidden">
          <motion.div
            className={`h-full ${
              isBudgetWarning
                ? "bg-red-500"
                : isBudgetCaution
                ? "bg-amber-500"
                : "bg-violet-500"
            }`}
            initial={{ width: "100%" }}
            animate={{ width: `${budgetProgress.percent}%` }}
            transition={{ type: "spring", stiffness: 50, damping: 20 }}
          />
        </div>
      </section>

      {/* Live Query */}
      <section className="mb-12 border border-white/5 rounded-md p-5">
        <div className="flex gap-3">
          <div className="flex items-center gap-2 text-slate-400 font-mono-data text-sm">
            <span>❯</span>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmitQuery()}
            placeholder="Type a query..."
            className="flex-1 bg-transparent border-none text-slate-200 placeholder-slate-600 font-mono-data text-sm focus:outline-none focus:ring-0"
          />
          <button
            onClick={handleSubmitQuery}
            disabled={loading}
            className="px-5 py-2 rounded-sm bg-violet-950/40 text-violet-300 text-xs font-mono-data font-medium hover:bg-violet-900/50 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                [ ]
              </motion.span>
            ) : (
              "SEND"
            )}
          </button>
        </div>
        <AnimatePresence>
          {queryResponse && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-5 pt-5 border-t border-white/5"
            >
              <pre className="text-sm text-slate-400 font-mono-data whitespace-pre-wrap">
                {queryResponse}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Chart + Routing Policy + Insights */}
        <div className="lg:col-span-7 space-y-10">
          {/* Cost Curve Chart */}
          <section className="border border-white/5 rounded-md p-7">
            <div className="flex items-center justify-between mb-7">
              <h2 className="text-slate-300 text-sm uppercase tracking-widest">
                Cost Curve
              </h2>
              <p className="text-slate-600 text-xs font-mono-data">
                {chartData.length} data points
              </p>
            </div>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartDataWithCumulative}
                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="timestamp"
                    stroke="#475569"
                    tick={{ fontSize: 10, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#475569"
                    tick={{ fontSize: 10, fontFamily: "monospace" }}
                    tickFormatter={(value) => `$${value.toFixed(3)}`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#09080d",
                      borderColor: "rgba(255,255,255,0.1)",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                    itemStyle={{ color: "#e2e8f0" }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCost)"
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#94a3b8"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    fill="transparent"
                  />
                  {/* Add reference lines for policy changes */}
                  {policyChangeTimestamps.map((ts, i) => {
                    // Find the nearest chart data point to place the ref line
                    const nearestData = chartDataWithCumulative.reduce((nearest, d) =>
                      Math.abs(d.timestampMs - ts) < Math.abs(nearest.timestampMs - ts)
                        ? d
                        : nearest
                    );
                    return (
                      <ReferenceLine
                        key={i}
                        x={nearestData.timestamp}
                        stroke="#7c3aed"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        label={{
                          position: "top",
                          value: "🔄",
                          fill: "#7c3aed",
                          fontSize: 12,
                        }}
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Routing Policy Panel */}
          <section className="border border-white/5 rounded-md p-7">
            <h2 className="text-slate-300 text-sm uppercase tracking-widest mb-6">
              Routing Policy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(routingPolicy).map(([category, model]) => (
                <div
                  key={category}
                  className={`p-4 rounded-md border ${
                    model !== DEFAULT_MODEL
                      ? "border-violet-500/30 bg-violet-950/10"
                      : "border-white/5 bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300 capitalize">
                      {category.replace(/_/g, " ")}
                    </span>
                    {model !== DEFAULT_MODEL && (
                      <span className="text-xs font-mono-data text-violet-400">
                        Optimized
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono-data text-slate-400">{model}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Insights + Decision Feed */}
        <div className="lg:col-span-5 space-y-10">
          {/* Insights Panel */}
          <section className="border border-white/5 rounded-md p-7">
            <h2 className="text-slate-300 text-sm uppercase tracking-widest mb-6">
              Insights
            </h2>
            {insights && (insights.reflect || insights.routing_suggestion) ? (
              <div className="space-y-5">
                {insights.reflect && (
                  <div className="border-l-2 border-violet-500/50 pl-5">
                    <p className="text-slate-200 text-sm leading-relaxed">
                      {insights.reflect}
                    </p>
                  </div>
                )}
                {insights.routing_suggestion && (
                  <div className="p-4 bg-violet-950/20 rounded-md border border-violet-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-mono-data text-slate-400">
                        Suggestion
                      </p>
                      {insights.routing_suggestion.escalation_rate && (
                        <span className="text-xs font-mono-data text-amber-400">
                          {insights.routing_suggestion.escalation_rate * 100}% escalation
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-300 mb-4">
                      {typeof insights.routing_suggestion.suggestion === "string"
                        ? insights.routing_suggestion.suggestion
                        : JSON.stringify(insights.routing_suggestion, null, 2)}
                    </p>
                    <p className="text-violet-400 text-xs font-mono-data mt-2">
                      ✅ Fix will be applied automatically on next query!
                    </p>
                    <button
                      onClick={handleApplyFix}
                      disabled={applyingFix || isSensitiveSuggestion}
                      className={`w-full py-2 rounded-sm text-xs font-mono-data font-medium transition-colors ${
                        isSensitiveSuggestion
                          ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                          : "bg-violet-950/40 text-violet-300 hover:bg-violet-900/50 disabled:opacity-50"
                      }`}
                    >
                      {applyingFix ? (
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        >
                          [ ]
                        </motion.span>
                      ) : isSensitiveSuggestion ? (
                        "Governance Guardrail: Cannot Auto-Optimize Sensitive Data"
                      ) : (
                        "Apply Autonomous Fix"
                      )}
                    </button>
                    {fixResult && (
                      <div
                        className={`mt-4 p-3 rounded-sm text-xs font-mono-data ${
                          fixResult.success
                            ? "bg-emerald-950/30 text-emerald-300"
                            : "bg-red-950/30 text-red-300"
                        }`}
                      >
                        {fixResult.message}
                        {fixResult.change && (
                          <div className="mt-2 text-slate-400">
                            {fixResult.change.old_model} → {fixResult.change.new_model}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-600 text-sm font-mono-data">
                Awaiting pattern — {Math.max(0, 10 - eventRecords.length)} more queries
                until next check
              </div>
            )}
          </section>

          {/* Live Decision Feed */}
          <section className="border border-white/5 rounded-md overflow-hidden">
            <div className="px-7 py-5 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-slate-300 text-sm uppercase tracking-widest">
                Decision Feed
              </h2>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-slate-500 uppercase tracking-wider bg-white/[0.02] sticky top-0">
                  <tr>
                    <th className="px-7 py-3 font-mono-data">Time</th>
                    <th className="px-7 py-3">Category</th>
                    <th className="px-7 py-3 text-right font-mono-data">Cost</th>
                    <th className="px-7 py-3 text-right font-mono-data">Latency</th>
                    <th className="px-7 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <AnimatePresence initial={false}>
                    {eventRecords.map((record, i) => {
                      const isPolicyChange = record.category === POLICY_CHANGE_CATEGORY;
                      const ae = record.audit_event;
                      return (
                        <motion.tr
                          key={`${record.timestamp_ms}-${i}`}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className={`border-t border-white/5 hover:bg-white/[0.03] ${
                            isPolicyChange ? "bg-violet-950/10" : ""
                          }`}
                        >
                          <td className="px-7 py-4 text-slate-500 font-mono-data">
                            {formatTime(record.timestamp_ms)}
                          </td>
                          <td className="px-7 py-4 text-slate-300 capitalize">
                            {isPolicyChange
                              ? "Policy Update"
                              : record.category.replace(/_/g, " ")}
                          </td>
                          {isPolicyChange ? (
                            <>
                              <td className="px-7 py-4 text-right" colSpan={3}>
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-sm bg-violet-950/40 text-violet-300 text-xs font-mono-data font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                                  {ae.affected_category}: {ae.old_model} →{" "}
                                  {ae.new_model}
                                </span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-7 py-4 text-right text-slate-200 font-mono-data">
                                ${ae.cost_total.toFixed(4)}
                              </td>
                              <td className="px-7 py-4 text-right text-slate-400 font-mono-data">
                                {formatLatency(ae.latency_used_ms)}
                              </td>
                              <td className="px-7 py-4 text-right">
                                {ae.action === "allow" ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-sm bg-emerald-950/40 text-emerald-300 text-xs font-mono-data font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    ALLOW
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-sm bg-red-950/40 text-red-300 text-xs font-mono-data font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    STOP
                                  </span>
                                )}
                              </td>
                            </>
                          )}
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            {error && (
              <div className="px-7 py-5 text-red-400 text-sm font-mono-data border-t border-white/5">
                {error}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
