import { useState, useMemo } from "react";

/* --- helpers --- */
const fmt = (v, dec = 2) => {
  if (v == null) return "--";
  return v >= 0
    ? `+${v.toFixed(dec)}`
    : v.toFixed(dec);
};
const cur = (c) => (c === "INR" ? "Rs " : "$");
const mono = { fontFamily: "'JetBrains Mono', monospace" };
const durStr = (ms) => {
  if (!ms || ms <= 0) return "--";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};

/* --- Spark line for P&L --- */
const PnlSpark = ({ data, S }) => {
  if (!data || data.length < 2)
    return (
      <div
        style={{
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: S.dim,
          fontSize: 11,
        }}
      >
        Not enough closed trades
      </div>
    );
  const W = 200,
    H = 60;
  const mn = Math.min(...data, 0);
  const mx = Math.max(...data, 0);
  const rng = mx - mn || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - ((v - mn) / rng) * (H - 6) - 3,
  ]);
  const line =
    "M" + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L");
  const area = `${line}L${W},${H}L0,${H}Z`;
  const last = data[data.length - 1];
  const up = last >= 0;
  const c = up ? S.green : S.red;
  const zeroY = H - ((0 - mn) / rng) * (H - 6) - 3;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: H, display: "block" }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.35" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1="0"
        y1={zeroY}
        x2={W}
        y2={zeroY}
        stroke={S.dim}
        strokeWidth="0.5"
        strokeDasharray="3,3"
        strokeOpacity="0.4"
      />
      <path d={area} fill="url(#pnlGrad)" />
      <path
        d={line}
        fill="none"
        stroke={c}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/* ============================================================
   PORTFOLIO TAB
   ============================================================ */
