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
  ReferenceLine
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { getEvents, getInsights, postQuery, deleteSession, postAsk, type EventRecord, type AuditEvent } from "@/lib/api";

// Utility functions for formatting
const formatLatency = (ms: number): string => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms.toFixed(0)}ms`;
};

const formatTime = (timestampMs: number): string => {
  const date = new Date(timestampMs);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export default function Home() {
  const [eventRecords, setEventRecords] = useState<EventRecord[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [queryResponse, setQueryResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setUptime(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [eventsResponse, insightsData] = await Promise.all([getEvents(), getInsights()]);
      const sortedEvents = [...eventsResponse.events].sort((a, b) => b.timestamp_ms - a.timestamp_ms);
      setEventRecords(sortedEvents);
      setInsights(insightsData);
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

  const handleResetSession = async () => {
    try {
      await deleteSession();
      sessionStartRef.current = Date.now();
      setUptime("00:00");
      await fetchData();
      setQueryResponse("Session reset successfully!");
    } catch (err) {
      setQueryResponse("Error resetting session");
    }
  };

  const handleAsk = async (overrideQuestion?: string) => {
    const question = (overrideQuestion ?? askInput).trim();
    if (!question || askLoading) return;
    setAskInput("");
    setAskMessages(prev => [...prev, { role: "user", text: question }]);
    setAskLoading(true);
    try {
      const res = await postAsk(question);
      setAskMessages(prev => [...prev, { role: "assistant", text: res.answer }]);
    } catch {
      setAskMessages(prev => [...prev, { role: "assistant", text: "⚠️ Could not reach Obsidian backend." }]);
    } finally {
      setAskLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  const latestEvent = eventRecords[0];
  const latestAuditEvent = latestEvent?.audit_event;
  const isWarning = latestAuditEvent && (latestAuditEvent.action === "stop" || latestAuditEvent.budget_state.remaining <= 0);

  // Calculate budget state
  const budgetProgress = useMemo(() => {
    if (!latestAuditEvent) return { remaining: 0.02, max: 0.02, percent: 100 };
    const { remaining, max } = latestAuditEvent.budget_state;
    const percent = Math.max(0, (remaining / max) * 100);
    return { remaining, max, percent };
  }, [latestAuditEvent]);

  // Determine budget color
  const getBudgetColor = () => {
    if (isWarning) return "text-red-400";
    if (budgetProgress.percent < 40) return "text-amber-400";
    return "text-violet-400";
  };

  const getBudgetBarColor = () => {
    if (isWarning) return "bg-red-500";
    if (budgetProgress.percent < 40) return "bg-amber-500";
    return "bg-violet-500";
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    return [...eventRecords].reverse().map((record, index) => ({
      index,
      cost: record.audit_event.cost_total,
      timestamp: formatTime(record.timestamp_ms)
    }));
  }, [eventRecords]);

  // Calculate cumulative cost
  const chartDataWithCumulative = useMemo(() => {
    let cumulative = 0;
    return chartData.map(d => {
      cumulative += d.cost;
      return { ...d, cumulative };
    });
  }, [chartData]);

  const previousIdsRef = useRef<string[]>([]);

  return (
    <div className="min-h-screen p-6 md:p-10">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-4xl font-bold tracking-tight text-slate-100">Obsidian</h1>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse-dot" />
            <span className="font-mono-data">MONITORING</span>
            <span className="text-slate-700">·</span>
            <span className="font-mono-data">{uptime}</span>
            <span className="text-slate-700">·</span>
            <span className="font-mono-data">{eventRecords.length} events</span>
          </div>
        </div>
        <button
          onClick={handleResetSession}
          className="flex items-center gap-2 px-4 py-2 rounded-md border border-violet-500/30 bg-violet-950/40 text-violet-300 text-sm font-medium hover:bg-violet-900/50 transition-colors"
        >
          <span className="font-mono-data">RESET</span>
        </button>
      </header>

      {/* Budget Gauge */}
      <section className={`mb-10 border border-white/5 rounded-md p-6 ${isWarning ? 'animate-pulse-warning' : ''}`}>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Budget Remaining</p>
            <p className={`text-5xl font-mono-data font-bold ${getBudgetColor()}`}>
              ${budgetProgress.remaining.toFixed(4)}
            </p>
          </div>
          <p className="text-slate-500 font-mono-data text-sm">
            of ${budgetProgress.max.toFixed(2)}
          </p>
        </div>
        <div className="h-2 w-full bg-white/5 rounded-sm overflow-hidden">
          <motion.div
            className={`h-full ${getBudgetBarColor()}`}
            initial={{ width: "100%" }}
            animate={{ width: `${budgetProgress.percent}%` }}
            transition={{ type: "spring", stiffness: 50, damping: 20 }}
          />
        </div>
      </section>

      {/* Live Query */}
      <section className="mb-10 border border-white/5 rounded-md p-4">
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
            className="px-4 py-1 rounded-sm bg-violet-950/60 text-violet-300 text-xs font-mono-data font-medium hover:bg-violet-900/60 transition-colors disabled:opacity-50 flex items-center gap-2"
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
              className="mt-4 pt-4 border-t border-white/5"
            >
              <pre className="text-sm text-slate-400 font-mono-data whitespace-pre-wrap">
                {queryResponse}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Cost Curve Chart (7 cols) */}
        <section className="lg:col-span-7 border border-white/5 rounded-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-slate-300 text-sm uppercase tracking-widest">Cost Curve</h2>
            <p className="text-slate-600 text-xs font-mono-data">{chartData.length} data points</p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDataWithCumulative} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
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
                  contentStyle={{ backgroundColor: "#09080d", borderColor: "rgba(255,255,255,0.1)", fontFamily: "monospace", fontSize: "12px" }}
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
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="lg:col-span-5 space-y-8">
          {/* Live Decision Feed */}
          <section className="border border-white/5 rounded-md overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-slate-300 text-sm uppercase tracking-widest">Decision Feed</h2>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-slate-500 uppercase tracking-wider bg-white/[0.02] sticky top-0">
                  <tr>
                    <th className="px-6 py-3 font-mono-data">Time</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3 text-right font-mono-data">Cost</th>
                    <th className="px-6 py-3 text-right font-mono-data">Latency</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <AnimatePresence initial={false}>
                    {eventRecords.map((record, i) => (
                      <motion.tr
                        key={`${record.timestamp_ms}-${i}`}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-white/5 hover:bg-white/[0.03]"
                      >
                        <td className="px-6 py-3 text-slate-500 font-mono-data">{formatTime(record.timestamp_ms)}</td>
                        <td className="px-6 py-3 text-slate-300 capitalize">{record.category}</td>
                        <td className="px-6 py-3 text-right text-slate-200 font-mono-data">
                          ${record.audit_event.cost_total.toFixed(4)}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-400 font-mono-data">
                          {formatLatency(record.audit_event.latency_used_ms)}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {record.audit_event.action === "allow" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-emerald-950/60 text-emerald-300 text-xs font-mono-data font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              ALLOW
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-red-950/60 text-red-300 text-xs font-mono-data font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              STOP
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            {error && (
              <div className="px-6 py-4 text-red-400 text-sm font-mono-data border-t border-white/5">
                {error}
              </div>
            )}
          </section>

          {/* Insights Panel */}
          <section className="border border-white/5 rounded-md p-6">
            <h2 className="text-slate-300 text-sm uppercase tracking-widest mb-4">Insights</h2>
            {insights && (insights.reflect || insights.routing_suggestion) ? (
              <div className="space-y-4">
                {insights.reflect && (
                  <div className="border-l-2 border-violet-500/50 pl-4">
                    <p className="text-slate-200 text-sm leading-relaxed">{insights.reflect}</p>
                  </div>
                )}
                {insights.routing_suggestion && (
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono-data">
                    <span className="text-slate-600">Suggestion:</span>
                    {typeof insights.routing_suggestion === 'string' ? (
                      <span>{insights.routing_suggestion}</span>
                    ) : (
                      <pre className="whitespace-pre-wrap">{JSON.stringify(insights.routing_suggestion, null, 2)}</pre>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-600 text-sm font-mono-data">
                Awaiting pattern — {Math.max(0, 10 - eventRecords.length)} more queries until next check
              </div>
            )}
          </section>

          {/* Ask Obsidian Chat Panel */}
          <section className="border border-violet-500/20 rounded-md overflow-hidden bg-violet-950/10">
            <div className="px-5 py-4 border-b border-violet-500/15 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              <h2 className="text-violet-300 text-sm font-semibold tracking-widest uppercase">Ask Obsidian</h2>
              <span className="ml-auto text-xs text-slate-600 font-mono-data">AI · powered by Hindsight</span>
            </div>

            {/* Chat messages */}
            <div className="max-h-72 overflow-y-auto px-5 py-4 space-y-4 flex flex-col">
              {askMessages.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-slate-500 text-xs mb-4 font-mono-data">Ask anything about the audit history:</p>
                  <div className="flex flex-col gap-2">
                    {[
                      "Which category burns the most budget?",
                      "Why are some queries more expensive?",
                      "What would happen if budget was $0.01?"
                    ].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => handleAsk(suggestion)}
                        className="text-left text-xs text-violet-400/70 hover:text-violet-300 border border-violet-500/15 hover:border-violet-500/40 rounded px-3 py-2 transition-all font-mono-data"
                      >
                        ↗ {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <AnimatePresence initial={false}>
                {askMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex gap-2 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5">
                        ◆
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] text-xs leading-relaxed rounded px-3 py-2 font-mono-data ${
                        msg.role === "user"
                          ? "bg-slate-800 text-slate-200 rounded-tr-none"
                          : "bg-violet-950/60 text-slate-300 border border-violet-500/20 rounded-tl-none"
                      }`}
                    >
                      {msg.text}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-[10px] shrink-0 mt-0.5">
                        ↑
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {askLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2 justify-start"
                >
                  <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5">
                    ◆
                  </div>
                  <div className="bg-violet-950/60 border border-violet-500/20 rounded rounded-tl-none px-3 py-2 flex gap-1 items-center">
                    {[0, 1, 2].map(d => (
                      <motion.span
                        key={d}
                        className="w-1 h-1 rounded-full bg-violet-400"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input row */}
            <div className="px-5 py-3 border-t border-violet-500/15 flex gap-3 items-center">
              <input
                id="ask-obsidian-input"
                type="text"
                value={askInput}
                onChange={e => setAskInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAsk()}
                placeholder="Ask about cost, decisions, patterns…"
                disabled={askLoading}
                className="flex-1 bg-transparent border-none text-slate-200 placeholder-slate-600 font-mono-data text-xs focus:outline-none focus:ring-0 disabled:opacity-40"
              />
              <button
                id="ask-obsidian-send"
                onClick={() => handleAsk()}
                disabled={askLoading || !askInput.trim()}
                className="px-3 py-1.5 rounded-sm bg-violet-600/30 text-violet-300 text-xs font-mono-data font-medium hover:bg-violet-600/50 transition-colors disabled:opacity-30"
              >
                ASK
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
