'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Ferrofluid from '@/components/Ferrofluid';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      {/* Background Ferrofluid */}
      <div className="fixed inset-0 z-0">
        <Ferrofluid
          colors={['#2DD4BF', '#A78BFA', '#C4B5FD', '#F472B6']}
          speed={0.5}
          scale={1.4}
          turbulence={1.2}
          fluidity={0.15}
          rimWidth={0.3}
          sharpness={2.5}
          shimmer={2.2}
          glow={3.5}
          flowDirection="down"
          opacity={0.8}
          mouseInteraction={true}
          mouseStrength={1.4}
          mouseRadius={0.4}
        />
        {/* Gradient overlay to ensure readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#03010A]/50 via-[#03010A]/60 to-[#03010A]" />
      </div>

      <div className="relative z-10">
        {/* Navbar */}
        <nav className="flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-indigo-500 shadow-lg shadow-teal-500/20">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L3 7V12C3 16.55 6.84 20.74 12 22C17.16 20.74 21 16.55 21 12V7L12 2Z"
                  fill="white"
                  fillOpacity="0.95"
                />
              </svg>
            </div>
            <span className="text-white font-bold text-xl tracking-wide">Obsidian</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="btn btn-ghost">
              Open Dashboard
            </Link>
            <Link href="/dashboard" className="btn btn-primary">
              Get Started
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="py-16 md:py-24 px-6">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 mb-6">
                <span className="status-dot online" />
                <span className="text-sm font-medium text-gray-300">Hackathon Winner 2025</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-400">
                  AI Governance &amp; Cost Audit
                </span>
                <br />
                for your AI Agents
              </h1>
              <p className="text-lg text-gray-300 mb-8 max-w-xl">
                Obsidian acts as your seatbelt and dashboard between your applications and LLM providers — enforcing budgets, compliance rules, and giving you full real-time visibility.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/dashboard" className="btn btn-primary px-8 py-3 text-base">
                  Launch Dashboard
                </Link>
                <button className="btn btn-ghost px-8 py-3 text-base">
                  View Documentation
                </button>
              </div>
            </motion.div>

            {/* Hero Dashboard Preview */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="card p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-xs text-gray-400 font-mono">obsidian-dashboard</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="card p-4">
                  <div className="text-sm text-gray-400 mb-1">Remaining Budget</div>
                  <div className="text-2xl font-bold text-white font-mono-data">$1.00</div>
                  <div className="mt-3">
                    <div className="progress-track">
                      <div className="progress-fill bg-gradient-to-r from-teal-500 to-indigo-500" style={{ width: '100%' }} />
                    </div>
                  </div>
                </div>
                <div className="card p-4">
                  <div className="text-sm text-gray-400 mb-1">Queries Today</div>
                  <div className="text-2xl font-bold text-teal-400 font-mono-data">247</div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l4 4-4 4" />
                      <path d="M12 6H8a4 4 0 0 0-4 4v2" />
                    </svg>
                    +12% from yesterday
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm text-gray-400 font-semibold">Recent Events</div>
                {[
                  { type: 'ALLOW', category: 'general', model: 'llama-3.3-70b-versatile' },
                  { type: 'OPTIMIZED', category: 'refund', model: 'llama-3.1-8b-instant' },
                  { type: 'STOP', category: 'sensitive_data', model: 'llama-3.3-70b-versatile' },
                ].map((event, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
                    <div className="flex items-center gap-3">
                      <span className={`badge ${
                        event.type === 'ALLOW' ? 'badge-allow' :
                        event.type === 'OPTIMIZED' ? 'badge-switch' : 'badge-stop'
                      }`}>
                        {event.type}
                      </span>
                      <span className="text-sm text-gray-300">Category: <span className="font-mono-data text-gray-200">{event.category}</span></span>
                    </div>
                    <span className="text-xs font-mono-data text-gray-400">{event.model}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Key Features */}
        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Key Features</h2>
              <p className="text-gray-400 max-w-2xl mx-auto">Everything you need to govern, audit, and optimize your AI agents in production.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: 'Budget Enforcement',
                  desc: 'Set hard budget limits per category, project, or team. Never get surprised by your LLM bill.',
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M6 10h12M6 14h6" />
                    </svg>
                  ),
                  color: 'from-teal-500 to-teal-600'
                },
                {
                  title: 'Full Audit Logging',
                  desc: 'Every query, response, and decision is logged with full context and cost data.',
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  ),
                  color: 'from-indigo-500 to-indigo-600'
                },
                {
                  title: 'Compliance Guardrails',
                  desc: 'Prevent sensitive data from ever reaching LLM providers with configurable policies.',
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                  ),
                  color: 'from-green-500 to-green-600'
                },
                {
                  title: 'Intelligent Routing',
                  desc: 'Automatically route queries to the most cost-effective model while maintaining quality.',
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="2" />
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  ),
                  color: 'from-purple-500 to-purple-600'
                },
                {
                  title: 'Live Analytics',
                  desc: 'Monitor costs, latency, and model performance in real-time with beautiful dashboards.',
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                  ),
                  color: 'from-yellow-500 to-yellow-600'
                },
                {
                  title: 'Optimization Insights',
                  desc: 'AI-powered insights that suggest how to reduce costs while preserving quality.',
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  ),
                  color: 'from-pink-500 to-pink-600'
                }
              ].map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="card card-hover p-6"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${feature.color} mb-4 shadow-lg`}>
                    <div className="text-white">{feature.icon}</div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Use Obsidian */}
        <section className="py-16 px-6 bg-gradient-to-b from-transparent to-[#040211]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Why Use Obsidian?</h2>
              <p className="text-gray-400 max-w-2xl mx-auto">The essential tool for any serious AI deployment.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: 'Prevent Runaway Costs',
                  desc: 'Set limits, get alerts, and ensure you never exceed your budget.',
                  icon: 'shield'
                },
                {
                  title: 'Build Trust & Compliance',
                  desc: 'Full audit trail and guardrails keep you compliant with regulations.',
                  icon: 'check'
                },
                {
                  title: 'Operational Transparency',
                  desc: 'See exactly what your AI agents are doing in real time.',
                  icon: 'eye'
                }
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.15 }}
                  className="text-center"
                >
                  <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-teal-500/20 to-indigo-500/20 border border-teal-500/30">
                    {item.icon === 'shield' && (
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="1.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    )}
                    {item.icon === 'check' && (
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.5">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    )}
                    {item.icon === 'eye' && (
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.5">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-gray-400">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Benefits of Using Obsidian</h2>
                <div className="space-y-6">
                  {[
                    {
                      title: 'Lower Spend',
                      desc: 'Intelligent model routing can reduce your LLM costs by up to 70%.',
                      stat: '70%'
                    },
                    {
                      title: 'Safer Deployments',
                      desc: 'Compliance guardrails prevent sensitive data leaks.',
                      stat: '100%'
                    },
                    {
                      title: 'Faster Debugging',
                      desc: 'Full audit logs let you trace any issue to its source.',
                      stat: '10x'
                    },
                    {
                      title: 'Data-Driven Decisions',
                      desc: 'Analytics and insights guide your AI strategy.',
                      stat: 'Yes'
                    }
                  ].map((benefit, idx) => (
                    <div key={idx} className="flex gap-4 items-start">
                      <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-400 font-mono-data shrink-0">
                        {benefit.stat}
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-white mb-1">{benefit.title}</h4>
                        <p className="text-gray-400">{benefit.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="card p-6"
              >
                <div className="text-sm text-gray-400 font-semibold mb-4">Architecture Overview</div>
                <div className="space-y-4">
                  {[
                    { name: 'FastAPI Backend', desc: 'High-performance API for routing and auditing', color: 'teal' },
                    { name: 'Next.js Dashboard', desc: 'Beautiful, real-time UI for monitoring', color: 'indigo' },
                    { name: 'CascadeFlow', desc: 'Policy enforcement engine', color: 'purple' },
                    { name: 'Hindsight', desc: 'Event store and pattern detection', color: 'pink' }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5">
                      <div className={`w-3 h-3 rounded-full ${
                        item.color === 'teal' ? 'bg-teal-500' :
                        item.color === 'indigo' ? 'bg-indigo-500' :
                        item.color === 'purple' ? 'bg-purple-500' : 'bg-pink-500'
                      }`} />
                      <div>
                        <div className="text-sm font-semibold text-white">{item.name}</div>
                        <div className="text-xs text-gray-400">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-16 px-6 bg-gradient-to-b from-[#040211] to-[#03010A]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">What People Say</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  quote: 'Obsidian saved us from a $10k bill overnight when one of our agents went into a loop.',
                  name: 'Jane Doe',
                  role: 'CTO, TechCorp'
                },
                {
                  quote: 'The audit trail has been a game-changer for our compliance team.',
                  name: 'John Smith',
                  role: 'Head of Engineering, AIStartup'
                }
              ].map((testimonial, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.15 }}
                  className="card p-6"
                >
                  <div className="text-lg text-white mb-4">"{testimonial.quote}"</div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-indigo-500 flex items-center justify-center text-white font-bold">
                      {testimonial.name[0]}
                    </div>
                    <div>
                      <div className="text-white font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-gray-400">{testimonial.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                Govern Your AI Agents with Confidence
              </h2>
              <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
                Start using Obsidian today and take control of your AI spend, compliance, and performance.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/dashboard" className="btn btn-primary px-10 py-4 text-lg">
                  Launch Dashboard Now
                </Link>
                <button className="btn btn-ghost px-10 py-4 text-lg">
                  Learn More
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-indigo-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L3 7V12C3 16.55 6.84 20.74 12 22C17.16 20.74 21 16.55 21 12V7L12 2Z"
                    fill="white"
                    fillOpacity="0.95"
                  />
                </svg>
              </div>
              <span className="text-white font-bold">Obsidian</span>
            </div>
            <div className="text-gray-400 text-sm">
              © 2025 Obsidian. Built for the AI Governance Hackathon.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
