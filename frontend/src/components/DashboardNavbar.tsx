"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", href: "/dashboard" },
  { id: "analytics", label: "Analytics", href: "/dashboard/analytics" },
  { id: "query", label: "Query", href: "/dashboard/query" },
  { id: "events", label: "Events", href: "/dashboard/events" },
  { id: "insights", label: "Insights", href: "/dashboard/insights" },
  { id: "session", label: "Session", href: "/dashboard/session" },
  { id: "health", label: "Health", href: "/dashboard/health" },
  { id: "settings", label: "Settings", href: "/dashboard/settings" },
];

export default function DashboardNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <div className="w-full flex justify-center mb-6 pt-6 px-4">
      <nav
        className="flex items-center justify-between px-4 py-2 w-full max-w-6xl rounded-full relative"
        style={{
          background: "rgba(17, 24, 39, 0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.3)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0 mr-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-indigo-500 shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L3 7V12C3 16.55 6.84 20.74 12 22C17.16 20.74 21 16.55 21 12V7L12 2Z"
                fill="white"
                fillOpacity="0.95"
              />
            </svg>
          </div>
          <span className="text-gray-100 font-bold text-[16px] tracking-wide hidden sm:block">
            Obsidian
          </span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`px-3 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 whitespace-nowrap ${
                  active
                    ? "bg-gray-800 text-white shadow-sm border border-gray-600"
                    : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>


      </nav>
    </div>
  );
}
