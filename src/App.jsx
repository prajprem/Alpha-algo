import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  S, DEFAULT_CRYPTO, DEFAULT_TRAD, DEFAULT_CFG, TABS, getCurrency, isOpen, isClosingSoon, mkBracket, PRESET_COLORS, DEFAULT_USER,
} from "./constants";
import {
  runAllIndicators, gannSignal, pickBestIndicator, pickBestExitIndicator, getRegimeAwareSignal, getRegimeAwareExitSignal, gannLevels, INDICATOR_NAMES, getAllSignals,
  calcRSI, ema, calcMACD, calcBB, calcStoch, calcADX, calcAlphaTrend,
  calcBOP, calcHalfTrend, calcIchimoku, calcMARibbon, calcRSIMulti,
  calcRSIDivergence, calcSSL, calcTDFI, calcVolume, calcFractals,
  calcZigZag, calcScalp, calcPhysicalLevels, calcVolumeProfile, calcSMC, calcTPConfidence,
} from "./indicators";
import logoImg from "./assets/alpha-algo-logo.png";
import TradesTab from "./pages/TradesTab";
import PortfolioTab from "./pages/PortfolioTab";
import FnODashboard from "./pages/FnODashboard";
import ConnectionsTab from "./pages/ConnectionsTab";
import ChartsPage from "./pages/ChartsPage";
import AnalysisTab from "./pages/AnalysisTab";
import TradeVerdictTab from "./pages/TradeVerdictTab";
import FnoVerdictTab from "./pages/FnoVerdictTab";
import FourteenKTab from "./pages/FourteenKTab";
import { ErrorBoundary } from "./ErrorBoundary";

/* ================================================================
   HELPER UTILITIES
   ================================================================ */
const mono = { fontFamily: "'JetBrains Mono', monospace" };
const fmt = (v, d = 2) => (v == null ? "--" : v > 9999 ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : Number(v).toFixed(d));
const pct = (v) => (v == null ? "--" : (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%");
const ts = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const uid = () => Date.now() + Math.random().toString(36).slice(2, 8);
const isCryptoAsset = (asset) => !!asset?.cgId || asset?.type === "crypto";
const isFnoAsset = (asset) => !!asset && !isCryptoAsset(asset);
const getAssetClass = (asset) => isCryptoAsset(asset) ? "crypto" : "fno";
const isAutoSource = (src) => ["auto", "agent", "crypto-auto", "fno-auto", "crypto-agent", "fno-agent"].includes(src);
const buildEntryAnalysis = (asset, signal, ind, gann, price, sentiments) => {
  const allSignals = (ind && price) ? getAllSignals(ind, gann, price, sentiments, asset?.symbol) : [];
  const conditions = allSignals.map(s => ({
    name: s.name, signal: s.dir, strength: s.strength, score: s.score,
  }));
  const bullishCount = conditions.filter(c =>
    ["BULLISH","BULL","BUY","LONG"].some(k => (c.signal||"").toUpperCase().includes(k))
  ).length;
  const bearishCount = conditions.filter(c =>
    ["BEARISH","BEAR","SELL","SHORT"].some(k => (c.signal||"").toUpperCase().includes(k))
  ).length;
  const confluenceCount = signal.dir === "LONG" ? bullishCount : bearishCount;
  const sentAvg = sentiments?.length
    ? sentiments.reduce((a, b) => a + b.score, 0) / sentiments.length : 0;
  return {
    indicator: signal.name,
    signal: { name: signal.name, dir: signal.dir, strength: signal.strength, score: signal.score },
    conditions,
    confluenceCount,
    totalIndicatorsChecked: conditions.length,
    bullishCount,
    bearishCount,
    sentimentAvg: parseFloat(sentAvg.toFixed(2)),
    executor: getAssetClass(asset),
    timestamp: new Date().toISOString(),
  };
};

/* ================================================================
   TOAST COMPONENT
   ================================================================ */
function Toast({ toasts }) {
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 6 }}>
      {toasts.map((t) => (
        <div key={t.id} className="slide-in" style={{
          padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 500,
          background: t.type === "error" ? S.redDim : t.type === "warn" ? S.amberDim : t.type === "success" ? S.greenDim : S.card,
          color: t.type === "error" ? S.red : t.type === "warn" ? S.amber : t.type === "success" ? S.green : S.text,
          border: `1px solid ${t.type === "error" ? S.red + "44" : t.type === "warn" ? S.amber + "44" : t.type === "success" ? S.green + "44" : S.border}`,
          maxWidth: 340, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   HEADER BAR
   ================================================================ */
function Header({ tab, setTab, prices, ALL, currentUser, users, setCurrentUser, setShowUserMgmt, showUserMgmt }) {
  const totalAssets = ALL.length;
  const liveCount = ALL.filter(a => prices[a.symbol] && isOpen(a)).length;
  return (
    <div style={{
      background: S.card, borderBottom: `1px solid ${S.border}`,
      padding: "0 20px", display: "flex", alignItems: "center", height: 48,
      position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 24 }}>
        <img src={logoImg} alt="Alpha Algo" style={{
          width: 28, height: 28, borderRadius: 6, objectFit: "cover",
        }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: S.bright, letterSpacing: -0.3 }}>Alpha Algo</span>
        <span style={{ fontSize: 9, color: S.dim, marginLeft: -4 }}>v3.0</span>
      </div>
      <div style={{ display: "flex", gap: 2, flex: 1, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "6px 12px", fontSize: 11, fontWeight: tab === t.id ? 600 : 400,
            background: tab === t.id ? S.blue + "18" : "transparent",
            border: "none", borderRadius: 6, color: tab === t.id ? S.blue : S.dim,
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", whiteSpace: "nowrap",
          }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 10, color: S.dim, marginLeft: 8 }}>
        <span>{liveCount}/{totalAssets} live</span>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: liveCount > 0 ? S.green : S.red }} />
        {/* User avatar */}
        <button onClick={() => setShowUserMgmt(!showUserMgmt)} style={{
          width: 26, height: 26, borderRadius: "50%", border: `2px solid ${currentUser.color}`,
          background: currentUser.color + "22", color: currentUser.color,
          fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center", position: "relative",
        }}>
          {currentUser.avatar}
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   MARKET TAB
   ================================================================ */
function MarketTab({ ALL, prices, hist, indicators, gannData, watchlist, setWatchlist, sel, setSel, trades, cfg, placeTrade, S: s, toast_ }) {
  const [newWatch, setNewWatch] = useState("");
  const openTrades = (trades || []).filter((t) => t.status === "OPEN");

  const addToWatch = () => {
    const sym = newWatch.trim().toUpperCase();
    if (!sym) return;
    if (watchlist.includes(sym)) { toast_("Already in watchlist", "warn"); return; }
    const asset = ALL.find((a) => a.symbol === sym);
    if (!asset) { toast_("Asset not found", "error"); return; }
    setWatchlist((p) => [...p, sym]);
    setNewWatch("");
    toast_(`${sym} added to watchlist`, "success");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Watchlist Section */}
      <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 3, height: 16, borderRadius: 2, background: s.amber }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: s.bright }}>Watchlist</span>
            <span style={{ fontSize: 10, color: s.dim, background: s.bg, padding: "1px 7px", borderRadius: 4, ...mono }}>
              {watchlist.length}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input value={newWatch} onChange={(e) => setNewWatch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addToWatch()}
              placeholder="Add symbol..." style={{
                background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4,
                padding: "4px 10px", fontSize: 11, color: s.text, width: 120, outline: "none",
              }} />
            <button onClick={addToWatch} style={{
              padding: "4px 12px", fontSize: 10, fontWeight: 600, background: s.amber + "18",
              border: `1px solid ${s.amber}44`, borderRadius: 4, color: s.amber, cursor: "pointer",
            }}>Add</button>
          </div>
        </div>
        {watchlist.length === 0 ? (
          <div style={{ textAlign: "center", padding: "16px 0", color: s.dim, fontSize: 12 }}>
            Add assets to your watchlist to monitor them here
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {watchlist.map((sym) => {
              const asset = ALL.find((a) => a.symbol === sym);
              const marketOpen = asset ? isOpen(asset) : true;
              const p = prices[sym];
              const price = marketOpen ? (p?.usd || null) : null;
              const chg = marketOpen ? (p?.usd_24h_change ?? null) : null;
              return (
                <div key={sym} onClick={() => setSel(sym)} style={{
                  background: sel === sym ? s.blue + "12" : s.bg, border: `1px solid ${sel === sym ? s.blue + "44" : s.border}`,
                  borderRadius: 6, padding: "8px 12px", cursor: "pointer", transition: "all 0.15s",
                  opacity: marketOpen ? 1 : 0.55,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: marketOpen ? (asset?.color || s.blue) : s.dim }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: asset?.color || s.text }}>{sym}</span>
                      {!marketOpen && <span style={{ fontSize: 8, color: s.amber, background: s.amberDim, padding: "1px 4px", borderRadius: 3 }}>CLOSED</span>}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setWatchlist((p) => p.filter((w) => w !== sym)); toast_(`${sym} removed`, "warn"); }}
                      style={{ background: "none", border: "none", color: s.dim, fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1 }}>x</button>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: marketOpen ? s.bright : s.dim, ...mono }}>
                      {price != null ? `${getCurrency(asset || {})}${fmt(price, asset?.dec || 2)}` : "--"}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: chg == null ? s.dim : chg >= 0 ? s.green : s.red, ...mono }}>
                      {chg != null ? pct(chg) : "--"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Asset Grid */}
      <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 3, height: 16, borderRadius: 2, background: s.blue }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: s.bright }}>All Assets</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {ALL.map((asset) => {
            const marketOpen = isOpen(asset);
            const p = prices[asset.symbol];
            const price = marketOpen ? (p?.usd ?? null) : null;
            const chg = marketOpen ? (p?.usd_24h_change ?? null) : null;
            const isSel = sel === asset.symbol;
            const ind = indicators[asset.symbol];
            const gann = gannData[asset.symbol];
            const bestSig = (ind && price) ? pickBestIndicator(ind, gann, price, null, asset.symbol) : null;
            const hasOpen = openTrades.some((t) => t.symbol === asset.symbol);
            const cur = getCurrency(asset);

            return (
              <div key={asset.symbol} onClick={() => setSel(asset.symbol)} style={{
                background: isSel ? s.blue + "0a" : s.bg, border: `1px solid ${isSel ? s.blue + "44" : s.border}`,
                borderRadius: 8, padding: "12px 14px", cursor: "pointer", transition: "all 0.15s",
                position: "relative", opacity: marketOpen ? 1 : 0.5,
              }}>
                {hasOpen && <div style={{ position: "absolute", top: 8, right: 8, width: 6, height: 6, borderRadius: "50%", background: s.amber }} />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: marketOpen ? asset.color : s.dim, boxShadow: marketOpen ? `0 0 8px ${asset.color}66` : "none" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: marketOpen ? asset.color : s.dim }}>{asset.symbol}</span>
                    <span style={{ fontSize: 10, color: s.dim }}>{asset.name}</span>
                  </div>
                  {!marketOpen && <span style={{ fontSize: 8, color: s.amber, background: s.amberDim, padding: "1px 5px", borderRadius: 3 }}>CLOSED</span>}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: marketOpen ? s.bright : s.dim, ...mono }}>
                    {price != null ? `${cur}${fmt(price, asset.dec)}` : "--"}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: chg == null ? s.dim : chg >= 0 ? s.green : s.red, ...mono }}>
                    {chg != null ? pct(chg) : "--"}
                  </span>
                </div>
                {bestSig && (
                  <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                      background: bestSig.dir === "LONG" ? s.green + "18" : s.red + "18",
                      color: bestSig.dir === "LONG" ? s.green : s.red,
                      border: `1px solid ${bestSig.dir === "LONG" ? s.green + "44" : s.red + "44"}`,
                    }}>{bestSig.dir}</span>
                    <span style={{ fontSize: 9, color: s.mid }}>{bestSig.name}</span>
                    <span style={{ fontSize: 9, color: s.dim, ...mono }}>str:{bestSig.strength?.toFixed(0)}</span>
                  </div>
                )}
                <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                  <button onClick={(e) => { e.stopPropagation(); placeTrade(asset.symbol, "LONG", "manual"); }}
                    style={{ flex: 1, padding: "5px 0", fontSize: 10, fontWeight: 700, background: s.green + "12", border: `1px solid ${s.green}33`, borderRadius: 5, color: s.green, cursor: "pointer", transition: "all 0.15s" }}>
                    LONG
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); placeTrade(asset.symbol, "SHORT", "manual"); }}
                    style={{ flex: 1, padding: "5px 0", fontSize: 10, fontWeight: 700, background: s.red + "12", border: `1px solid ${s.red}33`, borderRadius: 5, color: s.red, cursor: "pointer", transition: "all 0.15s" }}>
                    SHORT
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   SIGNALS TAB
   ================================================================ */
