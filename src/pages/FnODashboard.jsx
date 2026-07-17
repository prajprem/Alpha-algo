import { useState, useMemo, useCallback, useEffect } from "react";

/* ================================================================
   FnO Dashboard  –  Indian Futures & Options terminal page
   ================================================================ */

// ── helpers ──────────────────────────────────────────────────────
const mono = { fontFamily: "'JetBrains Mono', monospace" };
const rnd = (min, max) => min + Math.random() * (max - min);
const fmt = (n, d = 2) => n == null ? "--" : Number(n).toFixed(d);
const fmtK = n => {
  if (n == null) return "--";
  if (Math.abs(n) >= 10000000) return (n / 10000000).toFixed(2) + " Cr";
  if (Math.abs(n) >= 100000) return (n / 100000).toFixed(2) + " L";
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
};

// ── instrument config ────────────────────────────────────────────
const INSTRUMENTS = {
  NIFTY: { name: "Nifty 50", spot: 24500, step: 50, lotSize: 25, symbol: "NIFTY" },
  BANKNIFTY: { name: "Bank Nifty", spot: 52000, step: 100, lotSize: 15, symbol: "BANKNIFTY" },
  FINNIFTY: { name: "FinNifty", spot: 23800, step: 50, lotSize: 25, symbol: "FINNIFTY" },
};

// ── expiry date generator (next 3 Thursdays from current date) ──
const getExpiries = () => {
  const expiries = [];
  const d = new Date();
  let count = 0;
  while (count < 6) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 4) {
      expiries.push(new Date(d));
      count++;
    }
  }
  return expiries.map((e, i) => ({
    date: e,
    label: e.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    tag: i < 3 ? "Weekly" : "Monthly",
    daysToExpiry: Math.max(1, Math.ceil((e - new Date()) / 86400000)),
  }));
};

// ── Data is now fetched via the proxy server ───────────────────────

// ── Black-Scholes ────────────────────────────────────────────────
const normCDF = x => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
};

const blackScholes = (S, K, T, r, sigma) => {
  if (T <= 0 || sigma <= 0) return { call: 0, put: 0, delta: 0, gamma: 0, theta: 0, vega: 0 };
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const Nd1 = normCDF(d1);
  const Nd2 = normCDF(d2);
  const Nnd1 = normCDF(-d1);
  const Nnd2 = normCDF(-d2);
  const pdf_d1 = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI);
  const disc = Math.exp(-r * T);

  const call = S * Nd1 - K * disc * Nd2;
  const put = K * disc * Nnd2 - S * Nnd1;
  const deltaCall = Nd1;
  const deltaPut = Nd1 - 1;
  const gamma = pdf_d1 / (S * sigma * sqrtT);
  const thetaCall = (-(S * pdf_d1 * sigma) / (2 * sqrtT) - r * K * disc * Nd2) / 365;
  const thetaPut = (-(S * pdf_d1 * sigma) / (2 * sqrtT) + r * K * disc * Nnd2) / 365;
  const vega = S * pdf_d1 * sqrtT / 100;

  return {
    call: parseFloat(call.toFixed(2)),
    put: parseFloat(put.toFixed(2)),
    delta: { call: parseFloat(deltaCall.toFixed(4)), put: parseFloat(deltaPut.toFixed(4)) },
    gamma: parseFloat(gamma.toFixed(6)),
    theta: { call: parseFloat(thetaCall.toFixed(4)), put: parseFloat(thetaPut.toFixed(4)) },
    vega: parseFloat(vega.toFixed(4)),
  };
};

