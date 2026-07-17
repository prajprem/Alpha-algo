import { useState, useEffect } from "react";

const mono = { fontFamily: "'JetBrains Mono', monospace" };
const fmt = (v, d = 2) => v == null ? "--" : Number(v).toFixed(d);

const card = (S) => ({
  background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: 16,
});
const badge = (S, bg, fg) => ({
  display: "inline-block", padding: "2px 8px", borderRadius: 4,
  fontSize: 11, fontWeight: 600, background: bg, color: fg, ...mono,
});
const btn = (bg, fg, disabled) => ({
  padding: "6px 14px", borderRadius: 6, border: "none", cursor: disabled ? "default" : "pointer",
  fontSize: 12, fontWeight: 600, background: disabled ? "#333" : bg, color: disabled ? "#666" : fg,
  opacity: disabled ? 0.5 : 1,
});

function Metric({ label, value, color }) {
  return (
    <div style={{ background: "#0d1321", borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color || "#f9fafb", ...mono }}>{value}</div>
    </div>
  );
}

export default function FnoAgentTab({ S, toast_ }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      fetch("/api/fno-agent/status")
        .then(r => r.json()).then(d => setStatus(d)).catch(() => {});
    }, 5000);
    fetch("/api/fno-agent/status")
      .then(r => r.json()).then(d => setStatus(d)).catch(() => {});
    return () => clearInterval(iv);
  }, []);

  const start = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/fno-agent/start", { method: "POST" });
      const d = await r.json();
      if (toast_) toast_(d.status === "already_running" ? "Agent already running" : "Agent started", "info");
    } catch { if (toast_) toast_("Failed to start agent", "error"); }
    setLoading(false);
  };

  const stop = async () => {
    setLoading(true);
    try {
      await fetch("/api/fno-agent/stop", { method: "POST" });
      if (toast_) toast_("Agent stopping", "info");
    } catch { if (toast_) toast_("Failed to stop agent", "error"); }
    setLoading(false);
  };

  if (!status) {
    return (
      <div style={card(S)}>
        <div style={{ fontSize: 12, color: S.dim, padding: 20, textAlign: "center" }}>
          Connecting to F&O AI Agent...<br />
          <span style={{ fontSize: 10 }}>Ensure Express server is running on port 5000</span>
        </div>
      </div>
    );
  }

  const isRunning = status.mode === "running" || status.mode === "premarket_done";
  const pnl = status.daily_pnl || 0;
  const vix = status.vix || 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ ...card(S), display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: S.bright }}>
            {status.underlying || "NIFTY"} AI Agent
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: isRunning ? S.green : status.mode === "idle" ? S.dim : S.amber }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: S.bright, textTransform: "capitalize" }}>
              {status.mode?.replace(/_/g, " ") || "idle"}
            </span>
          </div>
          <span style={badge(S, status.paper_trade !== false ? S.amber + "22" : S.red + "22", status.paper_trade !== false ? S.amber : S.red)}>
            {status.paper_trade !== false ? "PAPER" : "LIVE"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn(isRunning ? S.dim : S.green, "#fff", loading || isRunning)} onClick={start} disabled={loading || isRunning}>
            {loading ? "..." : "Start Agent"}
          </button>
          <button style={btn(!isRunning ? S.dim : S.red, "#fff", loading || !isRunning)} onClick={stop} disabled={loading || !isRunning}>
            Stop
          </button>
        </div>
      </div>

      {/* Strategy & Regime */}
      <div style={card(S)}>
        <div style={{ fontSize: 14, fontWeight: 700, color: S.bright, marginBottom: 12 }}>Strategy Overview</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <Metric label="Regime" value={status.regime?.iv_regime || "--"} color={S.amber} />
          <Metric label="Market Bias" value={status.regime?.market_bias || "--"} color={S.blue} />
          <Metric label="Selected Strategy" value={status.strategy || "--"} color={S.green} />
          <Metric label="Confidence" value={status.regime?.confidence != null ? status.regime.confidence + "%" : "--"} color={S.bright} />
          <Metric label="Reasoning" value={status.regime?.reasoning || "--"} color={S.text} />
        </div>
      </div>

      {/* Market Data */}
      <div style={card(S)}>
        <div style={{ fontSize: 14, fontWeight: 700, color: S.bright, marginBottom: 12 }}>Market Data</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
          <Metric label="Spot Price" value={status.spot ? "Rs." + Number(status.spot).toFixed(0) : "--"} color={S.bright} />
          <Metric label="VIX" value={vix || "--"} color={vix > 18 ? S.red : vix > 14 ? S.amber : S.green} />
          <Metric label="Daily P&L" value={"Rs." + fmt(pnl, 0)} color={pnl > 0 ? S.green : pnl < 0 ? S.red : S.bright} />
          <Metric label="Risk Profile" value={(status.risk_profile || "medium").toUpperCase()} color={S.amber} />
        </div>
      </div>

      {/* Trades */}
      <div style={card(S)}>
        <div style={{ fontSize: 14, fontWeight: 700, color: S.bright, marginBottom: 12 }}>Trades</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
          <Metric label="Entered" value={status.trades_entered || 0} color={S.blue} />
          <Metric label="Closed" value={status.trades_closed || 0} color={S.green} />
          <Metric label="Kill Switch" value={status.kill_switch ? "ACTIVE" : "OFF"} color={status.kill_switch ? S.red : S.dim} />
        </div>

        {/* Open Position */}
        {status.open_position && (
          <div style={{ marginTop: 12, background: S.amber + "10", borderRadius: 6, padding: "10px 14px", border: `1px solid ${S.amber}33` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.amber, marginBottom: 8 }}>Open Position</div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", ...mono, fontSize: 12, color: S.text }}>
              <span>{status.open_position.ticker}</span>
              <span>Qty: {status.open_position.quantity}</span>
              {status.open_position.signal?.score != null && <span>Score: {fmt(status.open_position.signal.score)}</span>}
              <span>Entry P&L: Rs.{fmt(status.open_position.entry_pnl, 0)}</span>
            </div>
          </div>
        )}

        {/* Last Signal */}
        {status.last_signal && !status.open_position && (
          <div style={{ marginTop: 12, background: S.blue + "10", borderRadius: 6, padding: "10px 14px", border: `1px solid ${S.blue}33` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.blue, marginBottom: 8 }}>Last Signal</div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", ...mono, fontSize: 12, color: S.text }}>
              <span style={{ fontWeight: 700, color: status.last_signal.signal === "BUY_CE" ? S.green : S.red }}>
                {status.last_signal.signal}
              </span>
              <span>Score: {fmt(status.last_signal.score)}</span>
              <span>Strategy: {status.last_signal.strategy || "--"}</span>
              <span>Lots: {status.last_signal.lots || 1}</span>
              {status.last_signal.entry_reason && <span>{status.last_signal.entry_reason}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Timestamp */}
      {status.timestamp && (
        <div style={{ textAlign: "center", fontSize: 10, color: S.dim, ...mono }}>
          Last updated: {new Date(status.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
        </div>
      )}
    </div>
  );
}
