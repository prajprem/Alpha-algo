import { useState, useMemo } from "react";

/* ─── helpers ─────────────────────────────────────── */
const mono = { fontFamily: "'JetBrains Mono', monospace" };
const fmt = (v, dec = 2) =>
  v == null ? "--" : v > 9999 ? v.toLocaleString(undefined, { maximumFractionDigits: dec }) : v.toFixed(dec);
const dur = (ms) => {
  if (!ms || ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};
const cur = (a) => (a?.currency === "INR" ? "\u20B9" : "$");
const getCur = (sym, ALL) => {
  const a = (ALL || []).find((x) => x.symbol === sym);
  return cur(a);
};
const getAsset = (sym, ALL) => (ALL || []).find((x) => x.symbol === sym);
const getDec = (sym, ALL) => getAsset(sym, ALL)?.dec || 2;

/* ─── Section Header ─────────────────────────────── */
const SectionHead = ({ title, count, color, S }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
      paddingBottom: 6,
      borderBottom: `1px solid ${S.border}`,
    }}
  >
    <div
      style={{
        width: 3,
        height: 16,
        borderRadius: 2,
        background: color || S.blue,
      }}
    />
    <span style={{ fontSize: 14, fontWeight: 700, color: S.bright }}>{title}</span>
    {count != null && (
      <span
        style={{
          fontSize: 10,
          color: S.dim,
          background: S.bg,
          padding: "1px 7px",
          borderRadius: 4,
          ...mono,
        }}
      >
        {count}
      </span>
    )}
  </div>
);

/* ─── TP/SL Progress Bar ─────────────────────────── */
const TPSLBar = ({ entry, tp, sl, current, S }) => {
  const range = tp - sl;
  if (!range || !current) return null;
  const pct = Math.max(0, Math.min(1, (current - sl) / range));
  const entryPct = Math.max(0, Math.min(1, (entry - sl) / range));
  return (
    <div style={{ position: "relative", height: 6, borderRadius: 3, overflow: "hidden", background: S.bg }}>
      {/* SL zone (left=red) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: "100%",
          width: `${entryPct * 100}%`,
          background: `linear-gradient(90deg, ${S.red}44, ${S.red}11)`,
          borderRadius: "3px 0 0 3px",
        }}
      />
      {/* TP zone (right=green) */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          height: "100%",
          width: `${(1 - entryPct) * 100}%`,
          background: `linear-gradient(90deg, ${S.green}11, ${S.green}44)`,
          borderRadius: "0 3px 3px 0",
        }}
      />
      {/* entry marker */}
      <div
        style={{
          position: "absolute",
          left: `${entryPct * 100}%`,
          top: -1,
          width: 1,
          height: 8,
          background: S.dim,
        }}
      />
      {/* current price dot */}
      <div
        style={{
          position: "absolute",
          left: `calc(${pct * 100}% - 4px)`,
          top: -1,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: pct > entryPct ? S.green : S.red,
          border: `1.5px solid ${S.bright}`,
          transition: "left 0.3s ease",
        }}
      />
    </div>
  );
};

/* ─── Quick Trade Panel ──────────────────────────── */
const QuickTradePanel = ({ ALL, prices, placeTrade, S }) => {
  const [qSym, setQSym] = useState(ALL?.[0]?.symbol || "BTC");
  const asset = (ALL || []).find(a => a.symbol === qSym) || ALL?.[0];
  const price = prices?.[qSym]?.usd || asset?.demo || 0;
  const chg = prices?.[qSym]?.usd_24h_change || asset?.demoChg || 0;
  const c = asset?.currency === "INR" ? "\u20B9" : "$";

  return (
    <div style={{
      background: S.card, border: `1px solid ${S.border}`, borderRadius: 8,
      padding: "12px 16px", marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: S.blue }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: S.bright }}>Quick Trade</span>
      </div>

      <select value={qSym} onChange={e => setQSym(e.target.value)} style={{
        background: S.bg, border: `1px solid ${S.border}`, borderRadius: 4,
        padding: "5px 10px", fontSize: 11, fontWeight: 600, color: S.bright, cursor: "pointer", outline: "none",
      }}>
        {(ALL || []).map(a => (
          <option key={a.symbol} value={a.symbol} style={{ background: S.bg, color: S.text }}>{a.symbol}</option>
        ))}
      </select>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: S.bright, ...mono }}>{c}{fmt(price, asset?.dec || 2)}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: chg >= 0 ? S.green : S.red, ...mono }}>
          {chg >= 0 ? "+" : ""}{Number(chg).toFixed(2)}%
        </span>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => placeTrade(qSym, "LONG", "manual")}
          style={{
            padding: "6px 20px", fontSize: 11, fontWeight: 700, borderRadius: 5, cursor: "pointer",
            background: S.green + "15", border: `1px solid ${S.green}55`, color: S.green,
            transition: "all 0.15s",
          }}>LONG</button>
        <button onClick={() => placeTrade(qSym, "SHORT", "manual")}
          style={{
            padding: "6px 20px", fontSize: 11, fontWeight: 700, borderRadius: 5, cursor: "pointer",
            background: S.red + "15", border: `1px solid ${S.red}55`, color: S.red,
            transition: "all 0.15s",
          }}>SHORT</button>
      </div>

      <div style={{ marginLeft: "auto", fontSize: 9, color: S.dim }}>
        TP/SL from settings
      </div>
    </div>
  );
};