export default function PortfolioTab({
  trades,
  prices,
  wallet,
  setWallet,
  autoTradeStats,
  S,
  ALL,
  toast_,
  cfg,
}) {
  /* --- local UI state --- */
  const [depAmt, setDepAmt] = useState("");
  const [depCur, setDepCur] = useState("USD");
  const [sortCol, setSortCol] = useState("date");
  const [sortDir, setSortDir] = useState(-1); // -1 = desc
  const [filterAsset, setFilterAsset] = useState("ALL");
  const [filterDir, setFilterDir] = useState("ALL");
  const [filterResult, setFilterResult] = useState("ALL");
  const [section, setSection] = useState("wallet"); // wallet | pnl | sets

  /* --- safe wallet --- */
  const w = wallet || { usd: 10000, inr: 500000, history: [] };

  /* --- derived trade lists --- */
  const closedTrades = useMemo(
    () => trades.filter((t) => t.status === "CLOSED" || t.closedAt),
    [trades]
  );
  const openTrades = useMemo(
    () => trades.filter((t) => t.status === "OPEN"),
    [trades]
  );

  /* --- P&L computations --- */
  const pnlPerTrade = useMemo(
    () =>
      closedTrades.map((t) => {
        const exit = t.exitPrice || t.entry;
        const raw =
          (t.dir === "LONG" ? exit - t.entry : t.entry - exit) *
          parseFloat(t.qty || 1);
        return raw - parseFloat(t.fee || 0);
      }),
    [closedTrades]
  );

  const pnlUsdPerTrade = useMemo(
    () =>
      pnlPerTrade.map((raw, i) => {
        const t = closedTrades[i];
        return t.currency === "INR" ? raw / 83.5 : raw;
      }),
    [pnlPerTrade, closedTrades]
  );

  const cumulativePnl = useMemo(() => {
    const arr = [];
    let sum = 0;
    pnlUsdPerTrade.forEach((p) => {
      sum += p;
      arr.push(sum);
    });
    return arr.slice(-50);
  }, [pnlUsdPerTrade]);

  const wins = pnlUsdPerTrade.filter((p) => p > 0);
  const losses = pnlUsdPerTrade.filter((p) => p <= 0);
  const winRate =
    closedTrades.length > 0
      ? ((wins.length / closedTrades.length) * 100).toFixed(1)
      : "0.0";
  const avgWin =
    wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss =
    losses.length > 0
      ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length)
      : 0;
  const bestTrade = pnlUsdPerTrade.length > 0 ? Math.max(...pnlUsdPerTrade) : 0;
  const worstTrade = pnlUsdPerTrade.length > 0 ? Math.min(...pnlUsdPerTrade) : 0;
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor =
    grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? "Inf" : "0.00";
  const totalPnl = pnlUsdPerTrade.reduce((a, b) => a + b, 0);

  /* --- time-based P&L --- */
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  const timePnl = (start) =>
    closedTrades.reduce((s, t, i) => {
      const ts = t.closedAt
        ? new Date(t.closedAt).getTime()
        : t.openedAt
        ? new Date(t.openedAt).getTime()
        : 0;
      if (ts >= start.getTime()) return s + (pnlUsdPerTrade[i] || 0);
      return s;
    }, 0);

  const todayPnl = timePnl(todayStart);
  const weekPnl = timePnl(weekStart);
  const monthPnl = timePnl(monthStart);

  /* --- open positions P&L --- */
  const openPnl = openTrades.reduce((s, t) => {
    const cp = prices?.[t.symbol]?.usd || t.entry;
    let raw = (t.dir === "LONG" ? cp - t.entry : t.entry - cp) * parseFloat(t.qty || 1);
    return s + (t.currency === "INR" ? raw / 83.5 : raw);
  }, 0);

  /* --- allocated balance --- */
  const allocatedUsd = openTrades
    .filter((t) => (t.currency || "USD") === "USD")
    .reduce((s, t) => s + (t.allocatedCapital || parseFloat(cfg?.cryptoCap || 100)), 0);
  const allocatedInr = openTrades
    .filter((t) => t.currency === "INR")
    .reduce((s, t) => s + (t.allocatedCapital || parseFloat(cfg?.fnoCap || 10000)), 0);

  /* --- trade history table (sorted / filtered) --- */
  const filteredTrades = useMemo(() => {
    let list = closedTrades.map((t, i) => ({ ...t, _pnl: pnlPerTrade[i] || 0 }));
    if (filterAsset !== "ALL")
      list = list.filter((t) => t.symbol === filterAsset);
    if (filterDir !== "ALL") list = list.filter((t) => t.dir === filterDir);
    if (filterResult === "WIN") list = list.filter((t) => t._pnl > 0);
    if (filterResult === "LOSS") list = list.filter((t) => t._pnl <= 0);

    list.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case "date":
          va = a.openedAt || "";
          vb = b.openedAt || "";
          break;
        case "asset":
          va = a.symbol;
          vb = b.symbol;
          break;
        case "dir":
          va = a.dir;
          vb = b.dir;
          break;
        case "entry":
          va = a.entry;
          vb = b.entry;
          break;
        case "exit":
          va = a.exitPrice || 0;
          vb = b.exitPrice || 0;
          break;
        case "pnl":
          va = a._pnl;
          vb = b._pnl;
          break;
        case "duration":
          va = a.closedAt && a.openedAt
            ? new Date(a.closedAt) - new Date(a.openedAt)
            : 0;
          vb = b.closedAt && b.openedAt
            ? new Date(b.closedAt) - new Date(b.openedAt)
            : 0;
          break;
        case "indicator":
          va = a.entryIndicator || a.src || "";
          vb = b.entryIndicator || b.src || "";
          break;
        default:
          va = 0;
          vb = 0;
      }
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });
    return list;
  }, [closedTrades, pnlPerTrade, filterAsset, filterDir, filterResult, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => d * -1);
    else {
      setSortCol(col);
      setSortDir(-1);
    }
  };

  /* --- holdings breakdown --- */
  const holdings = useMemo(() => {
    const map = {};
    openTrades.forEach((t) => {
      const cp = prices?.[t.symbol]?.usd || t.entry;
      const val = cp * parseFloat(t.qty || 1);
      if (!map[t.symbol]) map[t.symbol] = { symbol: t.symbol, value: 0, count: 0 };
      map[t.symbol].value += val;
      map[t.symbol].count += 1;
    });
    const arr = Object.values(map).sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, h) => s + h.value, 0);
    return arr.map((h) => ({ ...h, pct: total > 0 ? (h.value / total) * 100 : 0 }));
  }, [openTrades, prices]);

  /* --- deposit / withdraw --- */
  const handleDeposit = () => {
    const amt = parseFloat(depAmt);
    if (!amt || amt <= 0) {
      toast_("Enter a valid amount", "error");
      return;
    }
    const key = depCur === "INR" ? "inr" : "usd";
    const sym = depCur === "INR" ? "Rs " : "$";
    setWallet((prev) => ({
      ...prev,
      [key]: (prev[key] || 0) + amt,
      history: [
        { id: Date.now(), type: "DEPOSIT", amount: amt, currency: depCur, ts: new Date().toLocaleString() },
        ...(prev.history || []),
      ],
    }));
    toast_(`Deposited ${sym}${amt.toFixed(2)}`, "success");
    setDepAmt("");
  };
  const handleWithdraw = () => {
    const amt = parseFloat(depAmt);
    if (!amt || amt <= 0) {
      toast_("Enter a valid amount", "error");
      return;
    }
    const key = depCur === "INR" ? "inr" : "usd";
    const sym = depCur === "INR" ? "Rs " : "$";
    const avail = (w[key] || 0) - (key === "usd" ? allocatedUsd : allocatedInr);
    if (amt > avail) {
      toast_(`Insufficient balance. Available: ${sym}${avail.toFixed(2)}`, "error");
      return;
    }
    setWallet((prev) => ({
      ...prev,
      [key]: (prev[key] || 0) - amt,
      history: [
        { id: Date.now(), type: "WITHDRAW", amount: amt, currency: depCur, ts: new Date().toLocaleString() },
        ...(prev.history || []),
      ],
    }));
    toast_(`Withdrew ${sym}${amt.toFixed(2)}`, "success");
    setDepAmt("");
  };

  /* --- auto-trade sets --- */
  const sets = autoTradeStats?.sets || [];

  /* --- allocation bar colors --- */
  const barColors = [
    "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
    "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
  ];

  /* --- styles --- */
  const card = {
    background: S.card,
    border: `1px solid ${S.border}`,
    borderRadius: 8,
    padding: "14px 16px",
    marginBottom: 12,
  };
  const sectionBtn = (active) => ({
    padding: "7px 18px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    background: active ? S.blue + "22" : "transparent",
    border: `1px solid ${active ? S.blue : S.border}`,
    borderRadius: 6,
    color: active ? S.blue : S.mid,
    fontFamily: "Inter, sans-serif",
    transition: "all 0.15s",
  });
  const statBox = (val) => ({
    background: S.bg,
    borderRadius: 6,
    padding: "10px 14px",
    border: `1px solid ${S.border}`,
    flex: "1 1 120px",
  });
  const thStyle = (col) => ({
    padding: "6px 8px",
    textAlign: "left",
    fontSize: 10,
    color: sortCol === col ? S.bright : S.dim,
    letterSpacing: 0.5,
    fontWeight: 600,
    textTransform: "uppercase",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    borderBottom: `1px solid ${S.border}`,
  });

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* --- Section selector --- */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          ["wallet", "Trading Wallet"],
          ["pnl", "P&L Tracker"],
          ["sets", "Set Performance"],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setSection(k)} style={sectionBtn(section === k)}>
            {label}
          </button>
        ))}
      </div>

      {/* ============================================================
          SECTION 1 : TRADING WALLET
          ============================================================ */}
      {section === "wallet" && (
        <div>
          {/* --- USD & INR wallet cards --- */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {/* USD */}
            <div style={{ ...card, borderLeft: `3px solid ${S.green}` }}>
              <div style={{ fontSize: 10, color: S.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                USD Wallet
              </div>
              <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: S.bright, marginBottom: 8 }}>
                ${(w.usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 10, color: S.dim }}>Available</div>
                  <div style={{ ...mono, fontSize: 13, color: S.text }}>
                    ${Math.max(0, w.usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: S.dim }}>Allocated</div>
                  <div style={{ ...mono, fontSize: 13, color: S.amber }}>
                    ${allocatedUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: S.dim }}>Equity</div>
                  <div style={{ ...mono, fontSize: 13, color: S.green }}>
                    ${((w.usd || 0) + allocatedUsd + (openPnl > 0 ? openPnl : 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* INR */}
            <div style={{ ...card, borderLeft: `3px solid ${S.amber}` }}>
              <div style={{ fontSize: 10, color: S.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                INR Wallet
              </div>
              <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: S.bright, marginBottom: 8 }}>
                Rs {(w.inr || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 10, color: S.dim }}>Available</div>
                  <div style={{ ...mono, fontSize: 13, color: S.text }}>
                    Rs {Math.max(0, w.inr || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: S.dim }}>Allocated</div>
                  <div style={{ ...mono, fontSize: 13, color: S.amber }}>
                    Rs {allocatedInr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: S.dim }}>Equity</div>
                  <div style={{ ...mono, fontSize: 13, color: S.green }}>
                    Rs {((w.inr || 0) + allocatedInr).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* --- Deposit / Withdraw & Reset --- */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.text }}>
                Deposit / Withdraw
              </div>
              <button
                onClick={() => {
                  if(window.confirm("Are you sure you want to reset all trades and wallet history? This cannot be undone.")) {
                    localStorage.removeItem("alpha_trades");
                    localStorage.removeItem("alpha_wallet");
                    localStorage.removeItem("alpha_agent_history");
                    window.location.reload();
                  }
                }}
                style={{
                  padding: "5px 12px",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "#1a050a",
                  border: `1px solid ${S.red}55`,
                  borderRadius: 4,
                  color: S.red,
                  fontFamily: "inherit",
                }}
              >
                Reset Portfolio & Trades
              </button>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 9, color: S.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                  Currency
                </div>
                <select
                  value={depCur}
                  onChange={(e) => setDepCur(e.target.value)}
                  style={{
                    background: S.bg,
                    border: `1px solid ${S.border}`,
                    color: S.text,
                    fontSize: 11,
                    padding: "7px 10px",
                    borderRadius: 6,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                >
                  <option value="USD">USD</option>
                  <option value="INR">INR</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 9, color: S.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                  Amount
                </div>
                <input
                  type="number"
                  placeholder="0.00"
                  value={depAmt}
                  onChange={(e) => setDepAmt(e.target.value)}
                  style={{
                    background: S.bg,
                    border: `1px solid ${S.border}`,
                    color: S.text,
                    fontSize: 11,
                    padding: "7px 10px",
                    borderRadius: 6,
                    width: 140,
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>
              <button
                onClick={handleDeposit}
                style={{
                  padding: "7px 18px",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "#051a0d",
                  border: `1px solid ${S.green}55`,
                  borderRadius: 6,
                  color: S.green,
                  fontFamily: "inherit",
                }}
              >
                Deposit
              </button>
              <button
                onClick={handleWithdraw}
                style={{
                  padding: "7px 18px",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "#1a050a",
                  border: `1px solid ${S.red}55`,
                  borderRadius: 6,
                  color: S.red,
                  fontFamily: "inherit",
                }}
              >
                Withdraw
              </button>
            </div>
          </div>

          {/* --- Wallet history --- */}
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.text, marginBottom: 10 }}>
              Wallet History
            </div>
            {(!w.history || w.history.length === 0) ? (
              <div style={{ fontSize: 11, color: S.dim }}>No transactions yet</div>
            ) : (
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {w.history.slice(0, 50).map((h) => (
                  <div
                    key={h.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "5px 0",
                      borderBottom: `1px solid ${S.border}22`,
                      fontSize: 11,
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 4,
                          color: h.type === "DEPOSIT" || h.type === "CREDIT" ? S.green : S.red,
                          background:
                            h.type === "DEPOSIT" || h.type === "CREDIT" ? S.green + "18" : S.red + "18",
                        }}
                      >
                        {h.type}
                      </span>
                      <span style={{ color: S.mid, fontSize: 10 }}>{h.ts}</span>
                    </div>
                    <span
                      style={{
                        ...mono,
                        fontSize: 12,
                        fontWeight: 600,
                        color: h.type === "DEPOSIT" || h.type === "CREDIT" ? S.green : S.red,
                      }}
                    >
                      {h.type === "DEPOSIT" || h.type === "CREDIT" ? "+" : "-"}
                      {cur(h.currency)}
                      {h.amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          SECTION 2 : P&L TRACKER
          ============================================================ */}
      {section === "pnl" && (
        <div>
          {/* --- Cumulative P&L sparkline --- */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.text }}>
                Cumulative P&L (last 50 trades)
              </div>
              <div style={{ ...mono, fontSize: 16, fontWeight: 700, color: totalPnl >= 0 ? S.green : S.red }}>
                {fmt(totalPnl)}
              </div>
            </div>
            <PnlSpark data={cumulativePnl} S={S} />
          </div>

          {/* --- P&L stat cards --- */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            {[
              ["Today", todayPnl],
              ["This Week", weekPnl],
              ["This Month", monthPnl],
              ["All Time", totalPnl],
            ].map(([label, val]) => (
              <div key={label} style={statBox(val)}>
                <div style={{ fontSize: 10, color: S.dim, marginBottom: 4 }}>{label}</div>
                <div style={{ ...mono, fontSize: 16, fontWeight: 700, color: val >= 0 ? S.green : S.red }}>
                  {fmt(val)}
                </div>
              </div>
            ))}
          </div>

          {/* --- Performance metrics --- */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            {[
              ["Win Rate", `${winRate}%`, parseFloat(winRate) >= 50 ? S.green : S.red],
              ["Avg Win", `$${avgWin.toFixed(2)}`, S.green],
              ["Avg Loss", `$${avgLoss.toFixed(2)}`, S.red],
              ["Best Trade", `$${bestTrade.toFixed(2)}`, S.green],
              ["Worst Trade", `$${worstTrade.toFixed(2)}`, S.red],
              ["Profit Factor", profitFactor, parseFloat(profitFactor) >= 1 ? S.green : S.red],
            ].map(([label, val, color]) => (
              <div key={label} style={statBox()}>
                <div style={{ fontSize: 10, color: S.dim, marginBottom: 4 }}>{label}</div>
                <div style={{ ...mono, fontSize: 14, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* --- Trade History Table --- */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.text }}>
                Trade History ({filteredTrades.length})
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {/* Asset filter */}
                <select
                  value={filterAsset}
                  onChange={(e) => setFilterAsset(e.target.value)}
                  style={{
                    background: S.bg,
                    border: `1px solid ${S.border}`,
                    color: S.text,
                    fontSize: 10,
                    padding: "4px 8px",
                    borderRadius: 4,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                >
                  <option value="ALL">All Assets</option>
                  {ALL.map((a) => (
                    <option key={a.symbol} value={a.symbol}>
                      {a.symbol}
                    </option>
                  ))}
                </select>
                {/* Direction filter */}
                <select
                  value={filterDir}
                  onChange={(e) => setFilterDir(e.target.value)}
                  style={{
                    background: S.bg,
                    border: `1px solid ${S.border}`,
                    color: S.text,
                    fontSize: 10,
                    padding: "4px 8px",
                    borderRadius: 4,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                >
                  <option value="ALL">All Directions</option>
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                </select>
                {/* Result filter */}
                <select
                  value={filterResult}
                  onChange={(e) => setFilterResult(e.target.value)}
                  style={{
                    background: S.bg,
                    border: `1px solid ${S.border}`,
                    color: S.text,
                    fontSize: 10,
                    padding: "4px 8px",
                    borderRadius: 4,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                >
                  <option value="ALL">All Results</option>
                  <option value="WIN">Win</option>
                  <option value="LOSS">Loss</option>
                </select>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", ...mono, fontSize: 11, minWidth: 800 }}>
                <thead>
                  <tr>
                    {[
                      ["date", "Date"],
                      ["asset", "Asset"],
                      ["dir", "Direction"],
                      ["entry", "Entry"],
                      ["exit", "Exit"],
                      ["pnl", "P&L"],
                      ["duration", "Duration"],
                      ["indicator", "Indicator"],
                    ].map(([col, label]) => (
                      <th key={col} onClick={() => toggleSort(col)} style={thStyle(col)}>
                        {label}
                        {sortCol === col ? (sortDir === -1 ? " v" : " ^") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 20, textAlign: "center", color: S.dim, fontSize: 11 }}>
                        No closed trades yet
                      </td>
                    </tr>
                  ) : (
                    filteredTrades.slice(0, 100).map((t) => {
                      const pnl_ = t._pnl;
                      const durMs =
                        t.closedAt && t.openedAt
                          ? new Date(t.closedAt) - new Date(t.openedAt)
                          : 0;
                      return (
                        <tr
                          key={t.id}
                          style={{
                            borderBottom: `1px solid ${S.border}22`,
                          }}
                        >
                          <td style={{ padding: "6px 8px", color: S.mid, fontSize: 10 }}>
                            {t.openedAt || "--"}
                          </td>
                          <td style={{ padding: "6px 8px", fontWeight: 600, color: S.bright }}>
                            {t.symbol}
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 4,
                                color: t.dir === "LONG" ? S.green : S.red,
                                background: t.dir === "LONG" ? S.green + "18" : S.red + "18",
                              }}
                            >
                              {t.dir}
                            </span>
                          </td>
                          <td style={{ padding: "6px 8px", color: S.text }}>
                            {cur(t.currency || "USD")}
                            {t.entry?.toFixed(2)}
                          </td>
                          <td style={{ padding: "6px 8px", color: S.text }}>
                            {t.exitPrice
                              ? `${cur(t.currency || "USD")}${t.exitPrice.toFixed(2)}`
                              : "--"}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              fontWeight: 700,
                              color: pnl_ >= 0 ? S.green : S.red,
                            }}
                          >
                            {fmt(pnl_)}
                          </td>
                          <td style={{ padding: "6px 8px", color: S.mid, fontSize: 10 }}>
                            {durStr(durMs)}
                          </td>
                          <td style={{ padding: "6px 8px", color: S.dim, fontSize: 10 }}>
                            {t.entryIndicator || t.src || "--"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* --- Holdings Breakdown --- */}
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.text, marginBottom: 10 }}>
              Holdings Breakdown
            </div>
            {holdings.length === 0 ? (
              <div style={{ fontSize: 11, color: S.dim }}>No open positions</div>
            ) : (
              <>
                {/* Horizontal stacked bar */}
                <div
                  style={{
                    display: "flex",
                    height: 20,
                    borderRadius: 4,
                    overflow: "hidden",
                    marginBottom: 12,
                    border: `1px solid ${S.border}`,
                  }}
                >
                  {holdings.map((h, i) => (
                    <div
                      key={h.symbol}
                      style={{
                        width: `${h.pct}%`,
                        background: barColors[i % barColors.length],
                        minWidth: h.pct > 0 ? 2 : 0,
                        transition: "width 0.3s",
                      }}
                      title={`${h.symbol}: ${h.pct.toFixed(1)}%`}
                    />
                  ))}
                </div>

                {/* Legend / details */}
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {holdings.map((h, i) => (
                    <div key={h.symbol} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: barColors[i % barColors.length],
                        }}
                      />
                      <span style={{ fontSize: 11, color: S.text, fontWeight: 600 }}>{h.symbol}</span>
                      <span style={{ ...mono, fontSize: 11, color: S.mid }}>
                        {h.pct.toFixed(1)}%
                      </span>
                      <span style={{ ...mono, fontSize: 10, color: S.dim }}>
                        (${h.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {h.count} pos)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          SECTION 3 : SET PERFORMANCE
          ============================================================ */}
      {section === "sets" && (
        <div>
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.text, marginBottom: 12 }}>
              Auto-Trade Set History
            </div>
            {sets.length === 0 ? (
              <div style={{ fontSize: 11, color: S.dim }}>
                No auto-trade sets recorded yet. Sets are created when auto-trade runs in batches of 10.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", ...mono, fontSize: 11, minWidth: 600 }}>
                  <thead>
                    <tr>
                      {["Set #", "Trades", "Wins", "Losses", "Win Rate", "Status"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "6px 10px",
                            textAlign: "left",
                            fontSize: 10,
                            color: S.dim,
                            letterSpacing: 0.5,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            borderBottom: `1px solid ${S.border}`,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sets.map((s, i) => {
                      const tradeCount = s.trades?.length || 0;
                      const winsCount = s.trades
                        ? s.trades.filter((t) => {
                            const exit = t.exitPrice || t.entry;
                            const pnl =
                              (t.dir === "LONG" ? exit - t.entry : t.entry - exit) *
                              parseFloat(t.qty || 1);
                            return pnl > 0;
                          }).length
                        : 0;
                      const lossCount = tradeCount - winsCount;
                      const wr = tradeCount > 0 ? ((winsCount / tradeCount) * 100).toFixed(1) : "0.0";
                      const belowThreshold = parseFloat(wr) < 70;
                      const status = s.status || (i === sets.length - 1 ? "ACTIVE" : "COMPLETED");

                      return (
                        <tr
                          key={s.id || i}
                          style={{
                            borderBottom: `1px solid ${S.border}22`,
                            background: belowThreshold ? S.red + "08" : "transparent",
                          }}
                        >
                          <td style={{ padding: "8px 10px", fontWeight: 700, color: S.bright }}>
                            #{s.id || i + 1}
                          </td>
                          <td style={{ padding: "8px 10px", color: S.text }}>{tradeCount}</td>
                          <td style={{ padding: "8px 10px", color: S.green }}>{winsCount}</td>
                          <td style={{ padding: "8px 10px", color: S.red }}>{lossCount}</td>
                          <td
                            style={{
                              padding: "8px 10px",
                              fontWeight: 700,
                              color: belowThreshold ? S.red : S.green,
                            }}
                          >
                            {wr}%
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 600,
                                padding: "2px 10px",
                                borderRadius: 4,
                                color:
                                  status === "ACTIVE"
                                    ? S.green
                                    : status === "PAUSED"
                                    ? S.amber
                                    : S.mid,
                                background:
                                  status === "ACTIVE"
                                    ? S.green + "18"
                                    : status === "PAUSED"
                                    ? S.amber + "18"
                                    : S.mid + "18",
                              }}
                            >
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Summary stats */}
          {sets.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                [
                  "Total Sets",
                  sets.length,
                  S.blue,
                ],
                [
                  "Active",
                  sets.filter((s) => (s.status || "ACTIVE") === "ACTIVE").length,
                  S.green,
                ],
                [
                  "Completed",
                  sets.filter((s) => s.status === "COMPLETED").length,
                  S.mid,
                ],
                [
                  "Below 70% WR",
                  sets.filter((s) => {
                    const tc = s.trades?.length || 0;
                    if (tc === 0) return false;
                    const wc = s.trades
                      ? s.trades.filter((t) => {
                          const exit = t.exitPrice || t.entry;
                          return (
                            (t.dir === "LONG" ? exit - t.entry : t.entry - exit) *
                              parseFloat(t.qty || 1) >
                            0
                          );
                        }).length
                      : 0;
                    return (wc / tc) * 100 < 70;
                  }).length,
                  S.red,
                ],
              ].map(([label, val, color]) => (
                <div key={label} style={statBox()}>
                  <div style={{ fontSize: 10, color: S.dim, marginBottom: 4 }}>{label}</div>
                  <div style={{ ...mono, fontSize: 20, fontWeight: 700, color }}>{val}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