function SignalsTab({ ALL, prices, indicators, gannData, S: s }) {
  const coreIndicators = ["ADX", "Bollinger", "MACD", "EMA Cross", "RSI", "Volume", "Fractals", "StochRSI"];

  const signals = useMemo(() => {
    return ALL.map((asset) => {
      const price = prices[asset.symbol]?.usd || asset.demo || 0;
      const ind = indicators[asset.symbol];
      const gann = gannData[asset.symbol];
      let best = ind ? getRegimeAwareSignal(ind, gann, price, null, asset.symbol) : null;
      if (!best) {
        best = { name: "Majority", dir: "NEUTRAL", score: 0, strength: 0, votes: { long: 0, short: 0, total: Object.keys(ind || {}).length || 26 } };
      }
      return { asset, price, best, ind, gann };
    }).sort((a, b) => (b.best.score * b.best.strength) - (a.best.score * a.best.strength));
  }, [ALL, prices, indicators, gannData]);

  const longCount = signals.filter(s => s.best.dir === "LONG").length;
  const shortCount = signals.filter(s => s.best.dir === "SHORT").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header with signal count */}
      <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 16, borderRadius: 2, background: s.purple }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: s.bright }}>Live Signals</span>
          <span style={{ fontSize: 10, color: s.dim, ...mono }}>{signals.length} active</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 12, fontSize: 10 }}>
          <span style={{ color: s.green, fontWeight: 600 }}>LONG: {longCount}</span>
          <span style={{ color: s.dim, fontWeight: 600 }}>NEUTRAL: {signals.length - longCount - shortCount}</span>
          <span style={{ color: s.red, fontWeight: 600 }}>SHORT: {shortCount}</span>
        </div>
        <div style={{ fontSize: 9, color: s.dim }}>26 indicators active</div>
      </div>

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "90px 100px 80px 70px 90px 1fr", gap: 8, padding: "4px 12px", fontSize: 9, color: s.dim, fontWeight: 600 }}>
        <span>Asset</span><span>Price</span><span>Direction</span><span>Source</span><span>Indicator</span><span>Strength</span>
      </div>

      {signals.length === 0 ? (
        <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 8, textAlign: "center", padding: "32px 0", color: s.dim, fontSize: 12 }}>No signals detected. Waiting for indicator convergence across 26 indicators...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {signals.map(({ asset, price, best }) => {
            const isCore = best.name === "Majority" || coreIndicators.includes(best.name);
            return (
              <div key={asset.symbol} style={{
                display: "grid", gridTemplateColumns: "90px 100px 80px 70px 90px 1fr",
                gap: 8, alignItems: "center", padding: "8px 12px", background: s.card, borderRadius: 6,
                border: `1px solid ${s.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: asset.color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: asset.color }}>{asset.symbol}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: s.bright, ...mono }}>{getCurrency(asset)}{fmt(price, asset.dec)}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, textAlign: "center", padding: "2px 0", borderRadius: 4,
                  background: best.dir === "LONG" ? s.green + "18" : best.dir === "SHORT" ? s.red + "18" : s.dim + "18",
                  color: best.dir === "LONG" ? s.green : best.dir === "SHORT" ? s.red : s.mid,
                }}>{best.dir}</span>
                <span style={{
                  fontSize: 8, fontWeight: 600, textAlign: "center", padding: "2px 4px", borderRadius: 3,
                  background: isCore ? s.blue + "15" : s.purple + "15",
                  color: isCore ? s.blue : s.purple,
                }}>{best.name === "Majority" ? "AGGR" : isCore ? "CORE" : "COMM"}</span>
                <span style={{ fontSize: 10, color: s.mid, fontWeight: 500 }}>
                  {best.name === "Majority" ? `Confluence (${best.votes?.long}L/${best.votes?.short}S)` : best.name}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: s.bg, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, best.strength)}%`, borderRadius: 2, background: best.dir === "LONG" ? s.green : best.dir === "SHORT" ? s.red : s.mid, transition: "width 0.3s" }} />
                  </div>
                  <span style={{ fontSize: 9, color: s.dim, ...mono, minWidth: 28 }}>{best.strength?.toFixed(0)}%</span>
                  <span style={{ fontSize: 8, color: s.dim, ...mono }}>{best.votes?.total} ind</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   CHARTS TAB (SVG sparklines)
   ================================================================ */
function ChartsTab({ ALL, prices, hist, sel, setSel, S: s }) {
  const renderSpark = (arr, w = 260, h = 60) => {
    if (!arr || arr.length < 2) return null;
    const mn = Math.min(...arr), mx = Math.max(...arr), rng = mx - mn || 1;
    const pts = arr.map((v, i) => `${(i / (arr.length - 1)) * w},${h - ((v - mn) / rng) * (h - 4) - 2}`).join(" ");
    const isUp = arr[arr.length - 1] >= arr[0];
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <linearGradient id={`sg-${isUp ? "g" : "r"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isUp ? s.green : s.red} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isUp ? s.green : s.red} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#sg-${isUp ? "g" : "r"})`} />
        <polyline points={pts} fill="none" stroke={isUp ? s.green : s.red} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 8, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 3, height: 16, borderRadius: 2, background: s.green }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: s.bright }}>Price Charts</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {ALL.map((asset) => {
          const h = hist[asset.symbol] || [];
          const p = prices[asset.symbol];
          const price = p?.usd || asset.demo || 0;
          const chg = p?.usd_24h_change || asset.demoChg || 0;
          return (
            <div key={asset.symbol} onClick={() => setSel(asset.symbol)} style={{
              background: s.bg, border: `1px solid ${sel === asset.symbol ? s.blue + "44" : s.border}`,
              borderRadius: 8, padding: "12px 14px", cursor: "pointer", transition: "all 0.15s",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: asset.color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: asset.color }}>{asset.symbol}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.bright, ...mono }}>{getCurrency(asset)}{fmt(price, asset.dec)}</div>
                  <div style={{ fontSize: 10, color: chg >= 0 ? s.green : s.red, ...mono }}>{pct(chg)}</div>
                </div>
              </div>
              {renderSpark(h)}
              {h.length < 2 && <div style={{ textAlign: "center", padding: "16px 0", color: s.dim, fontSize: 10 }}>Collecting data...</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
   INDICATORS TAB
   ================================================================ */
function IndicatorsTab({ ALL, prices, indicators, gannData, sel, setSel, S: s }) {
  const asset = ALL.find((a) => a.symbol === sel) || ALL[0];
  const ind = indicators[asset?.symbol] || {};
  const gann = gannData[asset?.symbol];
  const price = prices[asset?.symbol]?.usd || asset?.demo || 0;

  const renderRow = (label, value, signal, color) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${s.border}` }}>
      <span style={{ fontSize: 11, color: s.mid }}>{label}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: s.text, ...mono }}>{value}</span>
        {signal && <span style={{
          fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 3,
          background: (color || s.dim) + "18", color: color || s.dim,
        }}>{signal}</span>}
      </div>
    </div>
  );

  const SectionCard = ({ title, children, accent }) => (
    <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 8, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: accent || s.blue }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: s.bright }}>{title}</span>
      </div>
      {children}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Asset selector */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {ALL.map((a) => (
          <button key={a.symbol} onClick={() => setSel(a.symbol)} style={{
            padding: "4px 12px", fontSize: 11, fontWeight: sel === a.symbol ? 600 : 400,
            background: sel === a.symbol ? a.color + "18" : s.bg, border: `1px solid ${sel === a.symbol ? a.color + "44" : s.border}`,
            borderRadius: 4, color: sel === a.symbol ? a.color : s.dim, cursor: "pointer",
          }}>{a.symbol}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>

        {/* 1. Core Indicators (1-8) */}
        <SectionCard title="Core Indicators" accent={s.blue}>
          {renderRow("1. ADX (14)", ind.adx ? ind.adx.adx.toFixed(1) : "--", ind.adx?.trend || "--", ind.adx?.trend === "STRONG" ? s.green : s.dim)}
          {renderRow("  +DI / -DI", ind.adx ? `${ind.adx.pdi.toFixed(1)} / ${ind.adx.ndi.toFixed(1)}` : "--", ind.adx?.bull ? "BULL" : "BEAR", ind.adx?.bull ? s.green : s.red)}
          {renderRow("2. Bollinger Bands", ind.bb ? `${fmt(ind.bb.lower, 2)} - ${fmt(ind.bb.upper, 2)}` : "--", ind.bb ? `BW ${ind.bb.bw.toFixed(2)}%` : null, null)}
          {renderRow("3. MACD", ind.macd ? ind.macd.macd.toFixed(4) : "--", ind.macd?.hist > 0 ? "BULLISH" : "BEARISH", ind.macd?.hist > 0 ? s.green : s.red)}
          {renderRow("4. EMA 12/26", ind.ema12 && ind.ema26 ? `${fmt(ind.ema12, 2)} / ${fmt(ind.ema26, 2)}` : "--", ind.ema12 > ind.ema26 ? "GOLDEN" : "DEATH", ind.ema12 > ind.ema26 ? s.green : s.red)}
          {renderRow("5. MA Ribbon", ind.maRibbon?.trend || "--", ind.maRibbon?.expanding ? "EXPANDING" : "CONTRACTING", ind.maRibbon?.trend?.includes("BULL") ? s.green : s.red)}
          {renderRow("6. RSI (14)", ind.rsi != null ? ind.rsi.toFixed(1) : "--", ind.rsi > 70 ? "OVERBOUGHT" : ind.rsi < 30 ? "OVERSOLD" : "NEUTRAL", ind.rsi > 70 ? s.red : ind.rsi < 30 ? s.green : s.dim)}
          {renderRow("7. Volume", ind.volume?.vol ? fmt(ind.volume.vol, 0) : "--", ind.volume?.trend || "LOW", ind.volume?.trend === "BULL VOL" ? s.green : ind.volume?.trend === "BEAR VOL" ? s.red : s.dim)}
          {renderRow("8. Fractals", ind.fractals ? `U:${ind.fractals.upFractal ? fmt(ind.fractals.upFractal, 2) : "--"} D:${ind.fractals.dnFractal ? fmt(ind.fractals.dnFractal, 2) : "--"}` : "--", ind.fractals?.signal || "--", ind.fractals?.signal?.includes("UP") ? s.green : ind.fractals?.signal?.includes("DN") ? s.red : s.dim)}
        </SectionCard>

        {/* 2. Community Trend Indicators */}
        <SectionCard title="Community - Trend" accent={s.purple}>
          {renderRow("9. AlphaTrend", ind.alphaTrend?.signal || "--", ind.alphaTrend?.trend, ind.alphaTrend?.trend === "BULL" ? s.green : s.red)}
          {renderRow("10. HalfTrend", ind.halfTrend?.signal || "--", ind.halfTrend?.trend, ind.halfTrend?.trend === "UP" ? s.green : ind.halfTrend?.trend === "DOWN" ? s.red : s.dim)}
          {renderRow("11. SSL Hybrid", ind.ssl?.signal || "--", ind.ssl?.trend, ind.ssl?.trend === "BULL" ? s.green : s.red)}
          {renderRow("12. Chimera", ind.chimera?.signal || "--", ind.chimera?.trend, ind.chimera?.trend === "BULL" ? s.green : ind.chimera?.trend === "BEAR" ? s.red : s.dim)}
          {ind.chimera && renderRow("  Score", ind.chimera.score.toFixed(2), `Norm: ${ind.chimera.normalized.toFixed(3)}`, null)}
          {renderRow("23. TrendAVGZone", ind.trendAVGZone?.zone || "--", ind.trendAVGZone?.signal, ind.trendAVGZone?.signal === "BUY" ? s.green : ind.trendAVGZone?.signal === "SELL" ? s.red : s.dim)}
          {ind.trendAVGZone && renderRow("  EMAs", `${fmt(ind.trendAVGZone.e10, 2)} / ${fmt(ind.trendAVGZone.e20, 2)} / ${fmt(ind.trendAVGZone.e50, 2)}`, ind.trendAVGZone.expanding ? "EXPANDING" : "FLAT", null)}
        </SectionCard>

        {/* 3. Community Momentum Indicators */}
        <SectionCard title="Community - Momentum" accent={s.amber}>
          {renderRow("13. TDFI", ind.tdfi ? ind.tdfi.value.toFixed(4) : "--", ind.tdfi?.signal, ind.tdfi?.signal === "BUY" ? s.green : ind.tdfi?.signal === "SELL" ? s.red : s.dim)}
          {renderRow("14. RSI HistoAlert", ind.rsiHistoAlert ? ind.rsiHistoAlert.histogram.toFixed(1) : "--", ind.rsiHistoAlert?.zone || "--", ind.rsiHistoAlert?.signal === "BUY" ? s.green : ind.rsiHistoAlert?.signal === "SELL" ? s.red : s.dim)}
          {ind.rsiHistoAlert && renderRow("  Momentum", ind.rsiHistoAlert.momentum.toFixed(2), `R7:${ind.rsiHistoAlert.r7} R21:${ind.rsiHistoAlert.r21}`, null)}
          {renderRow("15. Scalp 5min", ind.scalp?.signal || "--", ind.scalp ? `Score ${ind.scalp.score}` : null, ind.scalp?.signal?.includes("BUY") ? s.green : ind.scalp?.signal?.includes("SELL") ? s.red : s.dim)}
          {renderRow("16. ADX DI Hist", ind.adxDIHist ? ind.adxDIHist.histogram.toFixed(2) : "--", ind.adxDIHist?.trendStrength || "--", ind.adxDIHist?.signal === "BUY" ? s.green : ind.adxDIHist?.signal === "SELL" ? s.red : s.dim)}
          {ind.adxDIHist && renderRow("  DI Diff", ind.adxDIHist.diDiff.toFixed(2), `+DI:${ind.adxDIHist.pdi.toFixed(1)} -DI:${ind.adxDIHist.ndi.toFixed(1)}`, null)}
          {renderRow("17. RSI Divergence", ind.rsiDiv?.type || "--", null, ind.rsiDiv?.bullish ? s.green : ind.rsiDiv?.bearish ? s.red : s.dim)}
        </SectionCard>

        {/* 4. Community Advanced */}
        <SectionCard title="Community - Advanced" accent={s.green}>
          {renderRow("18. ZigZag++", ind.zigzag ? `Swing ${ind.zigzag.swing.toFixed(2)}%` : "--", ind.zigzag?.trend, ind.zigzag?.trend === "UP" ? s.green : s.red)}
          {renderRow("19. Physical Levels", ind.physLevels?.nearest ? fmt(ind.physLevels.nearest, 2) : "--", ind.physLevels ? `${ind.physLevels.dist.toFixed(3)}% away` : null, null)}
          {renderRow("20. Balance of Power", ind.bop ? ind.bop.value.toFixed(4) : "--", ind.bop?.signal, ind.bop?.signal === "BULL" ? s.green : ind.bop?.signal === "BEAR" ? s.red : s.dim)}
          {renderRow("21. DBtrade", ind.dbtrade?.signal || "--", ind.dbtrade?.dir, ind.dbtrade?.dbBottom ? s.green : ind.dbtrade?.dbTop ? s.red : ind.dbtrade?.aboveEMA ? s.green : s.red)}
          {ind.dbtrade && renderRow("  EMA20", fmt(ind.dbtrade.ema20, 2), ind.dbtrade.aboveEMA ? "Above EMA" : "Below EMA", ind.dbtrade.aboveEMA ? s.green : s.red)}
          {renderRow("22. RSI Multi-TF", ind.rsiMulti ? `Avg ${ind.rsiMulti.avg}` : "--", ind.rsiMulti?.signal, ind.rsiMulti?.signal === "OVERBOUGHT" ? s.red : ind.rsiMulti?.signal === "OVERSOLD" ? s.green : s.dim)}
          {ind.rsiMulti && renderRow("  R7/R14/R21", `${ind.rsiMulti.r7?.toFixed(0)} / ${ind.rsiMulti.r14?.toFixed(0)} / ${ind.rsiMulti.r21?.toFixed(0)}`, ind.rsiMulti.confluence ? "CONFLUENCE" : "", ind.rsiMulti.confluence ? s.amber : null)}
        </SectionCard>

        {/* 5. Enhanced Signals */}
        <SectionCard title="Enhanced Signals" accent="#ec4899">
          {renderRow("24. Ichimoku", ind.ichimoku?.signal || "--", ind.ichimoku?.cloud, ind.ichimoku?.cloud === "ABOVE" ? s.green : ind.ichimoku?.cloud === "BELOW" ? s.red : s.amber)}
          {ind.ichimoku && renderRow("  TK Cross", ind.ichimoku.tkCross, `T:${fmt(ind.ichimoku.tenkan, 2)} K:${fmt(ind.ichimoku.kijun, 2)}`, ind.ichimoku.tkCross === "BULL" ? s.green : s.red)}
          {renderRow("25. Mars SSL", ind.marsSSL?.marsSignal || "--", ind.marsSSL?.confidence ? `${ind.marsSSL.confidence}% conf` : null, ind.marsSSL?.marsSignal?.includes("BUY") ? s.green : ind.marsSSL?.marsSignal?.includes("SELL") ? s.red : s.dim)}
          {ind.marsSSL && renderRow("  RSI Filter", ind.marsSSL.rsiFilter?.toFixed(1), `Channel: ${fmt(ind.marsSSL.channel, 4)}`, null)}
          {renderRow("26. Power of Stocks", ind.powerOfStocks ? `${ind.powerOfStocks.power}/100` : "--", ind.powerOfStocks?.grade, ind.powerOfStocks?.signal?.includes("BUY") ? s.green : ind.powerOfStocks?.signal?.includes("SELL") ? s.red : s.dim)}
          {ind.powerOfStocks && renderRow("  Components", `RSI:${ind.powerOfStocks.components.rsi} EMA:${ind.powerOfStocks.components.ema} MOM:${ind.powerOfStocks.components.momentum}`, ind.powerOfStocks.signal, null)}
          {renderRow("StochRSI", ind.stoch != null ? ind.stoch.toFixed(1) : "--", ind.stoch > 80 ? "OVERBOUGHT" : ind.stoch < 20 ? "OVERSOLD" : "NEUTRAL", ind.stoch > 80 ? s.red : ind.stoch < 20 ? s.green : s.dim)}
        </SectionCard>

        {/* 6. Gann Analysis */}
        <SectionCard title="Gann Square of Nine" accent="#FFD700">
          {renderRow("Direction", gann?.dir || "WAIT", null, gann?.dir === "LONG" ? s.green : gann?.dir === "SHORT" ? s.red : s.dim)}
          {renderRow("Score", gann?.score + "/4" || "--", null, null)}
          {renderRow("Nearest Level", gann?.nearest ? fmt(gann.nearest, 2) : "--", gann?.distPct + "% away", null)}
          {renderRow("Support", gann?.below ? fmt(gann.below, 2) : "--", null, s.green)}
          {renderRow("Resistance", gann?.above ? fmt(gann.above, 2) : "--", null, s.red)}
          {gann?.isSquared != null && renderRow("Price-Time Sq", gann.isSquared ? "ALIGNED" : "NO", null, gann.isSquared ? s.green : s.dim)}
          {gann?.inTimeCycle != null && renderRow("Time Cycle", gann.inTimeCycle ? "ACTIVE" : "INACTIVE", `Day ${gann.doy}`, gann.inTimeCycle ? s.amber : s.dim)}
        </SectionCard>

        {/* 7. Volume Profile & Smart Money */}
        <SectionCard title="Volume Profile & Smart Money" accent="#06b6d4">
          {renderRow("27. Volume Profile", ind.volumeProfile ? `POC: ${fmt(ind.volumeProfile.poc, 2)}` : "--", ind.volumeProfile?.signal || "--", ind.volumeProfile?.belowVA ? s.green : ind.volumeProfile?.aboveVA ? s.red : s.dim)}
          {ind.volumeProfile && renderRow("  Value Area", `${fmt(ind.volumeProfile.val, 2)} - ${fmt(ind.volumeProfile.vah, 2)}`, ind.volumeProfile.zone, null)}
          {ind.volumeProfile && renderRow("  POC Distance", `${ind.volumeProfile.pocDist}%`, ind.volumeProfile.belowVA ? "BELOW VA" : ind.volumeProfile.aboveVA ? "ABOVE VA" : "IN VA", ind.volumeProfile.belowVA ? s.green : ind.volumeProfile.aboveVA ? s.red : s.dim)}
          {renderRow("28. Smart Money (SMC)", ind.smc?.signal || "--", ind.smc?.confidence ? `${ind.smc.confidence}% conf` : null, ind.smc?.signal?.includes("BUY") ? s.green : ind.smc?.signal?.includes("SELL") ? s.red : s.dim)}
          {ind.smc && renderRow("  BOS", ind.smc.bos, ind.smc.bosDir || "--", ind.smc.bosDir === "LONG" ? s.green : ind.smc.bosDir === "SHORT" ? s.red : s.dim)}
          {ind.smc && renderRow("  ChoCH", ind.smc.choch, ind.smc.chochDir || "--", ind.smc.chochDir === "LONG" ? s.green : ind.smc.chochDir === "SHORT" ? s.red : s.dim)}
          {ind.smc && renderRow("  Order Blocks", `Bull: ${ind.smc.bullOB ? fmt(ind.smc.bullOB.price, 2) : "--"} | Bear: ${ind.smc.bearOB ? fmt(ind.smc.bearOB.price, 2) : "--"}`, `Scores: ${ind.smc.bullScore}B/${ind.smc.bearScore}S`, null)}
          {ind.smc && renderRow("  Fair Value Gaps", ind.smc.bullFVG ? `Bull FVG: ${ind.smc.bullFVG.size}%` : ind.smc.bearFVG ? `Bear FVG: ${ind.smc.bearFVG.size}%` : "None", null, null)}
        </SectionCard>

      </div>
    </div>
  );
}

/* ================================================================
   SETTINGS TAB
   ================================================================ */
function SettingsTab({ cfg, setCfg, ALL, setAll, setWatchlist, setSel, S: s, toast_ }) {
  const [newAsset, setNewAsset] = useState({ symbol: "", name: "", type: "crypto", currency: "USD", lotSize: 1, demo: "" });

  const updateCfg = (key, val) => setCfg((p) => ({ ...p, [key]: val }));
  const numInput = (label, key, min, max, step = 1) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${s.border}` }}>
      <span style={{ fontSize: 12, color: s.text }}>{label}</span>
      <input type="number" min={min} max={max} step={step} value={cfg[key] || ""} onChange={(e) => updateCfg(key, Number(e.target.value))}
        style={{ width: 80, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: "4px 8px", fontSize: 12, color: s.bright, ...mono, textAlign: "right", outline: "none" }} />
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
      {/* Trade Limits */}
      <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: s.bright, marginBottom: 12 }}>Trade Limits</div>
        {numInput("Max Trades Per Day", "maxTradesPerDay", 1, 200)}
        {numInput("Max Concurrent Trades", "maxConcurrentTrades", 1, 50)}
        {numInput("Cooldown (minutes)", "coolMins", 0, 120)}
      </div>
      {/* Risk Management */}
      <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: s.bright, marginBottom: 12 }}>Risk Management</div>
        {numInput("Stop Loss %", "stopLossPercent", 0.1, 200, 0.1)}
        {numInput("Take Profit %", "takeProfitPercent", 0.1, 300, 0.1)}
        {numInput("Capital Per Trade (USD)", "cryptoCap", 1, 1000000)}
        {numInput("Capital Per Trade (INR)", "fnoCap", 1, 10000000)}
        {numInput("Leverage", "lev", 1, 125)}
      </div>
      {/* Custom Assets */}
      <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: s.bright, marginBottom: 12 }}>Assets</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select value={newAsset.type} onChange={(e) => setNewAsset((p) => ({ ...p, type: e.target.value, currency: e.target.value === "fno" ? "INR" : "USD" }))}
            style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: "6px 10px", fontSize: 12, color: s.text, outline: "none" }}>
            <option value="crypto">Crypto</option>
            <option value="fno">F&O</option>
          </select>
          <input placeholder="Symbol (e.g. DOGE)" value={newAsset.symbol} onChange={(e) => setNewAsset((p) => ({ ...p, symbol: e.target.value.toUpperCase() }))}
            style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: "6px 10px", fontSize: 12, color: s.text, outline: "none" }} />
          <input placeholder="Name (e.g. Dogecoin)" value={newAsset.name} onChange={(e) => setNewAsset((p) => ({ ...p, name: e.target.value }))}
            style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: "6px 10px", fontSize: 12, color: s.text, outline: "none" }} />
          {newAsset.type === "fno" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input placeholder="Demo price" type="number" value={newAsset.demo} onChange={(e) => setNewAsset((p) => ({ ...p, demo: e.target.value }))}
                style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: "6px 10px", fontSize: 12, color: s.text, outline: "none" }} />
              <input placeholder="Lot size" type="number" value={newAsset.lotSize} onChange={(e) => setNewAsset((p) => ({ ...p, lotSize: e.target.value }))}
                style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: "6px 10px", fontSize: 12, color: s.text, outline: "none" }} />
            </div>
          )}
          <button onClick={() => {
            if (!newAsset.symbol || !newAsset.name) { toast_("Fill all fields", "error"); return; }
            if (ALL.find((a) => a.symbol === newAsset.symbol)) { toast_("Already exists", "warn"); return; }
            const color = PRESET_COLORS[ALL.length % PRESET_COLORS.length];
            const asset = newAsset.type === "crypto"
              ? { symbol: newAsset.symbol, name: newAsset.name, type: "crypto", color, dec: 4, cgId: newAsset.symbol.toLowerCase(), bnSym: newAsset.symbol + "USDT" }
              : { symbol: newAsset.symbol, name: newAsset.name, type: "fno", color, dec: 2, demo: Number(newAsset.demo) || 100, demoChg: 0, currency: "INR", lotSize: Number(newAsset.lotSize) || 1, exchange: "NSE" };
            setAll((p) => [...p, asset]);
            setNewAsset({ symbol: "", name: "", type: "crypto", currency: "USD", lotSize: 1, demo: "" });
            toast_(`${newAsset.symbol} added`, "success");
          }} style={{
            padding: "6px 0", fontSize: 11, fontWeight: 700, background: s.blue + "18", border: `1px solid ${s.blue}44`,
            borderRadius: 6, color: s.blue, cursor: "pointer",
          }}>Add Asset</button>
          <div style={{ borderTop: `1px solid ${s.border}`, marginTop: 8, paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {ALL.map((a) => (
              <div key={a.symbol} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 5, padding: "6px 8px" }}>
                <span style={{ fontSize: 11, color: a.color, fontWeight: 700 }}>{a.symbol} <span style={{ color: s.dim, fontWeight: 400 }}>{isCryptoAsset(a) ? "Crypto" : "F&O"}</span></span>
                <button onClick={() => {
                  setAll((p) => p.filter((x) => x.symbol !== a.symbol));
                  setWatchlist?.((p) => p.filter((sym) => sym !== a.symbol));
                  setSel?.((sym) => sym === a.symbol ? (ALL.find((x) => x.symbol !== a.symbol)?.symbol || "") : sym);
                  toast_(`${a.symbol} removed`, "warn");
                }} style={{ background: "transparent", border: "none", color: s.red, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>x</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   LOGS TAB
   ================================================================ */
function LogsTab({ logs, S: s }) {
  return (
    <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 8, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 3, height: 16, borderRadius: 2, background: s.dim }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: s.bright }}>Activity Log</span>
        <span style={{ fontSize: 10, color: s.dim, ...mono }}>{logs.length} entries</span>
      </div>
      <div style={{ maxHeight: 500, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        {logs.length === 0 && <div style={{ textAlign: "center", padding: "32px 0", color: s.dim, fontSize: 12 }}>No activity yet</div>}
        {logs.slice(-100).reverse().map((l, i) => (
          <div key={i} style={{
            display: "flex", gap: 10, alignItems: "baseline", padding: "4px 8px",
            background: i % 2 === 0 ? s.bg : "transparent", borderRadius: 4, fontSize: 11,
          }}>
            <span style={{ color: s.dim, ...mono, fontSize: 9, minWidth: 60 }}>{l.time}</span>
            <span style={{
              fontSize: 8, fontWeight: 600, padding: "1px 5px", borderRadius: 3, minWidth: 44, textAlign: "center",
              background: l.type === "trade" ? s.green + "18" : l.type === "error" ? s.red + "18" : l.type === "auto" ? s.amber + "18" : s.blue + "18",
              color: l.type === "trade" ? s.green : l.type === "error" ? s.red : l.type === "auto" ? s.amber : s.blue,
            }}>{l.type}</span>
            <span style={{ color: s.text, flex: 1 }}>{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   SENTIMENT BAR (mini component for bottom)
   ================================================================ */
function SentimentBar({ sentiments, S: s }) {
  if (!sentiments || sentiments.length === 0) return null;
  const avg = sentiments.reduce((a, b) => a + b.score, 0) / sentiments.length;
  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "center", padding: "4px 12px",
      background: s.card, borderRadius: 6, fontSize: 10, overflow: "hidden",
    }}>
      <span style={{ color: s.dim, whiteSpace: "nowrap" }}>Sentiment</span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: s.bg, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(5, (avg + 1) / 2 * 100)}%`, borderRadius: 2, background: avg > 0.2 ? s.green : avg < -0.2 ? s.red : s.amber, transition: "width 0.5s" }} />
      </div>
      <span style={{ color: avg > 0.2 ? s.green : avg < -0.2 ? s.red : s.amber, fontWeight: 600, ...mono }}>{avg > 0 ? "+" : ""}{avg.toFixed(2)}</span>
    </div>
  );
}

const UserPanel = ({ users, setUsers, currentUser, setCurrentUser, setShowUserMgmt, S, toast_ }) => {
  const [newName, setNewName] = useState("");
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];
  const addUser = () => {
    if (!newName.trim()) return;
    const id = Date.now().toString(36);
    const color = colors[users.length % colors.length];
    const u = { id, name: newName.trim(), avatar: newName.trim().slice(0, 2).toUpperCase(), color, createdAt: Date.now() };
    setUsers(p => [...p, u]);
    setNewName("");
    toast_(`User "${u.name}" created`, "success");
  };
  return (
    <div style={{ position: "fixed", top: 48, right: 16, zIndex: 200, background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: 16, width: 280, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: S.bright, marginBottom: 12 }}>User Profiles</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {users.map(u => (
          <div key={u.id} onClick={() => { setCurrentUser(u); setShowUserMgmt(false); toast_(`Switched to ${u.name}`, "success"); }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: currentUser.id === u.id ? u.color + "18" : S.bg, border: `1px solid ${currentUser.id === u.id ? u.color + "44" : S.border}`, borderRadius: 6, cursor: "pointer", transition: "all 0.15s" }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: u.color + "22", border: `2px solid ${u.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: u.color }}>{u.avatar}</div>
            <span style={{ fontSize: 12, color: currentUser.id === u.id ? S.bright : S.text, fontWeight: currentUser.id === u.id ? 600 : 400 }}>{u.name}</span>
            {currentUser.id === u.id && <span style={{ fontSize: 8, color: S.green, marginLeft: "auto" }}>Active</span>}
            {users.length > 1 && currentUser.id !== u.id && (
              <button onClick={(e) => { e.stopPropagation(); setUsers(p => p.filter(x => x.id !== u.id)); toast_(`Removed ${u.name}`, "warn"); }}
                style={{ marginLeft: "auto", background: "none", border: "none", color: S.dim, fontSize: 12, cursor: "pointer", padding: 0 }}>x</button>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addUser()}
          placeholder="New user name..." style={{ flex: 1, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 4, padding: "5px 8px", fontSize: 11, color: S.text, outline: "none" }} />
        <button onClick={addUser} style={{ padding: "5px 12px", fontSize: 10, fontWeight: 600, background: S.blue + "18", border: `1px solid ${S.blue}44`, borderRadius: 4, color: S.blue, cursor: "pointer" }}>Add</button>
      </div>
    </div>
  );
};

const BankPanel = ({ bankAccount, setBankAccount, S, toast_ }) => (
  <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: 16 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: S.bright, marginBottom: 12 }}>Bank Account (Payout)</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[{k:"name",l:"Account Holder Name"},{k:"bank",l:"Bank Name"},{k:"accNum",l:"Account Number",type:"password"},{k:"ifsc",l:"IFSC Code"},{k:"upiId",l:"UPI ID"}].map(f => (
        <div key={f.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
          <span style={{ fontSize: 12, color: S.text }}>{f.l}</span>
          <input type={f.type || "text"} value={bankAccount[f.k] || ""} onChange={e => setBankAccount(p => ({...p, [f.k]: e.target.value}))}
            style={{ width: 200, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 4, padding: "5px 8px", fontSize: 11, color: S.text, outline: "none", fontFamily: f.type === "password" ? "monospace" : "inherit" }} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={() => {
          if (!bankAccount.accNum || !bankAccount.ifsc) { toast_("Fill account number and IFSC", "error"); return; }
          setBankAccount(p => ({...p, linked: true}));
          toast_("Bank account linked successfully", "success");
        }} style={{ flex: 1, padding: "7px 0", fontSize: 11, fontWeight: 700, background: S.green + "15", border: `1px solid ${S.green}44`, borderRadius: 6, color: S.green, cursor: "pointer" }}>
          {bankAccount.linked ? "Update Account" : "Link Account"}
        </button>
        {bankAccount.linked && (
          <button onClick={() => { setBankAccount({ name: "", accNum: "", ifsc: "", bank: "", upiId: "", linked: false }); toast_("Bank account unlinked", "warn"); }}
            style={{ padding: "7px 16px", fontSize: 11, fontWeight: 600, background: S.red + "12", border: `1px solid ${S.red}44`, borderRadius: 6, color: S.red, cursor: "pointer" }}>Unlink</button>
        )}
      </div>
      {bankAccount.linked && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, padding: "6px 10px", background: S.greenDim, borderRadius: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: S.green }} />
          <span style={{ fontSize: 10, color: S.green }}>Bank account linked - {bankAccount.bank || "Bank"} ****{(bankAccount.accNum || "").slice(-4)}</span>
        </div>
      )}
      <div style={{ fontSize: 9, color: S.dim, marginTop: 4 }}>Bank details are stored locally in your browser only. Actual payouts require broker API integration.</div>
    </div>
  </div>
);

/* ================================================================
   MAIN APP
   ================================================================ */
export default function App() {
  /* ── State ── */
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem("alpha_tab") || "watchlist"; } catch { return "watchlist"; }
  });
  const [ALL, setAll] = useState(() => {
    try { const s = localStorage.getItem("alpha_assets"); return s ? JSON.parse(s) : [...DEFAULT_CRYPTO, ...DEFAULT_TRAD]; }
    catch { return [...DEFAULT_CRYPTO, ...DEFAULT_TRAD]; }
  });
  /* Multi-user */
  const [users, setUsers] = useState(() => {
    try { const s = localStorage.getItem("alpha_users"); return s ? JSON.parse(s) : [DEFAULT_USER]; } catch { return [DEFAULT_USER]; }
  });
  const [currentUser, setCurrentUser] = useState(() => {
    try { const s = localStorage.getItem("alpha_current_user"); return s ? JSON.parse(s) : DEFAULT_USER; } catch { return DEFAULT_USER; }
  });
  const [showUserMgmt, setShowUserMgmt] = useState(false);
  /* Bank account */
  const [bankAccount, setBankAccount] = useState(() => {
    try { const s = localStorage.getItem("alpha_bank"); return s ? JSON.parse(s) : { name: "", accNum: "", ifsc: "", bank: "", upiId: "", linked: false }; } catch { return { name: "", accNum: "", ifsc: "", bank: "", upiId: "", linked: false }; }
  });
  const [prices, setPrices] = useState(() => {
    const init = {};
    ALL.forEach(a => {
      // Only seed demo prices for open markets; closed markets show '--' until they open
      if (isOpen(a)) {
        init[a.symbol] = { usd: a.demo || 100, source: "demo", usd_24h_change: a.demoChg || 0 };
      }
    });
    return init;
  });
  const [hist, setHist] = useState({});
  const [ohlcPrices, setOhlcPrices] = useState({});
  const [indicators, setIndicators] = useState({});
  const [gannData, setGannData] = useState({});
  const [sel, setSel] = useState(() => {
    try { return localStorage.getItem("alpha_sel") || "BTC"; } catch { return "BTC"; }
  });
  const [cfg, setCfg] = useState(() => {
    try {
      const s = localStorage.getItem("alpha_cfg");
      if (!s) return DEFAULT_CFG;
      const saved = JSON.parse(s);
      return { ...DEFAULT_CFG, ...saved };
    } catch { return DEFAULT_CFG; }
  });
  const [trades, setTrades] = useState(() => {
    try { const s = localStorage.getItem("alpha_trades"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [wallet, setWallet] = useState(() => {
    try { const s = localStorage.getItem("alpha_wallet"); return s ? JSON.parse(s) : { usd: 200, inr: 20000, history: [] }; } 
    catch { return { usd: 200, inr: 20000, history: [] }; }
  });
  const [watchlist, setWatchlist] = useState(() => {
    try { const s = localStorage.getItem("alpha_watchlist"); return s ? JSON.parse(s) : ["BTC", "ETH", "SOL", "NIF"]; } catch { return ["BTC", "ETH", "SOL", "NIF"]; }
  });
  const [connections, setConnections] = useState(() => {
    try { const s = localStorage.getItem("alpha_connections"); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [logs, setLogs] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [sentiments, setSentiments] = useState([]);
  const [tradesToday, setTradesToday] = useState(0);
  const pricesRef = useRef(prices);
  pricesRef.current = prices;
  const indicatorsRef = useRef(indicators);
  indicatorsRef.current = indicators;
  const gannDataRef = useRef(gannData);
  gannDataRef.current = gannData;
  const tradesRef = useRef(trades);
  tradesRef.current = trades;
  const tradesTodayRef = useRef(tradesToday);
  tradesTodayRef.current = tradesToday;
  const sentimentsRef = useRef(sentiments);
  sentimentsRef.current = sentiments;
  const walletRef = useRef(wallet);
  useEffect(() => { walletRef.current = wallet; }, [wallet]);
  const histRef = useRef(hist);
  histRef.current = hist;
  const seededRef = useRef(new Set());

  /* ── Persist to localStorage ── */
  useEffect(() => { localStorage.setItem("alpha_cfg", JSON.stringify(cfg)); }, [cfg]);
  useEffect(() => { localStorage.setItem("alpha_assets", JSON.stringify(ALL)); }, [ALL]);
  useEffect(() => { localStorage.setItem("alpha_trades", JSON.stringify(trades)); }, [trades]);
  useEffect(() => { localStorage.setItem("alpha_wallet", JSON.stringify(wallet)); }, [wallet]);
  useEffect(() => { localStorage.setItem("alpha_watchlist", JSON.stringify(watchlist)); }, [watchlist]);
  useEffect(() => { localStorage.setItem("alpha_connections", JSON.stringify(connections)); }, [connections]);
  useEffect(() => { localStorage.setItem("alpha_users", JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem("alpha_current_user", JSON.stringify(currentUser)); }, [currentUser]);
  useEffect(() => { localStorage.setItem("alpha_bank", JSON.stringify(bankAccount)); }, [bankAccount]);
  useEffect(() => { localStorage.setItem("alpha_tab", tab); }, [tab]);
  useEffect(() => { localStorage.setItem("alpha_sel", sel); }, [sel]);

  /* ── Sync config to server (debounced) ── */
  const syncRef = useRef(null);
  const syncToServer = useCallback((data) => {
    if (syncRef.current) clearTimeout(syncRef.current);
    syncRef.current = setTimeout(() => {
      fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {});
    }, 1000);
  }, []);

  useEffect(() => { syncToServer({ cfg, trades, wallet, watchlist, connections, bankAccount, currentUserId: currentUser.id }); }, [cfg, trades, wallet, watchlist, connections, bankAccount, currentUser, syncToServer]);

  /* ── Restore persisted settings from server on startup ── */
  useEffect(() => {
    fetch('/api/config/load')
      .then(r => r.json())
      .then(data => {
        if (data.config) {
          const s = data.config;
          if (s.cfg) setCfg(prev => ({ ...prev, ...s.cfg }));
          if (s.trades) setTrades(s.trades);
          if (s.wallet) setWallet(s.wallet);
          if (s.watchlist) setWatchlist(s.watchlist);
          if (s.connections) setConnections(s.connections);
          if (s.bankAccount) setBankAccount(s.bankAccount);
        }
      })
      .catch(() => {});
  }, []);

  /* ── Toast helper ── */
  const toast_ = useCallback((msg, type = "info") => {
    const id = uid();
    setToasts((p) => [...p.slice(-4), { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  /* ── Log helper ── */
  const log_ = useCallback((msg, type = "info") => {
    setLogs((p) => [...p.slice(-500), { time: ts(), msg, type }]);
  }, []);

  /* ── Fetch Prices (Crypto & F&O from backend/Yahoo Finance) ── */
  useEffect(() => {
    const backendUrl = cfg?.fastApiUrl || "";

    const fetchPrices = async () => {
      // 1. Crypto prices from backend (Yahoo Finance, no rate limits)
      try {
        const r = await fetch(`/api/prices/crypto`, { signal: AbortSignal.timeout(8000) });
        if (r.ok) {
          const d = await r.json();
          setPrices((prev) => {
            const next = { ...prev };
            Object.entries(d).forEach(([sym, data]) => {
              if (data && data.usd != null) {
                next[sym] = { usd: data.usd, usd_24h_change: data.usd_24h_change, source: "yahoo_finance" };
              }
            });
            return next;
          });
        }
      } catch (e) {
        console.warn(`Crypto price fetch failed: ${e.message}`);
      }

      // 2. F&O prices from backend (Yahoo Finance)
      try {
        const r = await fetch(`${backendUrl}/api/prices/fno`, { signal: AbortSignal.timeout(8000) });
        if (r.ok) {
          const d = await r.json();
          setPrices((prev) => {
            const next = { ...prev };
            Object.entries(d).forEach(([sym, data]) => {
              if (data && !data.error && data.usd) {
                next[sym] = { ...data, source: "yahoo_finance" };
              }
            });
            return next;
          });
        }
      } catch (e) {
        console.warn(`Backend F&O price fetch failed: ${e.message}`);
      }
    };
    fetchPrices();
    const iv = setInterval(fetchPrices, 30000);
    return () => clearInterval(iv);
  }, [ALL, cfg?.fastApiUrl]);

  /* ── Live price micro-jitter for demo-priced assets only ── */
  useEffect(() => {
    const iv = setInterval(() => {
      setPrices((prev) => {
        const next = { ...prev };
        ALL.forEach((a) => {
          if (next[a.symbol] && isOpen(a) && !next[a.symbol].source) {
            const jitterPct = 0.0025;
            const jitter = next[a.symbol].usd * (Math.random() * jitterPct * 2 - jitterPct);
            next[a.symbol] = { ...next[a.symbol], usd: next[a.symbol].usd + jitter };
          }
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, [ALL]);

  /* ── Build history - LIVE (2s, skips closed markets) ── */
  useEffect(() => {
    const iv = setInterval(() => {
      setHist((prev) => {
        const next = { ...prev };
        Object.keys(pricesRef.current).forEach((sym) => {
          const asset = ALL.find((a) => a.symbol === sym);
          if (asset && !isOpen(asset)) return;
          const p = pricesRef.current[sym]?.usd;
          if (p) {
            const arr = [...(next[sym] || []), p];
            next[sym] = arr.slice(-200);
          }
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, [ALL]);

  /* ── Seed initial chart history so charts render immediately ── */
  useEffect(() => {
    const toSeed = ALL.filter((a) => {
      const p = prices[a.symbol]?.usd;
      return p && !seededRef.current.has(a.symbol) && (!hist[a.symbol] || hist[a.symbol].length < 10);
    });
    if (toSeed.length === 0) return;
    setHist((prev) => {
      const next = { ...prev };
      toSeed.forEach((a) => {
        const p = prices[a.symbol].usd;
        const seed = [];
        let v = p * (0.97 + Math.random() * 0.03);
        for (let i = 0; i < 120; i++) {
          seed.push(v);
          v += v * (Math.random() * 0.005 - 0.0025);
        }
        for (let i = 100; i < 120; i++) {
          const t = (i - 99) / 21;
          seed[i] = seed[i] * (1 - t) + p * t;
        }
        seed.push(p);
        next[a.symbol] = seed;
        seededRef.current.add(a.symbol);
      });
      return next;
    });
  }, [ALL, prices, hist]);

  /* ── Fetch real OHLC history for accurate indicators ── */
  const ohlcFetchedRef = useRef({});
  useEffect(() => {
    ALL.forEach((a) => {
      if (ohlcFetchedRef.current[a.symbol]) return;
      const sym = a.yfId || (a.cgId === 'bitcoin' ? 'BTC-USD' : a.cgId === 'ethereum' ? 'ETH-USD' : a.cgId === 'solana' ? 'SOL-USD' : a.cgId === 'cardano' ? 'ADA-USD' : a.cgId === 'avalanche-2' ? 'AVAX-USD' : a.yfId || a.symbol);
      fetch(`/api/chart/history?symbol=${a.symbol}&interval=1h`)
        .then(r => r.json())
        .then(data => {
          if (data.ohlc && data.ohlc.length > 10) {
            const closes = data.ohlc.map(c => c.close);
            setOhlcPrices(prev => ({ ...prev, [a.symbol]: closes }));
            ohlcFetchedRef.current[a.symbol] = true;
          }
        })
        .catch(() => {});
    });
  }, [ALL]);

  /* ── Compute indicators - LIVE (every 1s for real-time signals) ── */
  useEffect(() => {
    const compute = () => {
      const newInd = {};
      const newGann = {};
      ALL.forEach((a) => {
        const p = prices[a.symbol]?.usd;
        // Use real OHLC close prices when available, fall back to hist
        const h = ohlcPrices[a.symbol] || hist[a.symbol];
        if (h && h.length >= 5 && p) {
          newInd[a.symbol] = runAllIndicators(h, p, null);
          newGann[a.symbol] = gannSignal(p, h, prices[a.symbol]?.usd_24h_change);
        }
      });
      setIndicators(newInd);
      setGannData(newGann);
    };
    compute();
    const iv = setInterval(compute, 1000);
    return () => clearInterval(iv);
  }, [ALL, hist, ohlcPrices, prices]);

  /* ── Fetch sentiments (demo) ── */
  useEffect(() => {
    const gen = () => {
      const sources = ["Reuters", "Bloomberg", "CoinDesk", "Economic Times", "CNBC"];
      return sources.map((src) => ({ source: src, score: Math.random() * 2 - 1, ts: Date.now() }));
    };
    setSentiments(gen());
    const iv = setInterval(() => setSentiments(gen()), 60000);
    return () => clearInterval(iv);
  }, []);

  /* ── Place Trade ── */
  const placeTrade = useCallback((symbol, dir, src = "manual", indicatorName = null, customBracket = null) => {
    const asset = ALL.find((a) => a.symbol === symbol);
    if (!asset) { toast_("Asset not found", "error"); return; }
    const price = pricesRef.current[symbol]?.usd || asset.demo;
    if (!price) { toast_("No price data", "error"); return; }
    if (!isOpen(asset) && src !== "auto-hedge") { toast_(`Market closed for ${symbol}`, "warn"); log_(`Blocked ${dir} ${symbol} - market closed`, "error"); return; }

    

    let bracket = mkBracket(asset, price, dir, cfg);
    if (customBracket && customBracket.tp > 0 && customBracket.sl > 0) {
      bracket.tp = customBracket.tp;
      bracket.sl = customBracket.sl;
    }
    const allocatedCapital = (asset.currency === "INR") ? parseFloat(cfg.fnoCap) : parseFloat(cfg.cryptoCap);

    // Minimum trade value check (skip for hedge trades)
    const isINR = (asset.currency === "INR");
    const minVal = isINR ? (cfg.minTradeINR || 500) : (cfg.minTradeUSD || 10);
    if (allocatedCapital < minVal && src !== "auto-hedge") {
      toast_(`Trade value ${isINR ? "Rs" : "$"}${allocatedCapital.toFixed(0)} below minimum ${isINR ? "Rs" : "$"}${minVal}`, "error");
      log_(`Blocked ${dir} ${symbol} - below min trade value (${isINR ? "INR" : "USD"} ${minVal})`, "error");
      return;
    }

    // Available wallet balance check (skip for hedge trades — uses same capital)
    if (src !== "auto-hedge") {
    if (isINR) {
      if ((walletRef.current.inr || 0) < allocatedCapital) {
        toast_(`Insufficient INR balance to place trade. Need Rs ${allocatedCapital.toFixed(0)}`, "error");
        log_(`Blocked ${dir} ${symbol} - insufficient INR balance (Need ${allocatedCapital.toFixed(0)})`, "error");
        return;
      }
    } else {
      if ((walletRef.current.usd || 0) < allocatedCapital) {
        toast_(`Insufficient USD balance to place trade. Need $${allocatedCapital.toFixed(0)}`, "error");
        log_(`Blocked ${dir} ${symbol} - insufficient USD balance (Need ${allocatedCapital.toFixed(0)})`, "error");
        return;
      }
    }
    }

    // Record entry time for cooldown (applies to all trades)
    lastAutoRef.current[symbol] = Date.now();
    const tradeId = Date.now();
    const openedAt = Date.now();
    const trade = {
      id: tradeId,
      symbol,
      dir,
      entry: price,
      tp: parseFloat(bracket.tp),
      sl: parseFloat(bracket.sl),
      qty: bracket.qty,
      fee: bracket.fee,
      currency: asset.currency || "USD",
      status: "OPEN",
      src,
      indicator: indicatorName,
      openedAt,
      allocatedCapital,
      highPrice: price,
      lowPrice: price,
      initialTp: parseFloat(bracket.tp),
      tpActivated: false,
    };

    // Attach full 28-indicator analysis snapshot at entry
    const entryInd = indicatorsRef.current[symbol];
    const entryGann = gannDataRef.current[symbol];
    const entrySents = sentimentsRef.current;
    const entrySignal = { name: indicatorName || "Manual", dir, strength: 50, score: 1 };
    trade.entryAnalysis = buildEntryAnalysis(asset, entrySignal, entryInd, entryGann, price, entrySents);

    setTrades((p) => [...p, trade]);
    setTradesToday((p) => p + 1);

    // Debit wallet (skip for hedge trades — uses original trade's capital)
    if (src !== "auto-hedge") {
    if (asset.currency === "INR") {
      setWallet((w) => ({ ...w, inr: w.inr - allocatedCapital, history: [...w.history, { type: "debit", amount: allocatedCapital, currency: "INR", symbol, ts: Date.now() }] }));
    } else {
      setWallet((w) => ({ ...w, usd: w.usd - allocatedCapital, history: [...w.history, { type: "debit", amount: allocatedCapital, currency: "USD", symbol, ts: Date.now() }] }));
    }
    }

    toast_(`${dir} ${symbol} @ ${fmt(price, asset.dec)}`, "success");
    log_(`Opened ${dir} ${symbol} @ ${fmt(price, asset.dec)} via ${src}${indicatorName ? ` [${indicatorName}]` : ""}`, "trade");
    return tradeId;
  }, [ALL, cfg, toast_, log_]);

  /* ── Exit Trade ── */
  const exitTrade = useCallback((tradeId, reason = "MANUAL") => {
    const closedTrade = tradesRef.current.find((t) => t.id === tradeId && t.status === "OPEN");

    setTrades((prev) => prev.map((t) => {
      if (t.id !== tradeId || t.status !== "OPEN") return t;
      const currentPrice = pricesRef.current[t.symbol]?.usd || t.entry;
      const grossPnl = t.dir === "LONG" ? (currentPrice - t.entry) * (t.qty || 0) : (t.entry - currentPrice) * (t.qty || 0);
      const spreadCost = (t.fee || 0);
      const pnl = grossPnl - spreadCost;
      const asset = ALL.find((a) => a.symbol === t.symbol);

      // Credit wallet (skip hedge trades — no capital was debited)
      if (!t.hedgeOf) {
      const allocated = t.allocatedCapital || (t.currency === "INR" ? parseFloat(cfg.fnoCap) : parseFloat(cfg.cryptoCap));
      if (t.currency === "INR") {
        setWallet((w) => ({ ...w, inr: w.inr + allocated + pnl, history: [...w.history, { type: "credit", amount: allocated + pnl, currency: "INR", symbol: t.symbol, ts: Date.now() }] }));
      } else {
        setWallet((w) => ({ ...w, usd: w.usd + allocated + pnl, history: [...w.history, { type: "credit", amount: allocated + pnl, currency: "USD", symbol: t.symbol, ts: Date.now() }] }));
      }
      }

      toast_(`Closed ${t.symbol} ${t.dir} @ ${fmt(currentPrice, asset?.dec)} | P&L: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} (${reason})`, pnl >= 0 ? "success" : "error");
      log_(`Closed ${t.dir} ${t.symbol} @ ${fmt(currentPrice, asset?.dec)} | P&L: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} | ${reason}`, "trade");

      return { ...t, status: "CLOSED", exitPrice: currentPrice, closedAt: Date.now(), exitReason: reason, pnl };
    }));

    // If this trade has a linked hedge or parent, close the pair
    if (closedTrade) {
      const allTrades = tradesRef.current;
      if (closedTrade.hedgeTradeId) {
        const linked = allTrades.find((tr) => tr.id === closedTrade.hedgeTradeId && tr.status === "OPEN");
        if (linked) setTimeout(() => exitTrade(linked.id, "Hedge Close"), 100);
      }
      if (closedTrade.hedgeOf) {
        const parent = allTrades.find((tr) => tr.id === closedTrade.hedgeOf && tr.status === "OPEN");
        if (parent) setTimeout(() => exitTrade(parent.id, "Hedge Close"), 100);
      }
    }
  }, [ALL, cfg, toast_, log_, placeTrade]);

  /* ── Exit All ── */
  const exitAllTrades = useCallback(() => {
    const openIds = tradesRef.current.filter((t) => t.status === "OPEN").map((t) => t.id);
    openIds.forEach((id) => exitTrade(id, "MANUAL"));
  }, [exitTrade]);

  /* ── cfgRef — always current config, readable inside any setInterval closure ── */
  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);

  /* ── Auto-Trader: TP/SL check + indicator exit ── */
  useEffect(() => {
    const iv = setInterval(() => {
      const openTrades = tradesRef.current.filter((t) => t.status === "OPEN");
      const updates = [];
      
      openTrades.forEach((t) => {
        const p = pricesRef.current[t.symbol]?.usd;
        if (!p) return;

        let updated = false;
        let newSl = t.sl;
        let newHigh = t.highPrice || t.entry;
        let newLow = t.lowPrice || t.entry;
        let tpActivated = t.tpActivated || false;

        // --- Trailing SL / TP Update Phase (reads cfgRef to avoid stale closure) ---
        const liveCfg = cfgRef.current;
        if (liveCfg.trailingEnabled) {
          // Trail using the user's configured SL percentage, adjusted for leverage
          const trailSlPct = liveCfg.stopLossPercent || 2; 
          const asset = ALL.find((a) => a.symbol === t.symbol);
          const lev = (asset && asset.currency === "INR") ? 50 : liveCfg.lev; // F&O 50x implicit leverage
          
          if (t.dir === "LONG") {
            if (p > newHigh) { newHigh = p; updated = true; }
            const dynamicSl = newHigh * (1 - (trailSlPct / 100) / lev);
            // Only trail up, and only if it doesn't immediately tighten the user's initial SL incorrectly
            if (dynamicSl > newSl && dynamicSl < p) { newSl = dynamicSl; updated = true; }
          } else {
            if (p < newLow) { newLow = p; updated = true; }
            const dynamicSl = newLow * (1 + (trailSlPct / 100) / lev);
            if (dynamicSl < newSl && dynamicSl > p) { newSl = dynamicSl; updated = true; }
          }
        }

        if (updated) {
          updates.push({ id: t.id, sl: newSl, highPrice: newHigh, lowPrice: newLow, tpActivated });
        }

        // --- Execution Phase ---
        const asset = ALL.find((a) => a.symbol === t.symbol);
        // Market Close Auto Square-Off (Traditional markets only)
        if (asset && isClosingSoon(asset, 15)) {
          exitTrade(t.id, "Auto Square-Off (Market Close)");
          return;
        }

        // --- Hedge Engine ---
        const allocatedCapital = t.allocatedCapital || (t.currency === "INR" ? parseFloat(liveCfg.fnoCap) : parseFloat(liveCfg.cryptoCap));
        const pnlRaw = (t.dir === "LONG" ? p - t.entry : t.entry - p) * t.qty;

        // Trigger hedge: open opposite direction when loss exceeds threshold
        if (!t.hedged && !t.hedgeOf) {
          const pnlPct = allocatedCapital > 0 ? (pnlRaw / allocatedCapital) * 100 : 0;
          if (pnlPct <= (liveCfg.hedgeLossPct || -10)) {
            updates.push({ id: t.id, hedged: true });
            const oppDir = t.dir === "LONG" ? "SHORT" : "LONG";
            log_(`Hedge triggered for ${t.symbol} at ${pnlPct.toFixed(1)}% loss. Opening ${oppDir}.`, "warn");
            setTimeout(() => {
              const hedgeId = placeTrade(t.symbol, oppDir, "auto-hedge", "Hedge");
              if (hedgeId) {
                // Link hedge to original and vice versa
                setTrades((prev) => prev.map((tr) => {
                  if (tr.id === t.id) return { ...tr, hedgeTradeId: hedgeId };
                  if (tr.id === hedgeId) return { ...tr, hedgeOf: t.id };
                  return tr;
                }));
              }
            }, 50);
          }
        }

        // Combined hedge check: calculate net P&L of original + hedge trades
        if (t.hedged && !t.hedgeOf) {
          const allOpen = tradesRef.current.filter((tr) => tr.status === "OPEN");
          const hedgeTrade = allOpen.find((tr) => tr.hedgeOf === t.id);
          if (hedgeTrade) {
            const hedgePrice = pricesRef.current[hedgeTrade.symbol]?.usd || hedgeTrade.entry;
            const hedgePnl = (hedgeTrade.dir === "LONG" ? hedgePrice - hedgeTrade.entry : hedgeTrade.entry - hedgePrice) * hedgeTrade.qty;
            const combinedPnl = pnlRaw + hedgePnl;
            if (combinedPnl >= 0) {
              const beReason = "Hedge Breakeven";
              log_(`Hedge pair for ${t.symbol} recovered to breakeven (combined Rs.${combinedPnl.toFixed(0)}). Exiting both.`, "info");
              setTimeout(() => { exitTrade(hedgeTrade.id, beReason); }, 50);
              setTimeout(() => exitTrade(t.id, beReason), 100);
              return;
            }
          } else {
            // Hedge trade was already closed — fall through to normal SL/TP
          }
        }

        // Skip individual SL/TP for hedged trades — managed by combined P&L
        if (!t.hedged && !t.hedgeOf) {
        // Check SL FIRST (risk management priority over profit)
        const slHit = (t.dir === "LONG" && p <= newSl) || (t.dir === "SHORT" && p >= newSl);
        if (slHit) {
          const slInd = indicatorsRef.current[t.symbol];
          const slGann = gannDataRef.current[t.symbol];
          const slReason = tpActivated ? "Trailing TP" : (liveCfg.trailingEnabled && newSl !== t.sl) ? "Trailing SL" : "Stop Loss";
          const slConditions = (slInd && p) ? getAllSignals(slInd, slGann, p, null, t.symbol).map(s => ({ name: s.name, signal: s.dir, strength: s.strength, score: s.score })) : [];
          setTrades((prev) => prev.map((tr) => tr.id === t.id ? { ...tr, exitAnalysis: { indicator: slReason, signal: { name: slReason, dir: t.dir === "LONG" ? "SHORT" : "LONG", strength: 100 }, reason: slReason, conditions: slConditions, timestamp: new Date().toISOString() } } : tr));
          setTimeout(() => exitTrade(t.id, slReason), 50);
          return;
        }

        // Check fixed TP
        const tpHit = (t.dir === "LONG" && p >= t.tp) || (t.dir === "SHORT" && p <= t.tp);
        if (tpHit) {
          const tpInd = indicatorsRef.current[t.symbol];
          const tpGann = gannDataRef.current[t.symbol];
          const tpConditions = (tpInd && p) ? getAllSignals(tpInd, tpGann, p, null, t.symbol).map(s => ({ name: s.name, signal: s.dir, strength: s.strength, score: s.score })) : [];
          setTrades((prev) => prev.map((tr) => tr.id === t.id ? { ...tr, exitAnalysis: { indicator: "TP", signal: { name: "Take Profit", dir: t.dir, strength: 100 }, reason: "TP", conditions: tpConditions, timestamp: new Date().toISOString() } } : tr));
          setTimeout(() => exitTrade(t.id, "TP"), 50);
          return;
        }

        // --- Breakeven SL activation ---
        if (!t.partialClosed && t.sl !== t.entry) {
          const slDist = Math.abs(t.entry - t.sl);
          const currentRr = slDist > 0 ? (t.dir === "LONG" ? (p - t.entry) / slDist : (t.entry - p) / slDist) : 0;
          if (currentRr >= (cfg.partialProfitRr || 1)) {
            setTrades((prev) => prev.map((tr) => {
              if (tr.id !== t.id) return tr;
              const beSl = t.dir === "LONG" ? t.entry * 0.998 : t.entry * 1.002;
              return { ...tr, sl: beSl, partialClosed: true };
            }));
            log_(`Breakeven SL activated for ${t.symbol} at ${currentRr.toFixed(1)}R`, "auto");
          }
        }

        // --- Multi-indicator exit signal ---
        const tradeAge = Date.now() - (t.openedAt || 0);
        const MIN_HOLD_MS = cfg?.coolMins ? cfg.coolMins * 60 * 1000 * 0.5 : 120000;
        const exitInd = indicatorsRef.current[t.symbol];
        const exitGann = gannDataRef.current[t.symbol];
        if (exitInd && tradeAge >= MIN_HOLD_MS) {
          const exitSig = pickBestExitIndicator(exitInd, exitGann, p, t.dir, t.indicator);
          if (exitSig) {
            setTimeout(() => exitTrade(t.id, `${exitSig.name}: ${exitSig.reason || "Exit signal"}`), 50);
            log_(`Indicator exit: ${t.dir} ${t.symbol} - ${exitSig.name} (${exitSig.reason || ""})`, "auto");
            return;
          }
        }
        } // end hedged-TP/SL skip
      });
      
      // Apply batch state updates for trailing metrics
      if (updates.length > 0) {
        setTrades((prev) => prev.map((tr) => {
          const upd = updates.find((u) => u.id === tr.id);
          return upd ? { ...tr, ...upd } : tr;
        }));
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [ALL, exitTrade, log_]);

  /* ── Reset daily counter ── */
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const ms = midnight - now;
    const t = setTimeout(() => setTradesToday(0), ms);
    return () => clearTimeout(t);
  }, [tradesToday]);


  /* ── Render ── */
  return (
    <div style={{ minHeight: "100vh", background: S.bg }}>
      <Toast toasts={toasts} />
      <Header tab={tab} setTab={setTab} prices={prices} ALL={ALL}
        currentUser={currentUser} users={users} setCurrentUser={setCurrentUser}
        setShowUserMgmt={setShowUserMgmt} showUserMgmt={showUserMgmt} />
      {showUserMgmt && <UserPanel users={users} setUsers={setUsers} currentUser={currentUser} setCurrentUser={setCurrentUser} setShowUserMgmt={setShowUserMgmt} S={S} toast_={toast_} />}
      <div style={{ padding: "16px 20px", maxWidth: 1440, margin: "0 auto" }}>
        {tab === "watchlist" && (
          <MarketTab ALL={ALL} prices={prices} hist={hist} indicators={indicators} gannData={gannData}
            watchlist={watchlist} setWatchlist={setWatchlist} sel={sel} setSel={setSel}
            trades={trades} cfg={cfg} placeTrade={placeTrade} S={S} toast_={toast_} />
        )}
        {tab === "trades" && (
          <TradesTab trades={trades} prices={prices} exitTrade={exitTrade} exitAllTrades={exitAllTrades}
            cfg={cfg} setCfg={setCfg} ALL={ALL} S={S} toast_={toast_}
            placeTrade={placeTrade} />
        )}
        {tab === "portfolio" && (
          <PortfolioTab trades={trades} prices={prices} wallet={wallet} setWallet={setWallet} S={S} ALL={ALL} toast_={toast_} cfg={cfg} />
        )}
        {tab === "fno" && (
          <FnODashboard prices={prices} S={S} toast_={toast_} />
        )}
        {tab === "fno-verdict" && (
          <FnoVerdictTab prices={prices} hist={hist} S={S} toast_={toast_} />
        )}
        {tab === "charts" && (
          <ChartsPage ALL={ALL} prices={prices} hist={hist} sel={sel} setSel={setSel} S={S} indicators={indicators} />
        )}
        {tab === "indicators" && (
          <IndicatorsTab ALL={ALL} prices={prices} indicators={indicators} gannData={gannData} sel={sel} setSel={setSel} S={S} />
        )}
        {tab === "14k" && (
          <FourteenKTab prices={prices} hist={hist} S={S} />
        )}
        {tab === "analysis" && (
          <AnalysisTab trades={trades} prices={prices} indicators={indicators} ALL={ALL} S={S} toast_={toast_} />
        )}
        {tab === "verdict" && (
          <TradeVerdictTab ALL={ALL} prices={prices} indicators={indicators} gannData={gannData} hist={hist} S={S} toast_={toast_} />
        )}
        {tab === "connections" && (
          <ConnectionsTab connections={connections} setConnections={setConnections} S={S} toast_={toast_} />
        )}
        {tab === "settings" && (
          <>
            <SettingsTab cfg={cfg} setCfg={setCfg} ALL={ALL} setAll={setAll} setWatchlist={setWatchlist} setSel={setSel} S={S} toast_={toast_} />
            <div style={{ marginTop: 16 }}><BankPanel bankAccount={bankAccount} setBankAccount={setBankAccount} S={S} toast_={toast_} /></div>
          </>
        )}
        {tab === "logs" && (
          <LogsTab logs={logs} S={S} />
        )}
      </div>
      {/* Bottom bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: 32,
        background: S.card, borderTop: `1px solid ${S.border}`,
        display: "flex", alignItems: "center", padding: "0 20px", gap: 16, zIndex: 100,
      }}>
        <span style={{ fontSize: 9, color: S.dim }}>
          <span style={{ color: currentUser.color, fontWeight: 600 }}>{currentUser.name}</span>
          {" | "}Trades: <span style={{ color: S.text, ...mono }}>{trades.filter((t) => t.status === "OPEN").length} open</span>
          {" / "}<span style={{ color: S.text, ...mono }}>{tradesToday} today</span>
        </span>
        <span style={{ fontSize: 9, color: S.dim }}>
          Wallet: <span style={{ color: S.green, ...mono }}>${fmt(wallet.usd, 0)}</span>
          {" | "}<span style={{ color: S.green, ...mono }}>Rs {fmt(wallet.inr, 0)}</span>
        </span>
        {bankAccount.linked && <span style={{ fontSize: 9, color: S.green }}>Bank Linked</span>}
        <div style={{ flex: 1 }} />
        <SentimentBar sentiments={sentiments} S={S} />
        <span style={{ fontSize: 9, color: S.dim, ...mono }}>{ts()}</span>
      </div>
      <div style={{ height: 36 }} /> {/* spacer for bottom bar */}
    </div>
  );
}