// ── Market status (NSE: Mon-Fri 9:15 – 15:30 IST) ───────────────
const getNSEStatus = () => {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const day = ist.getDay();
  const mins = ist.getHours() * 60 + ist.getMinutes();
  const isWeekday = day >= 1 && day <= 5;
  const inSession = mins >= 555 && mins <= 930; // 9:15 = 555, 15:30 = 930
  return {
    open: isWeekday && inSession,
    label: isWeekday && inSession ? "Market Open" : "Market Closed",
    time: ist.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
};

// ── India VIX demo ───────────────────────────────────────────────
const genVIX = () => parseFloat((rnd(11, 18)).toFixed(2));

// ── component ────────────────────────────────────────────────────
export default function FnODashboard({ prices, S, toast_ }) {
  const [instrument, setInstrument] = useState("NIFTY");
  const [expiryIdx, setExpiryIdx] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Greeks calculator inputs
  const [gkSpot, setGkSpot] = useState("24500");
  const [gkStrike, setGkStrike] = useState("24500");
  const [gkDays, setGkDays] = useState("7");
  const [gkIV, setGkIV] = useState("15");
  const [gkRate, setGkRate] = useState("6.5");
  const [gkType, setGkType] = useState("CE");

  const expiries = useMemo(() => getExpiries(), []);
  const inst = INSTRUMENTS[instrument];
  const vix = useMemo(() => genVIX(), [refreshKey]);

  // ── AI Agent state ────────────────────────────────────────────
  const [agentStatus, setAgentStatus] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      fetch('/api/fno-agent/status')
        .then(r => r.json())
        .then(d => setAgentStatus(d))
        .catch(() => {});
    }, 5000);
    fetch('/api/fno-agent/status')
      .then(r => r.json())
      .then(d => setAgentStatus(d))
      .catch(() => {});
    return () => clearInterval(iv);
  }, []);

  const startAgent = async () => {
    setAgentLoading(true);
    try {
      const r = await fetch('/api/fno-agent/start', { method: 'POST' });
      const d = await r.json();
      if (toast_) toast_(d.status === 'already_running' ? 'Agent already running' : 'Agent started', 'info');
    } catch { if (toast_) toast_('Failed to start agent', 'error'); }
    setAgentLoading(false);
  };

  const stopAgent = async () => {
    setAgentLoading(true);
    try {
      await fetch('/api/fno-agent/stop', { method: 'POST' });
      if (toast_) toast_('Agent stopping', 'info');
    } catch { if (toast_) toast_('Failed to stop agent', 'error'); }
    setAgentLoading(false);
  };

  const [chainData, setChainData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch real-time chain data from local proxy
  useEffect(() => {
    let active = true;
    setLoading(true);
    const days = expiries[expiryIdx]?.daysToExpiry || 7;
    
    fetch(`/api/nse/option-chain/${instrument}?expiryDays=${days}`)
      .then(res => res.json())
      .then(data => {
        if (active && !data.error) {
          setChainData(data);
        } else if (data.error && toast_) {
          toast_(`Proxy Error: ${data.error}`, "error");
        }
        if (active) setLoading(false);
      })
      .catch(err => {
        console.error(err);
        if (toast_) toast_("Failed to connect to proxy server", "error");
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [instrument, expiryIdx, refreshKey]); // eslint-disable-line

  const chain = chainData || { spot: inst.spot, atmStrike: inst.spot, strikes: [] };

  // Key metrics
  const metrics = useMemo(() => {
    const totalCEOI = chain.strikes.reduce((s, r) => s + r.ce.oi, 0);
    const totalPEOI = chain.strikes.reduce((s, r) => s + r.pe.oi, 0);
    const pcr = totalCEOI > 0 ? parseFloat((totalPEOI / totalCEOI).toFixed(2)) : 0;
    // Max pain: strike with min combined buyer loss
    let maxPainStrike = chain.atmStrike;
    let minPain = Infinity;
    chain.strikes.forEach(row => {
      let pain = 0;
      chain.strikes.forEach(r => {
        if (r.strike < row.strike) pain += r.ce.oi * (row.strike - r.strike);
        if (r.strike > row.strike) pain += r.pe.oi * (r.strike - row.strike);
      });
      if (pain < minPain) { minPain = pain; maxPainStrike = row.strike; }
    });
    // Highest OI strikes
    let maxCEOI = 0, maxCEStrike = chain.atmStrike;
    let maxPEOI = 0, maxPEStrike = chain.atmStrike;
    chain.strikes.forEach(r => {
      if (r.ce.oi > maxCEOI) { maxCEOI = r.ce.oi; maxCEStrike = r.strike; }
      if (r.pe.oi > maxPEOI) { maxPEOI = r.pe.oi; maxPEStrike = r.strike; }
    });
    const ivs = chain.strikes.map(r => (r.ce.iv + r.pe.iv) / 2);
    const avgIV = ivs.reduce((a, b) => a + b, 0) / ivs.length;
    const ivPercentile = parseFloat(rnd(25, 75).toFixed(0));
    const ivRank = parseFloat(rnd(20, 65).toFixed(0));
    return { totalCEOI, totalPEOI, pcr, maxPainStrike, maxCEOI, maxCEStrike, maxPEOI, maxPEStrike, avgIV, ivPercentile, ivRank };
  }, [chain]);

  // Greeks calculation
  const greeks = useMemo(() => {
    const sp = parseFloat(gkSpot) || 0;
    const st = parseFloat(gkStrike) || 0;
    const days = parseFloat(gkDays) || 1;
    const iv = (parseFloat(gkIV) || 15) / 100;
    const rate = (parseFloat(gkRate) || 6.5) / 100;
    return blackScholes(sp, st, days / 365, rate, iv);
  }, [gkSpot, gkStrike, gkDays, gkIV, gkRate]);

  const mktStatus = useMemo(() => getNSEStatus(), [refreshKey]); // eslint-disable-line

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    if (toast_) toast_("Fetching live option chain...", "info");
  }, [toast_]);

  // ── styles ─────────────────────────────────────────────────────
  const card = {
    background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: 16,
  };
  const sectionTitle = {
    fontSize: 14, fontWeight: 700, color: S.bright, marginBottom: 12,
  };
  const badge = (bg, fg) => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 4,
    fontSize: 11, fontWeight: 600, background: bg, color: fg, ...mono,
  });
  const btnStyle = (bg, fg) => ({
    padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
    fontSize: 12, fontWeight: 600, background: bg, color: fg, transition: "opacity 0.2s",
  });
  const inputStyle = {
    background: S.bg, border: `1px solid ${S.border}`, borderRadius: 4,
    padding: "6px 10px", fontSize: 13, color: S.bright, ...mono, outline: "none", width: "100%",
    boxSizing: "border-box",
  };
  const selectStyle = {
    ...inputStyle, cursor: "pointer", appearance: "auto",
  };
  const labelStyle = { fontSize: 11, color: S.dim, marginBottom: 2, display: "block" };

  // ── OI bar helper ──────────────────────────────────────────────
  const OIBar = ({ ce, pe, max }) => {
    const ceW = max > 0 ? (ce / max) * 100 : 0;
    const peW = max > 0 ? (pe / max) * 100 : 0;
    return (
      <div style={{ display: "flex", gap: 2, alignItems: "center", height: 14 }}>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: `${ceW}%`, minWidth: ceW > 0 ? 2 : 0, height: 10, background: S.red + "88", borderRadius: "3px 0 0 3px" }} />
        </div>
        <div style={{ width: 1, height: 14, background: S.border }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: `${peW}%`, minWidth: peW > 0 ? 2 : 0, height: 10, background: S.green + "88", borderRadius: "0 3px 3px 0" }} />
        </div>
      </div>
    );
  };

  const maxOI = Math.max(...chain.strikes.map(r => Math.max(r.ce.oi, r.pe.oi)), 1);

  // ── Market overview prices ─────────────────────────────────────
  // Use real prices from Yahoo Finance via backend
  const getPrice = (sym, fallbackInst) => prices?.[sym]?.usd || (fallbackInst === instrument ? chain.spot : INSTRUMENTS[fallbackInst].spot);
  const getChg = (sym, fallbackInst) => prices?.[sym]?.usd_24h_change ?? (fallbackInst === instrument ? (chainData?.change || 0) : 0);

  const mktData = [
    { label: "Nifty 50", price: getPrice("NIF", "NIFTY"), chg: getChg("NIF", "NIFTY") },
    { label: "Bank Nifty", price: getPrice("BNK", "BANKNIFTY"), chg: getChg("BNK", "BANKNIFTY") },
    { label: "FinNifty", price: getPrice("FIN", "FINNIFTY"), chg: getChg("FIN", "FINNIFTY") },
  ];

  // ══════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "'Inter', sans-serif" }}>

      {/* ── 1. MARKET OVERVIEW BAR ────────────────────────────── */}
      <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          {mktData.map(m => (
            <div key={m.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 11, color: S.dim }}>{m.label}</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: S.bright, ...mono }}>
                {fmt(m.price, 0)}
              </span>
              <span style={{ fontSize: 11, color: m.chg >= 0 ? S.green : S.red, ...mono }}>
                {m.chg >= 0 ? "+" : ""}{m.chg}%
              </span>
            </div>
          ))}

          {/* India VIX */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, borderLeft: `1px solid ${S.border}`, paddingLeft: 16 }}>
            <span style={{ fontSize: 11, color: S.dim }}>India VIX</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: vix > 18 ? S.red : vix > 14 ? S.amber : S.green, ...mono }}>
              {vix}
            </span>
            <span style={{ fontSize: 10, color: S.dim }}>
              {vix > 18 ? "High fear" : vix > 14 ? "Moderate" : "Low vol"}
            </span>
          </div>
        </div>

        {/* Market status + Refresh */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: mktStatus.open ? S.green : S.red }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: mktStatus.open ? S.green : S.red }}>
                {mktStatus.label}
              </span>
            </div>
            <span style={{ fontSize: 10, color: S.dim, ...mono }}>IST {mktStatus.time}</span>
          </div>
          <button style={btnStyle(S.blue, "#fff")} onClick={handleRefresh}>Refresh Data</button>
        </div>
      </div>

      {/* ── 2. AI AGENT PANEL ──────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div style={sectionTitle}>AI Trading Agent</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={btnStyle(agentStatus?.mode === 'running' || agentStatus?.mode === 'premarket_done' ? S.dim : S.green, "#fff")}
              onClick={startAgent}
              disabled={agentLoading}
            >
              {agentLoading ? "..." : "Start"}
            </button>
            <button
              style={btnStyle(agentStatus?.mode === 'idle' || agentStatus?.mode === 'done' || !agentStatus ? S.dim : S.red, "#fff")}
              onClick={stopAgent}
              disabled={agentLoading || !agentStatus || agentStatus.mode === 'idle' || agentStatus.mode === 'done'}
            >
              Stop
            </button>
          </div>
        </div>

        {agentStatus ? (
          <>
            {/* Status bar */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: agentStatus.mode === 'running' || agentStatus.mode === 'premarket_done' ? S.green : agentStatus.mode === 'idle' ? S.dim : S.amber }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: S.bright, textTransform: "capitalize" }}>{agentStatus.mode?.replace(/_/g, ' ') || "idle"}</span>
              </div>
              {agentStatus.timestamp && (
                <span style={{ fontSize: 10, color: S.dim, ...mono }}>
                  {new Date(agentStatus.timestamp).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
              <span style={{ fontSize: 11, color: S.dim }}>Underlying: {agentStatus.underlying || "NIFTY"}</span>
              <span style={badge(agentStatus.paper_trade !== false ? S.amber + "22" : S.red + "22", agentStatus.paper_trade !== false ? S.amber : S.red)}>
                {agentStatus.paper_trade !== false ? "PAPER" : "LIVE"}
              </span>
            </div>

            {/* Metrics grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
              {[
                { label: "Regime", value: agentStatus.regime?.iv_regime || "--", color: S.amber },
                { label: "Bias", value: agentStatus.regime?.market_bias || "--", color: S.blue },
                { label: "Strategy", value: agentStatus.strategy || "--", color: S.green },
                { label: "Confidence", value: agentStatus.regime?.confidence != null ? agentStatus.regime.confidence + "%" : "--", color: S.bright },
                { label: "VIX", value: agentStatus.vix || "--", color: agentStatus.vix > 18 ? S.red : agentStatus.vix > 14 ? S.amber : S.green },
                { label: "Spot", value: agentStatus.spot ? "Rs." + Number(agentStatus.spot).toFixed(0) : "--", color: S.bright },
                { label: "P&L", value: agentStatus.daily_pnl != null ? "Rs." + Number(agentStatus.daily_pnl).toFixed(0) : "--", color: agentStatus.daily_pnl > 0 ? S.green : agentStatus.daily_pnl < 0 ? S.red : S.bright },
                { label: "Trades", value: (agentStatus.trades_entered || 0) + " / " + (agentStatus.trades_closed || 0), color: S.text },
              ].map(m => (
                <div key={m.label} style={{ background: S.bg, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: S.dim, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: m.color, ...mono }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Open position */}
            {agentStatus.open_position && (
              <div style={{ marginTop: 10, background: S.amber + "10", borderRadius: 6, padding: "8px 12px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", border: `1px solid ${S.amber}33` }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: S.amber }}>Open Position</span>
                <span style={{ fontSize: 12, color: S.bright, ...mono }}>{agentStatus.open_position.ticker}</span>
                <span style={{ fontSize: 12, color: S.text, ...mono }}>x{agentStatus.open_position.quantity}</span>
                {agentStatus.open_position.signal?.score != null && (
                  <span style={{ fontSize: 11, color: S.blue, ...mono }}>Score: {Number(agentStatus.open_position.signal.score).toFixed(2)}</span>
                )}
              </div>
            )}

            {/* Last signal */}
            {agentStatus.last_signal && !agentStatus.open_position && (
              <div style={{ marginTop: 10, background: S.blue + "10", borderRadius: 6, padding: "6px 12px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", border: `1px solid ${S.blue}33` }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: S.blue }}>Last Signal</span>
                <span style={{ fontSize: 12, color: S.bright, ...mono, fontWeight: 700 }}>{agentStatus.last_signal.signal}</span>
                <span style={{ fontSize: 11, color: S.text, ...mono }}>Score: {Number(agentStatus.last_signal.score).toFixed(2)}</span>
                <span style={{ fontSize: 11, color: S.dim }}>{agentStatus.last_signal.entry_reason}</span>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12, color: S.dim, padding: 12, textAlign: "center" }}>
            Agent not available. Run the Express server on port 5000.
          </div>
        )}
      </div>

      {/* ── 3. OPTION CHAIN VIEWER ────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div style={sectionTitle}>Option Chain</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Instrument selector */}
            <div>
              <label style={labelStyle}>Instrument</label>
              <select
                value={instrument}
                onChange={e => setInstrument(e.target.value)}
                style={{ ...selectStyle, width: 140 }}
              >
                {Object.keys(INSTRUMENTS).map(k => (
                  <option key={k} value={k}>{INSTRUMENTS[k].name}</option>
                ))}
              </select>
            </div>
            {/* Expiry selector */}
            <div>
              <label style={labelStyle}>Expiry</label>
              <select
                value={expiryIdx}
                onChange={e => setExpiryIdx(Number(e.target.value))}
                style={{ ...selectStyle, width: 200 }}
              >
                {expiries.map((ex, i) => (
                  <option key={i} value={i}>{ex.label} ({ex.tag} - {ex.daysToExpiry}d)</option>
                ))}
              </select>
            </div>
            {/* Spot badge */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginLeft: 8 }}>
              <span style={labelStyle}>Spot Price</span>
              <span style={badge(S.blue + "22", S.blue)}>
                {loading ? "..." : fmt(chain.spot, 2)}
              </span>
            </div>
          </div>
        </div>

        {/* Loading overlay for table */}
        <div style={{ position: "relative" }}>
          {loading && (
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(10, 14, 23, 0.7)", zIndex: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: S.bright, fontWeight: 600, backdropFilter: "blur(2px)"
            }}>
              Loading Live Data...
            </div>
          )}

        {/* Option Chain Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, ...mono }}>
            <thead>
              <tr>
                {/* CE headers */}
                <th colSpan={6} style={{ textAlign: "center", padding: "6px 4px", color: S.green, fontSize: 12, fontWeight: 700, borderBottom: `2px solid ${S.border}`, background: S.green + "08" }}>
                  CALLS (CE)
                </th>
                <th style={{ textAlign: "center", padding: "6px 4px", color: S.bright, fontSize: 12, fontWeight: 700, borderBottom: `2px solid ${S.border}` }}>
                  STRIKE
                </th>
                {/* PE headers */}
                <th colSpan={6} style={{ textAlign: "center", padding: "6px 4px", color: S.red, fontSize: 12, fontWeight: 700, borderBottom: `2px solid ${S.border}`, background: S.red + "08" }}>
                  PUTS (PE)
                </th>
              </tr>
              <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                {["OI", "OI Chg", "Volume", "IV%", "LTP", "Chg"].map(h => (
                  <th key={"ce" + h} style={{ padding: "5px 6px", textAlign: "right", fontSize: 10, color: S.dim, fontWeight: 600 }}>{h}</th>
                ))}
                <th style={{ padding: "5px 6px", textAlign: "center", fontSize: 10, color: S.dim, fontWeight: 600 }}>Price</th>
                {["Chg", "LTP", "IV%", "Volume", "OI Chg", "OI"].map(h => (
                  <th key={"pe" + h} style={{ padding: "5px 6px", textAlign: "left", fontSize: 10, color: S.dim, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chain.strikes.map((row, idx) => {
                const ceBg = row.ceITM ? S.green + "08" : "transparent";
                const peBg = row.peITM ? S.red + "08" : "transparent";
                const atmBorder = row.isATM ? `2px solid ${S.amber}` : "none";
                return (
                  <tr
                    key={row.strike}
                    style={{
                      borderBottom: `1px solid ${S.border}22`,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = S.border + "22"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {/* CE side */}
                    <td style={{ padding: "4px 6px", textAlign: "right", color: S.text, background: ceBg }}>{fmtK(row.ce.oi)}</td>
                    <td style={{ padding: "4px 6px", textAlign: "right", color: row.ce.oiChg >= 0 ? S.green : S.red, background: ceBg }}>
                      {row.ce.oiChg >= 0 ? "+" : ""}{fmtK(row.ce.oiChg)}
                    </td>
                    <td style={{ padding: "4px 6px", textAlign: "right", color: S.mid, background: ceBg }}>{fmtK(row.ce.vol)}</td>
                    <td style={{ padding: "4px 6px", textAlign: "right", color: S.amber, background: ceBg }}>{row.ce.iv}</td>
                    <td style={{ padding: "4px 6px", textAlign: "right", color: S.bright, fontWeight: 600, background: ceBg }}>{fmt(row.ce.ltp)}</td>
                    <td style={{ padding: "4px 6px", textAlign: "right", color: row.ce.chg >= 0 ? S.green : S.red, background: ceBg }}>
                      {row.ce.chg >= 0 ? "+" : ""}{fmt(row.ce.chg)}
                    </td>

                    {/* Strike */}
                    <td style={{
                      padding: "4px 8px", textAlign: "center", fontWeight: 700,
                      color: row.isATM ? S.amber : S.bright,
                      borderLeft: atmBorder, borderRight: atmBorder,
                      borderTop: row.isATM ? atmBorder : "none",
                      borderBottom: row.isATM ? atmBorder : "none",
                      background: row.isATM ? S.amber + "15" : "transparent",
                      fontSize: 13,
                    }}>
                      {row.strike}
                      {row.isATM && <span style={{ fontSize: 8, color: S.amber, display: "block", fontWeight: 400 }}>ATM</span>}
                    </td>

                    {/* PE side */}
                    <td style={{ padding: "4px 6px", textAlign: "left", color: row.pe.chg >= 0 ? S.green : S.red, background: peBg }}>
                      {row.pe.chg >= 0 ? "+" : ""}{fmt(row.pe.chg)}
                    </td>
                    <td style={{ padding: "4px 6px", textAlign: "left", color: S.bright, fontWeight: 600, background: peBg }}>{fmt(row.pe.ltp)}</td>
                    <td style={{ padding: "4px 6px", textAlign: "left", color: S.amber, background: peBg }}>{row.pe.iv}</td>
                    <td style={{ padding: "4px 6px", textAlign: "left", color: S.mid, background: peBg }}>{fmtK(row.pe.vol)}</td>
                    <td style={{ padding: "4px 6px", textAlign: "left", color: row.pe.oiChg >= 0 ? S.green : S.red, background: peBg }}>
                      {row.pe.oiChg >= 0 ? "+" : ""}{fmtK(row.pe.oiChg)}
                    </td>
                    <td style={{ padding: "4px 6px", textAlign: "left", color: S.text, background: peBg }}>{fmtK(row.pe.oi)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* ── 4. KEY METRICS PANEL ──────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {/* PCR */}
        <div style={card}>
          <div style={{ fontSize: 11, color: S.dim, marginBottom: 6 }}>Put-Call Ratio (PCR)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: metrics.pcr > 1.2 ? S.green : metrics.pcr < 0.8 ? S.red : S.amber, ...mono }}>
            {metrics.pcr}
          </div>
          <div style={badge(
            metrics.pcr > 1.2 ? S.green + "22" : metrics.pcr < 0.8 ? S.red + "22" : S.amber + "22",
            metrics.pcr > 1.2 ? S.green : metrics.pcr < 0.8 ? S.red : S.amber,
          )}>
            {metrics.pcr > 1.2 ? "Bullish" : metrics.pcr < 0.8 ? "Bearish" : "Neutral"}
          </div>
          <div style={{ fontSize: 10, color: S.dim, marginTop: 4 }}>
            PCR &gt; 1.2 = bullish, &lt; 0.8 = bearish
          </div>
        </div>

        {/* Max Pain */}
        <div style={card}>
          <div style={{ fontSize: 11, color: S.dim, marginBottom: 6 }}>Max Pain</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: S.bright, ...mono }}>
            {metrics.maxPainStrike}
          </div>
          <div style={{ fontSize: 11, color: S.mid, ...mono }}>
            Spot: {fmt(chain.spot, 2)} | Diff: {fmt(chain.spot - metrics.maxPainStrike, 0)}
          </div>
          <div style={{ fontSize: 10, color: S.dim, marginTop: 4 }}>
            Expiry tends toward max pain
          </div>
        </div>

        {/* IV Percentile / IV Rank */}
        <div style={card}>
          <div style={{ fontSize: 11, color: S.dim, marginBottom: 6 }}>Implied Volatility</div>
          <div style={{ display: "flex", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: S.dim }}>IV Percentile</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: S.amber, ...mono }}>{metrics.ivPercentile}%</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: S.dim }}>IV Rank</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: S.blue, ...mono }}>{metrics.ivRank}%</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: S.dim, marginTop: 4 }}>
            Avg ATM IV: {fmt(metrics.avgIV)}%
          </div>
        </div>

        {/* Total CE vs PE OI */}
        <div style={card}>
          <div style={{ fontSize: 11, color: S.dim, marginBottom: 6 }}>Total Open Interest</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 10, color: S.red }}>CE OI</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.red, ...mono }}>{fmtK(metrics.totalCEOI)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: S.green }}>PE OI</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.green, ...mono }}>{fmtK(metrics.totalPEOI)}</div>
            </div>
          </div>
          {/* visual bar comparison */}
          <div style={{ display: "flex", height: 18, borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              flex: metrics.totalCEOI, background: S.red + "55",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, color: S.red, fontWeight: 600,
            }}>
              CE {((metrics.totalCEOI / (metrics.totalCEOI + metrics.totalPEOI)) * 100).toFixed(0)}%
            </div>
            <div style={{
              flex: metrics.totalPEOI, background: S.green + "55",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, color: S.green, fontWeight: 600,
            }}>
              PE {((metrics.totalPEOI / (metrics.totalCEOI + metrics.totalPEOI)) * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. GREEKS CALCULATOR + 6. SUPPORT/RESISTANCE ──────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

        {/* Greeks Calculator */}
        <div style={card}>
          <div style={sectionTitle}>Greeks Calculator (Black-Scholes)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Spot Price</label>
              <input style={inputStyle} type="number" value={gkSpot} onChange={e => setGkSpot(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Strike Price</label>
              <input style={inputStyle} type="number" value={gkStrike} onChange={e => setGkStrike(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Days to Expiry</label>
              <input style={inputStyle} type="number" value={gkDays} onChange={e => setGkDays(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>IV (%)</label>
              <input style={inputStyle} type="number" step="0.5" value={gkIV} onChange={e => setGkIV(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Risk-Free Rate (%)</label>
              <input style={inputStyle} type="number" step="0.1" value={gkRate} onChange={e => setGkRate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Option Type</label>
              <select style={selectStyle} value={gkType} onChange={e => setGkType(e.target.value)}>
                <option value="CE">Call (CE)</option>
                <option value="PE">Put (PE)</option>
              </select>
            </div>
          </div>

          {/* Greeks output */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Premium", value: gkType === "CE" ? greeks.call : greeks.put, color: S.bright, suffix: "" },
              { label: "Delta", value: gkType === "CE" ? greeks.delta?.call : greeks.delta?.put, color: S.blue, suffix: "" },
              { label: "Gamma", value: greeks.gamma, color: S.amber, suffix: "" },
              { label: "Theta", value: gkType === "CE" ? greeks.theta?.call : greeks.theta?.put, color: S.red, suffix: "/day" },
              { label: "Vega", value: greeks.vega, color: S.green, suffix: "/1%" },
            ].map(g => (
              <div key={g.label} style={{ background: S.bg, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: S.dim, marginBottom: 4 }}>{g.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: g.color, ...mono }}>
                  {fmt(g.value, g.label === "Gamma" ? 6 : 4)}
                </div>
                {g.suffix && <div style={{ fontSize: 9, color: S.dim }}>{g.suffix}</div>}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 10, color: S.dim, lineHeight: 1.5 }}>
            Black-Scholes model. European-style pricing. Assumes no dividends. Risk-free rate: RBI repo rate benchmark.
          </div>
        </div>

        {/* Support / Resistance from OI */}
        <div style={card}>
          <div style={sectionTitle}>Support / Resistance from OI</div>

          {/* Visual levels */}
          <div style={{ position: "relative", background: S.bg, borderRadius: 8, padding: "20px 16px", marginBottom: 14 }}>
            {/* Resistance level */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 4, height: 28, borderRadius: 2, background: S.red }} />
                <div>
                  <div style={{ fontSize: 10, color: S.red, fontWeight: 600 }}>RESISTANCE (Highest CE OI)</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: S.red, ...mono }}>{metrics.maxCEStrike}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: S.dim }}>CE OI</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: S.red, ...mono }}>{fmtK(metrics.maxCEOI)}</div>
              </div>
            </div>

            {/* Horizontal level line – Resistance */}
            <div style={{ height: 2, background: S.red + "55", borderRadius: 1, marginBottom: 8, position: "relative" }}>
              <div style={{ position: "absolute", right: 0, top: -6, fontSize: 9, color: S.red, ...mono }}>{metrics.maxCEStrike}</div>
            </div>

            {/* Current price level */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", margin: "12px 0" }}>
              <div style={{
                background: S.amber + "22", border: `1px solid ${S.amber}`, borderRadius: 6,
                padding: "6px 16px", textAlign: "center",
              }}>
                <div style={{ fontSize: 9, color: S.amber }}>SPOT PRICE</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: S.amber, ...mono }}>{fmt(chain.spot, 2)}</div>
              </div>
            </div>

            {/* Horizontal level line – Support */}
            <div style={{ height: 2, background: S.green + "55", borderRadius: 1, marginTop: 8, marginBottom: 8, position: "relative" }}>
              <div style={{ position: "absolute", right: 0, top: -6, fontSize: 9, color: S.green, ...mono }}>{metrics.maxPEStrike}</div>
            </div>

            {/* Support level */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 4, height: 28, borderRadius: 2, background: S.green }} />
                <div>
                  <div style={{ fontSize: 10, color: S.green, fontWeight: 600 }}>SUPPORT (Highest PE OI)</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: S.green, ...mono }}>{metrics.maxPEStrike}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: S.dim }}>PE OI</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: S.green, ...mono }}>{fmtK(metrics.maxPEOI)}</div>
              </div>
            </div>
          </div>

          {/* Range and Max Pain context */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div style={{ background: S.bg, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: S.dim }}>Range</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.bright, ...mono }}>
                {metrics.maxPEStrike} - {metrics.maxCEStrike}
              </div>
            </div>
            <div style={{ background: S.bg, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: S.dim }}>Max Pain</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.amber, ...mono }}>
                {metrics.maxPainStrike}
              </div>
            </div>
            <div style={{ background: S.bg, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: S.dim }}>Spot vs Max Pain</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: chain.spot > metrics.maxPainStrike ? S.green : S.red, ...mono }}>
                {chain.spot > metrics.maxPainStrike ? "+" : ""}{fmt(chain.spot - metrics.maxPainStrike, 0)} pts
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 10, color: S.dim, lineHeight: 1.5 }}>
            Highest CE OI acts as resistance. Highest PE OI acts as support. Writers tend to defend these levels.
          </div>
        </div>
      </div>
    </div>
  );
}
