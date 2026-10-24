"use client";

import { useState, useEffect } from "react";
import type { SystemSpecs } from "@/lib/systemSpecs";

interface SystemInfo {
  platform: string;
  release: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  cpuLogicalProcessors?: number;
  totalMemoryGb: string;
  usedMemoryGb: string;
  memoryUsagePercent: number;
  uptimeSeconds: number;
  nodeVersion: string;
  timestamp: string;
  approvedSites: string[];
  manufacturer?: string;
  model?: string;
  primaryGpu?: string;
  osName?: string;
  osBuild?: string;
  osDisplayVersion?: string;
}

interface ReminderItem {
  id: string;
  title: string;
  due_time: string;
  completed: number;
  created_at: number;
}

export default function SystemScreen() {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [specs, setSpecs] = useState<SystemSpecs | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [newReminderText, setNewReminderText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [diagOutput, setDiagOutput] = useState<string | null>(null);
  const [confirmLockdown, setConfirmLockdown] = useState(false);

  // Update clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour12: true }));
      setCurrentDate(
        d.toLocaleDateString("en-US", {
          timeZone: "Asia/Kolkata",
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch System info and verified specs
  useEffect(() => {
    fetch("/api/system")
      .then((res) => res.json())
      .then((data) => {
        if (data.system) setSysInfo(data.system);
        if (data.specs) setSpecs(data.specs);
      })
      .catch(() => {});
  }, []);

  // Fetch Reminders
  const loadReminders = () => {
    fetch("/api/reminders")
      .then((res) => res.json())
      .then((data) => setReminders(data.reminders || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const handleLaunchSite = async (siteKey: string) => {
    try {
      const res = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_site", target: siteKey }),
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      // ignore
    }
  };

  const handleWebSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search_web", query: searchQuery.trim() }),
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
      setSearchQuery("");
    } catch {
      // ignore
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderText.trim()) return;
    try {
      await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newReminderText.trim(), due_time: "Today" }),
      });
      setNewReminderText("");
      loadReminders();
    } catch {
      // ignore
    }
  };

  const handleToggleReminder = async (id: string, currentStatus: number) => {
    try {
      await fetch("/api/reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, completed: currentStatus ? 0 : 1 }),
      });
      loadReminders();
    } catch {
      // ignore
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await fetch(`/api/reminders?id=${id}`, { method: "DELETE" });
      loadReminders();
    } catch {
      // ignore
    }
  };

  const handleRunDiagnostic = async () => {
    setDiagOutput("Initiating full telemetry scan...");
    try {
      const res = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_diagnostic" }),
      });
      const data = await res.json();
      setDiagOutput(data.message || "Diagnostic completed.");
    } catch {
      setDiagOutput("Diagnostic communication fault.");
    }
  };

  return (
    <div className="screen-system-container">
      {/* Top Banner: Time & Date */}
      <div className="system-top-banner">
        <div className="system-clock-box">
          <span className="clock-time">{currentTime}</span>
          <span className="clock-date">{currentDate}</span>
        </div>
        <div className="system-header-title">
          <span>J.A.R.V.I.S. SYSTEM CONTROLS & DIAGNOSTICS</span>
          <span className="header-sub">WORKSTATION TELEMETRY</span>
        </div>
      </div>

      <div className="system-grid-layout">
        {/* Card 1: Hardware Telemetry */}
        <div className="system-card">
          <div className="system-card-header">
            <span>HARDWARE DIAGNOSTICS</span>
            <span className="card-tag">HOST</span>
          </div>
          <div className="system-card-body">
            {sysInfo ? (
              <div className="sys-metrics-list">
                <div className="sys-metric-row">
                  <span className="lbl">LAPTOP MODEL:</span>
                  <span className="val highlight">
                    {specs ? `${specs.manufacturer} ${specs.model}` : sysInfo.model ? `${sysInfo.manufacturer || ""} ${sysInfo.model}` : "HP OmniBook 5 Laptop"}
                  </span>
                </div>
                <div className="sys-metric-row">
                  <span className="lbl">PROCESSOR (CPU):</span>
                  <span className="val">
                    {specs?.cpuName || sysInfo.cpuModel} ({specs?.cpuCores || sysInfo.cpuCores} Cores / {specs?.cpuLogicalProcessors || sysInfo.cpuLogicalProcessors || "--"} Threads)
                  </span>
                </div>
                <div className="sys-metric-row">
                  <span className="lbl">MEMORY (RAM):</span>
                  <span className="val">
                    {specs?.usedMemoryGb ?? sysInfo.usedMemoryGb} GB / {specs?.totalMemoryGb ?? sysInfo.totalMemoryGb} GB ({specs?.memoryUsagePercent ?? sysInfo.memoryUsagePercent}%)
                  </span>
                </div>
                <div className="sys-metric-row">
                  <span className="lbl">GRAPHICS (GPU):</span>
                  <span className="val">
                    {specs?.primaryGpu || sysInfo.primaryGpu || "AMD Radeon(TM) Graphics"}
                    {specs?.gpus[0]?.vramMb ? ` (${(specs.gpus[0].vramMb / 1024).toFixed(1)} GB VRAM)` : ""}
                  </span>
                </div>
                <div className="sys-metric-row">
                  <span className="lbl">OPERATING SYSTEM:</span>
                  <span className="val">
                    {specs?.osName || sysInfo.osName || "Microsoft Windows 11"} ({specs?.osDisplayVersion || sysInfo.osDisplayVersion || "26H2"} Build {specs?.osBuild || sysInfo.osBuild || "--"}, {specs?.osArch || sysInfo.arch})
                  </span>
                </div>
                {specs && specs.disks.length > 0 && (
                  <div className="sys-metric-row disks-row">
                    <span className="lbl">STORAGE DRIVES:</span>
                    <span className="val">
                      {specs.disks.map((d) => `[${d.drive} ${d.freeGb}G free / ${d.totalGb}G]`).join("  ")}
                    </span>
                  </div>
                )}
                {specs && (
                  <div className="sys-metric-row">
                    <span className="lbl">BATTERY STATUS:</span>
                    <span className="val battery-val">
                      {specs.battery.statusText || "AC Power Connected"}
                    </span>
                  </div>
                )}
                <div className="sys-metric-row">
                  <span className="lbl">HOST UPTIME:</span>
                  <span className="val">
                    {specs ? `${specs.uptimeHours}h ${specs.uptimeMinutes}m` : `${Math.round(sysInfo.uptimeSeconds / 3600)} Hours`} · Node.js {sysInfo.nodeVersion}
                  </span>
                </div>
              </div>
            ) : (
              <div className="sys-loading">Scanning host telemetry...</div>
            )}

            <div className="system-diag-action-box">
              <button type="button" className="diag-trigger-btn" onClick={handleRunDiagnostic}>
                RUN FULL LAB DIAGNOSTIC
              </button>
              {diagOutput && <div className="diag-output-text">{diagOutput}</div>}
            </div>
          </div>
        </div>

        {/* Card 2: Approved Tool Launchers */}
        <div className="system-card">
          <div className="system-card-header">
            <span>APPROVED ASSISTANT TOOLS</span>
            <span className="card-tag">SAFE</span>
          </div>
          <div className="system-card-body">
            <span className="tools-desc">Authorized safe web destinations (permission checked):</span>
            <div className="site-launcher-buttons">
              {["google", "github", "wikipedia", "arxiv", "youtube"].map((site) => (
                <button
                  key={site}
                  type="button"
                  className="site-btn"
                  onClick={() => handleLaunchSite(site)}
                >
                  [ OPEN {site.toUpperCase()} ]
                </button>
              ))}
            </div>

            {/* Safe Web Search Form */}
            <form className="safe-search-form" onSubmit={handleWebSearch}>
              <span className="search-label">&gt; SAFE RESEARCH SEARCH:</span>
              <div className="search-input-row">
                <input
                  type="text"
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter scientific query (e.g. 'Quantum entanglement arXiv')..."
                />
                <button type="submit" className="search-submit-btn">
                  SEARCH
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Card 3: Reminders & Task Directives */}
        <div className="system-card">
          <div className="system-card-header">
            <span>LAB DIRECTIVES & REMINDERS</span>
            <span className="card-tag">PERSISTENT</span>
          </div>
          <div className="system-card-body">
            <form className="reminder-add-form" onSubmit={handleAddReminder}>
              <input
                type="text"
                className="reminder-input"
                value={newReminderText}
                onChange={(e) => setNewReminderText(e.target.value)}
                placeholder="New directive (e.g. 'Calibrate arc capacitor')..."
              />
              <button type="submit" className="reminder-add-btn">
                + ADD
              </button>
            </form>

            <div className="reminders-scroll-list">
              {reminders.length === 0 ? (
                <div className="no-reminders">No pending directives recorded.</div>
              ) : (
                reminders.map((r) => (
                  <div key={r.id} className={`reminder-item ${r.completed ? "done" : ""}`}>
                    <input
                      type="checkbox"
                      checked={Boolean(r.completed)}
                      onChange={() => handleToggleReminder(r.id, r.completed)}
                      className="reminder-checkbox"
                    />
                    <span className="reminder-title">{r.title}</span>
                    <button
                      type="button"
                      className="reminder-del-btn"
                      onClick={() => handleDeleteReminder(r.id)}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Security Lockdown Gate */}
        <div className="system-card security-card">
          <div className="system-card-header">
            <span>SECURITY PROTOCOL GATE</span>
            <span className="card-tag red">RESTRICTED</span>
          </div>
          <div className="system-card-body">
            <p className="security-desc">
              High-consequence system operations require explicit manual authorization to execute.
            </p>
            {confirmLockdown ? (
              <div className="confirm-lockdown-box">
                <span className="confirm-warning">CONFIRM LAB LOCKDOWN PROTOCOL?</span>
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="confirm-yes-btn"
                    onClick={() => {
                      setDiagOutput("PERIMETER LOCKDOWN ENGAGED. Interface secured.");
                      setConfirmLockdown(false);
                    }}
                  >
                    CONFIRM LOCKDOWN
                  </button>
                  <button
                    type="button"
                    className="confirm-no-btn"
                    onClick={() => setConfirmLockdown(false)}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="lockdown-trigger-btn"
                onClick={() => setConfirmLockdown(true)}
              >
                ENGAGE PERIMETER LOCKDOWN
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