/* ─── Active Trade Card ──────────────────────────── */
const TradeCard = ({ t, currentPrice, exitTrade, ALL, S, cfg }) => {
  const asset = getAsset(t.symbol, ALL);
  const dec = getDec(t.symbol, ALL);
  const c = getCur(t.symbol, ALL);
  const cp = currentPrice || t.entry;
  const rawPnl = t.dir === "LONG" ? (cp - t.entry) * (t.qty || 0) : (t.entry - cp) * (t.qty || 0);
  const invCap = (t.currency || "USD") === "INR" ? parseFloat(cfg?.fnoCap || 10000) : parseFloat(cfg?.cryptoCap || 100);
  const invested = t.allocatedCapital || invCap;
  const pnlPct = invested > 0 ? (rawPnl / invested) * 100 : 0;
  const isProfit = rawPnl >= 0;
  const elapsed = Date.now() - (t.id || Date.now());
  const rr =
    t.dir === "LONG"
      ? Math.abs(t.tp - t.entry) / (Math.abs(t.entry - t.sl) || 1)
      : Math.abs(t.entry - t.tp) / (Math.abs(t.sl - t.entry) || 1);

  const srcColors = { manual: S.blue, auto: S.amber, agent: "#a78bfa" };
  const srcLabel = (t.src || "manual").toUpperCase();

  return (
    <div
      style={{
        background: S.card,
        border: `1px solid ${isProfit ? S.green + "33" : S.red + "33"}`,
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        transition: "border-color 0.3s",
      }}
    >
      {/* Row 1: Symbol, direction, source, time */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: asset?.color || S.blue,
              boxShadow: `0 0 5px ${asset?.color || S.blue}`,
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 700, color: asset?.color || S.bright }}>{t.symbol}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 4,
              background: t.dir === "LONG" ? S.green + "18" : S.red + "18",
              color: t.dir === "LONG" ? S.green : S.red,
              border: `1px solid ${t.dir === "LONG" ? S.green + "44" : S.red + "44"}`,
            }}
          >
            {t.dir}
          </span>
          <span
            style={{
              fontSize: 9,
              padding: "2px 6px",
              borderRadius: 4,
              background: (srcColors[t.src] || S.blue) + "18",
              color: srcColors[t.src] || S.blue,
              border: `1px solid ${(srcColors[t.src] || S.blue) + "33"}`,
            }}
          >
            {srcLabel}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: S.dim }}>{dur(elapsed)}</span>
          <span style={{ fontSize: 9, color: S.dim, ...mono }}>R:R {rr.toFixed(1)}</span>
        </div>
      </div>

      {/* Row 2: Prices and P&L */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
          <div>
            <div style={{ fontSize: 9, color: S.dim, marginBottom: 1 }}>ENTRY</div>
            <div style={{ fontSize: 13, color: S.text, ...mono }}>{c}{fmt(t.entry, dec)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: S.dim, marginBottom: 1 }}>INVESTED</div>
            <div style={{ fontSize: 13, color: S.text, ...mono }}>{c}{fmt(invested, dec)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: S.dim, marginBottom: 1 }}>CURRENT</div>
            <div style={{ fontSize: 13, color: isProfit ? S.green : S.red, fontWeight: 600, ...mono }}>
              {c}{fmt(cp, dec)}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, color: S.dim, marginBottom: 1 }}>P&L</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: isProfit ? S.green : S.red,
              ...mono,
              lineHeight: 1,
            }}
          >
            {isProfit ? "+" : ""}{rawPnl.toFixed(2)}
          </div>
          <div style={{ fontSize: 9, color: isProfit ? S.green : S.red, ...mono }}>
            {isProfit ? "+" : ""}{pnlPct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Row 3: TP / SL with progress bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: S.red, ...mono }}>SL {c}{fmt(t.sl, dec)}</span>
          <span style={{ fontSize: 9, color: S.green, ...mono }}>TP {c}{fmt(t.tp, dec)}</span>
        </div>
        <TPSLBar entry={t.entry} tp={t.tp} sl={t.sl} current={cp} S={S} />
      </div>

      {/* Row 4: Indicator, Qty, Exit */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {t.indicator && (
            <span
              style={{
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 4,
                background: S.bg,
                color: S.mid,
                border: `1px solid ${S.border}`,
              }}
            >
              {t.indicator}
            </span>
          )}
          {t.tpConf != null && (
            <span
              style={{
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 4,
                background: t.tpConf >= 0.6 ? S.green + "18" : t.tpConf >= 0.4 ? S.amber + "18" : S.red + "18",
                color: t.tpConf >= 0.6 ? S.green : t.tpConf >= 0.4 ? S.amber : S.red,
                border: `1px solid ${t.tpConf >= 0.6 ? S.green + "44" : t.tpConf >= 0.4 ? S.amber + "44" : S.red + "44"}`,
                fontWeight: 600,
              }}
            >
              TP {(t.tpConf * 100).toFixed(0)}%
            </span>
          )}
          <span style={{ fontSize: 9, color: S.dim }}>Qty: <span style={mono}>{t.qty}</span></span>
          <span style={{ fontSize: 9, color: S.dim }}>Fee: <span style={mono}>{c}{t.fee}</span></span>
        </div>
        <button
          onClick={() => exitTrade(t.id)}
          style={{
            padding: "5px 16px",
            fontSize: 11,
            fontWeight: 700,
            background: S.red + "15",
            border: `1px solid ${S.red}55`,
            borderRadius: 6,
            color: S.red,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.15s",
          }}
        >
          EXIT TRADE
        </button>
      </div>

      {/* Row 5: Web research news */}
      {t.news && t.news.length > 0 && (
        <div style={{ marginTop: 4, padding: "6px 8px", background: S.bg, borderRadius: 6, border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 9, color: S.blue, fontWeight: 600, marginBottom: 4 }}>AI Research</div>
          {t.news.map((item, i) => (
            <div key={i} style={{ fontSize: 10, color: S.dim, marginBottom: i < t.news.length - 1 ? 3 : 0, lineHeight: 1.3 }}>
              <span style={{ color: S.text }}>{item.title}</span>
              <span style={{ marginLeft: 6, color: S.mid, fontSize: 9 }}>{item.publisher}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Closed Trade Row ───────────────────────────── */
const ClosedRow = ({ t, ALL, S }) => {
  const dec = getDec(t.symbol, ALL);
  const c = getCur(t.symbol, ALL);
  const asset = getAsset(t.symbol, ALL);
  const pnl = t.pnl != null ? t.pnl :
    t.dir === "LONG"
      ? ((t.exitPrice || t.entry) - t.entry) * (t.qty || 0)
      : (t.entry - (t.exitPrice || t.entry)) * (t.qty || 0);
  const isWin = pnl >= 0;
  const elapsed = (t.closedAt || 0) - (t.openedAt || t.id || 0);

  const reasonColors = { TP: S.green, SL: S.red, MANUAL: S.amber };
  const reason = t.exitReason || "MANUAL";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "60px 50px 80px 80px 80px 90px 60px 60px",
        gap: 6,
        padding: "6px 0",
        borderBottom: `1px solid ${S.border}`,
        alignItems: "center",
        fontSize: 11,
      }}
    >
      <span style={{ color: asset?.color || S.text, fontWeight: 600 }}>{t.symbol}</span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: t.dir === "LONG" ? S.green : S.red,
        }}
      >
        {t.dir}
      </span>
      <span style={{ color: S.dim, ...mono }}>{c}{fmt(t.entry, dec)}</span>
      <span style={{ color: S.dim, ...mono }}>{c}{fmt(t.entry * (t.qty || 0), dec)}</span>
      <span style={{ color: S.dim, ...mono }}>{c}{fmt(t.exitPrice, dec)}</span>
      <span
        style={{
          fontWeight: 700,
          color: isWin ? S.green : S.red,
          ...mono,
        }}
      >
        {isWin ? "+" : ""}{pnl.toFixed(2)}
      </span>
      <span style={{ color: S.dim, fontSize: 9 }}>{dur(elapsed)}</span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: reasonColors[reason] || S.mid,
        }}
      >
        {reason}
      </span>
    </div>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TRADES TAB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function TradesTab({
  trades,
  prices,
  exitTrade,
  exitAllTrades,
  cfg,
  setCfg,
  autoTradeStats,
  tradeQueue,
  executeQueuedTrade,
  ALL,
  S,
  toast_,
  placeTrade,
}) {
  const [closedPage] = useState(0);

  /* Derived data */
  const openTrades = useMemo(() => (trades || []).filter((t) => t.status === "OPEN"), [trades]);
  const closedTrades = useMemo(
    () =>
      (trades || [])
        .filter((t) => t.status !== "OPEN")
        .sort((a, b) => (b.closedAt || b.id || 0) - (a.closedAt || a.id || 0))
        .slice(0, 20),
    [trades]
  );

  const totalPnlOpen = useMemo(() => {
    return openTrades.reduce((s, t) => {
      const cp = prices?.[t.symbol]?.usd || t.entry;
      return s + (t.dir === "LONG" ? cp - t.entry : t.entry - cp) * (t.qty || 0);
    }, 0);
  }, [openTrades, prices]);

  const todayClosed = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return closedTrades.filter((t) => (t.closedAt || t.id || 0) >= start.getTime());
  }, [closedTrades]);

  const todayWins = todayClosed.filter((t) => {
    const pnl =
      t.dir === "LONG"
        ? ((t.exitPrice || t.entry) - t.entry) * (t.qty || 0)
        : (t.entry - (t.exitPrice || t.entry)) * (t.qty || 0);
    return pnl >= 0;
  }).length;

  const todayLosses = todayClosed.length - todayWins;
  const todayPnl = todayClosed.reduce((s, t) => {
    const pnl =
      t.dir === "LONG"
        ? ((t.exitPrice || t.entry) - t.entry) * (t.qty || 0)
        : (t.entry - (t.exitPrice || t.entry)) * (t.qty || 0);
    return s + pnl;
  }, 0);

  /* Auto-trader derived */
  const currentSet = autoTradeStats?.currentSet || {};
  const setHistory = (autoTradeStats?.sets || []).slice(-5).reverse();
  const setActive = currentSet.active || openTrades.length;
  const setClosed = currentSet.closed || closedTrades.length;
  const setTotal = cfg?.maxTradesPerDay || 10;
  const setFill = setActive + setClosed;
  const setWinRate =
    setClosed > 0
      ? ((currentSet.wins || todayWins) / setClosed * 100).toFixed(0)
      : "--";
  const setTP = currentSet.tp || todayWins;
  const setSL = currentSet.sl || todayLosses;

  const queue = tradeQueue || [];

  const cardStyle = {
    background: S.card,
    border: `1px solid ${S.border}`,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  };

  return (
    <div className="fin" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* ══════ QUICK TRADE PANEL ══════ */}
      {placeTrade && (
        <QuickTradePanel ALL={ALL} prices={prices} placeTrade={placeTrade} S={S} />
      )}

      {/* ══════ SECTION 1: Active Trades ══════ */}
      <div style={cardStyle}>
        <SectionHead title="Active Trades" count={openTrades.length} color={S.green} S={S} />

        {openTrades.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "28px 0",
              color: S.dim,
              fontSize: 12,
            }}
          >
            No open trades. Use Quick Trade above or the Watchlist tab to enter positions.
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 12,
                padding: "6px 10px",
                background: S.bg,
                borderRadius: 6,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 9, color: S.dim }}>
                TOTAL P&L{" "}
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: totalPnlOpen >= 0 ? S.green : S.red,
                    ...mono,
                  }}
                >
                  {totalPnlOpen >= 0 ? "+" : ""}{totalPnlOpen.toFixed(2)}
                </span>
              </span>
              <span style={{ fontSize: 9, color: S.dim }}>
                POSITIONS <span style={{ color: S.bright, fontWeight: 600, ...mono }}>{openTrades.length}</span>
              </span>
              {openTrades.length > 1 && (
                <button
                  onClick={() => {
                    if (exitAllTrades) exitAllTrades();
                    if (toast_) toast_("All trades exited", "warn");
                  }}
                  style={{
                    marginLeft: "auto",
                    padding: "4px 12px",
                    fontSize: 10,
                    fontWeight: 700,
                    background: S.red + "12",
                    border: `1px solid ${S.red}44`,
                    borderRadius: 6,
                    color: S.red,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  EXIT ALL
                </button>
              )}
            </div>

            {/* Trade cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {openTrades.map((t) => (
                <TradeCard
                  key={t.id}
                  t={t}
                  currentPrice={prices?.[t.symbol]?.usd}
                  exitTrade={exitTrade}
                  ALL={ALL}
                  S={S}
                  cfg={cfg}
                />
              ))}
            </div>
          </>
        )}
      </div>



      {/* ══════ SECTION 3: Trade Queue ══════ */}
      <div style={cardStyle}>
        <SectionHead title="Trade Queue" count={queue.length} color="#a78bfa" S={S} />

        {queue.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: S.dim, fontSize: 12 }}>
            No pending signals in queue.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "55px 55px 80px 55px 65px auto",
                gap: 6,
                fontSize: 9,
                color: S.dim,
                padding: "4px 0",
                borderBottom: `1px solid ${S.border}`,
                textTransform: "uppercase",
                letterSpacing: 0.3,
              }}
            >
              <span>Asset</span>
              <span>Dir</span>
              <span>Indicator</span>
              <span>Score</span>
              <span>Detected</span>
              <span></span>
            </div>
            {queue.map((q, i) => {
              const asset = getAsset(q.symbol, ALL);
              return (
                <div
                  key={q.id || i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "55px 55px 80px 55px 65px auto",
                    gap: 6,
                    padding: "6px 0",
                    borderBottom: `1px solid ${S.border}`,
                    alignItems: "center",
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: asset?.color || S.text, fontWeight: 600 }}>{q.symbol}</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: q.dir === "LONG" ? S.green : S.red,
                    }}
                  >
                    {q.dir}
                  </span>
                  <span style={{ fontSize: 9, color: S.mid }}>{q.indicator || "--"}</span>
                  <span style={{ ...mono, fontSize: 10, color: S.text }}>{q.score?.toFixed(1) || "--"}</span>
                  <span style={{ fontSize: 9, color: S.dim }}>
                    {q.detectedAt
                      ? new Date(q.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "--"}
                  </span>
                  <div style={{ textAlign: "right" }}>
                    <button
                      onClick={() => {
                        if (executeQueuedTrade) executeQueuedTrade(q);
                        if (toast_) toast_(`Executed queued ${q.dir} ${q.symbol}`, "success");
                      }}
                      style={{
                        padding: "3px 12px",
                        fontSize: 10,
                        fontWeight: 600,
                        background: S.green + "12",
                        border: `1px solid ${S.green}44`,
                        borderRadius: 5,
                        color: S.green,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Execute
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════ SECTION 4: Closed Trades (Recent) ══════ */}
      <div style={cardStyle}>
        <SectionHead title="Closed Trades" count={closedTrades.length} color={S.mid} S={S} />

        {/* Summary stats */}
        <div
          style={{
            display: "flex",
            gap: 20,
            marginBottom: 12,
            padding: "6px 10px",
            background: S.bg,
            borderRadius: 6,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 9, color: S.dim }}>
            TODAY{" "}
            <span style={{ color: S.green, fontWeight: 600, ...mono }}>{todayWins}W</span>
            {" / "}
            <span style={{ color: S.red, fontWeight: 600, ...mono }}>{todayLosses}L</span>
          </div>
          <div style={{ fontSize: 9, color: S.dim }}>
            P&L TODAY{" "}
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: todayPnl >= 0 ? S.green : S.red,
                ...mono,
              }}
            >
              {todayPnl >= 0 ? "+" : ""}{todayPnl.toFixed(2)}
            </span>
          </div>
          {todayClosed.length > 0 && (
            <div style={{ fontSize: 9, color: S.dim }}>
              Win Rate{" "}
              <span
                style={{
                  fontWeight: 600,
                  color: todayWins / todayClosed.length >= 0.5 ? S.green : S.red,
                  ...mono,
                }}
              >
                {((todayWins / todayClosed.length) * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>

        {closedTrades.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: S.dim, fontSize: 12 }}>
            No closed trades yet.
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "60px 50px 80px 80px 80px 90px 60px 60px",
                gap: 6,
                fontSize: 9,
                color: S.dim,
                padding: "4px 0",
                borderBottom: `1px solid ${S.border}`,
                textTransform: "uppercase",
                letterSpacing: 0.3,
              }}
            >
              <span>Asset</span>
              <span>Dir</span>
              <span>Entry</span>
              <span>Invested</span>
              <span>Exit</span>
              <span>P&L</span>
              <span>Dur</span>
              <span>Reason</span>
            </div>
            {closedTrades.map((t) => (
              <ClosedRow key={t.id} t={t} ALL={ALL} S={S} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
