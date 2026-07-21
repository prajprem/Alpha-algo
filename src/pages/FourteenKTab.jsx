import { useState, useEffect, useCallback, useRef } from "react";
import { isOpen } from "../constants";

const mono = { fontFamily: "'JetBrains Mono', monospace" };
const fmt = (v, d = 2) => v == null ? "--" : Number(v).toFixed(d);
const pct = (v) => v == null ? "--" : (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%";

const isGreen = (c) => c.close >= c.open;
const isRed = (c) => c.close < c.open;

function calcEma(arr, p) {
  if (!arr || arr.length < p) return [];
  const k = 2 / (p + 1);
  const result = [];
  let e = arr.slice(0, p).reduce((a, b) => a + b, 0) / p;
  for (let i = 0; i < p - 1; i++) result.push(null);
  result.push(e);
  for (let i = p; i < arr.length; i++) { e = arr[i] * k + e * (1 - k); result.push(e); }
  return result;
}

function determineTrend(ohlc) {
  if (!ohlc || ohlc.length < 20) return "UP";
  const closes = ohlc.map(c => c.close);
  const ema20 = calcEma(closes, 20);
  const lastIdx = ohlc.length - 1;
  if (ema20[lastIdx] == null) return "UP";
  return ohlc[lastIdx].close >= ema20[lastIdx] ? "UP" : "DOWN";
}

function extractPattern(candles, mStart, i, rEnd, dir) {
  const momCandles = candles.slice(mStart, i);
  const retCandles = candles.slice(i, rEnd + 1);
  const range = Math.max(...momCandles.map(c => c.high)) - Math.min(...momCandles.map(c => c.low));
  const isUp = dir === "GREEN";
  const level = isUp
    ? retCandles[retCandles.length - 1].low + range * 1.618
    : retCandles[retCandles.length - 1].high - range * 1.618;

  return {
    trend: isUp ? "UP" : "DOWN",
    momCount: i - mStart,
    retCount: rEnd - i + 1,
    range,
    level: Math.round(level * 100) / 100,
    momHigh: Math.max(...momCandles.map(c => c.high)),
    momLow: Math.min(...momCandles.map(c => c.low)),
    retLow: retCandles[retCandles.length - 1].low,
    retHigh: retCandles[retCandles.length - 1].high,
    lastRetOpen: retCandles[retCandles.length - 1].open,
    lastRetClose: retCandles[retCandles.length - 1].close,
    lastRetTime: retCandles[retCandles.length - 1].time,
    momStart: mStart, momEnd: i - 1, retStart: i, retEnd: rEnd,
  };
}

function findPatternsByMomCount(candles, targetMom) {
  if (!candles || candles.length < 4) return [];
  const patterns = [];

  for (let i = candles.length - 1; i >= 3; i--) {
    const momDir = isGreen(candles[i - 1]) ? "GREEN" : "RED";

    if ((momDir === "GREEN" && isRed(candles[i])) || (momDir === "RED" && isGreen(candles[i]))) {
      let rEnd = i;
      const maxRet = targetMom === 2 ? 2 : 3;
      while (rEnd < candles.length - 1 && (isRed(candles[rEnd + 1]) === (momDir === "GREEN")) && (rEnd - i) < maxRet - 1) rEnd++;
      const retCount = rEnd - i + 1;
      if (retCount !== 1 && retCount !== (targetMom === 2 ? 2 : 3)) continue;

      let mStart = i - 1;
      while (mStart > 0 && (isGreen(candles[mStart - 1]) === (momDir === "GREEN"))) mStart--;
      const momCount = i - mStart;
      if (momCount !== targetMom) continue;

      patterns.push(extractPattern(candles, mStart, i, rEnd, momDir));
    }
  }

  patterns.sort((a, b) => new Date(b.lastRetTime) - new Date(a.lastRetTime));
  patterns.forEach((p, idx) => { p.label = String.fromCharCode(97 + idx); });
  return patterns;
}

function findAllPatterns3M(candles) { return findPatternsByMomCount(candles, 3); }
function findAllPatterns2M(candles) { return findPatternsByMomCount(candles, 2); }

function buildLiveCandles(ohlc, histPrices, currentPrice, intervalMs) {
  if (!ohlc || ohlc.length < 2) return ohlc || [];
  const candles = [...ohlc];
  const last = candles[candles.length - 1];
  const lastTime = new Date(last.time).getTime();
  const now = Date.now();
  const threshold = intervalMs || 5 * 60 * 1000;

  if (now - lastTime < threshold && currentPrice != null) {
    const upd = { ...last };
    if (currentPrice > upd.high) upd.high = currentPrice;
    if (currentPrice < upd.low) upd.low = currentPrice;
    upd.close = currentPrice;
    candles[candles.length - 1] = upd;
  } else if (currentPrice != null) {
    candles.push({
      time: new Date(now).toISOString(),
      open: last.close,
      high: Math.max(last.close, currentPrice),
      low: Math.min(last.close, currentPrice),
      close: currentPrice,
      volume: 0,
    });
  }
  return candles;
}

export default function FourteenKTab({ ALL, prices, hist, S }) {
  const openSymbols = (ALL || []).filter(a => isOpen(a)).map(a => a.symbol);
  const [results, setResults] = useState(() => {
    try { return JSON.parse(localStorage.getItem('alpha_14k')) || {}; } catch { return {}; }
  });
  const [loading, setLoading] = useState(true);
  const [expandedSym, setExpandedSym] = useState(null);
  const pricesRef = useRef(prices);
  const histRef = useRef(hist);
  pricesRef.current = prices;
  histRef.current = hist;

  useEffect(() => { localStorage.setItem('alpha_14k', JSON.stringify(results)); }, [results]);

  const fetchSym = useCallback(async (sym, currentPrice, histPrices) => {
    const result = { sym };
    try {
      const [trendR, patR] = await Promise.all([
        fetch(`/api/chart/history?symbol=${sym}&interval=1h`, { signal: AbortSignal.timeout(10000) }),
        fetch(`/api/chart/history?symbol=${sym}&interval=5m`, { signal: AbortSignal.timeout(10000) }),
      ]);
      if (!trendR.ok) { return { ...result, error: "trend fetch failed" }; }
      if (!patR.ok) { return { ...result, error: "pattern fetch failed" }; }

      const [trendData, patData] = await Promise.all([trendR.json(), patR.json()]);
      if (!trendData.ohlc || trendData.ohlc.length < 20) { return { ...result, error: "insufficient 1h data" }; }
      if (!patData.ohlc || patData.ohlc.length < 10) { return { ...result, error: "insufficient 5m data" }; }

      const trend = determineTrend(trendData.ohlc);
      const blended = buildLiveCandles(patData.ohlc, histPrices?.[sym], currentPrice?.[sym]?.usd, 5 * 60 * 1000);
      const all3M = findAllPatterns3M(blended);
      const patterns3M = all3M.filter(p => p.trend === trend);
      const all2M = findAllPatterns2M(blended);
      const patterns2M = all2M.filter(p => p.trend === trend);

      return { ...result, trend, patterns: patterns3M, patterns2M, candleCount: patData.ohlc.length, blendedCount: blended.length };
    } catch (e) {
      return { ...result, error: e.message };
    }
  }, []);

  const analyze = useCallback(async () => {
    const open = (ALL || []).filter(a => isOpen(a)).map(a => a.symbol);
    const p = pricesRef.current;
    const h = histRef.current;
    setLoading(true);
    const resultsArr = await Promise.all(open.map(sym => fetchSym(sym, p, h)));
    const out = {};
    resultsArr.forEach(r => { out[r.sym] = r; });
    setResults(out);
    setLoading(false);
  }, [ALL, fetchSym]);

  useEffect(() => { analyze(); }, [analyze]);

  return (
    <div className="fin" style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{
        background: S.card, border: `1px solid ${S.border}`, borderRadius: 8,
        padding: "14px 18px", marginBottom: 14,
        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: S.bright }}>14K Indicator</div>
        <div style={{ fontSize: 10, color: S.dim }}>
          1h trend + 5m patterns using the 1.618 Fibonacci ratio
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={analyze} style={{
          padding: "5px 12px", fontSize: 10, fontWeight: 600,
          background: S.blue + "18", border: `1px solid ${S.blue}44`,
          borderRadius: 4, color: S.blue, cursor: "pointer",
        }}>
          {loading ? "Analyzing..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: S.dim, fontSize: 13 }}>
          Analyzing 15m charts across all assets...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {openSymbols.map(sym => {
            const r = results[sym];
            if (!r) return null;
            const price = prices?.[sym]?.usd;
            const assetColor = sym === "BTC" ? "#F7931A" : sym === "ETH" ? "#627EEA" : sym === "SOL" ? "#9945FF" : sym === "ADA" ? "#0D99FF" : sym === "AVAX" ? "#E84142" : sym === "XAU/USD" ? "#FFD700" : sym === "XAG/USD" ? "#C0C0C0" : sym === "OIL" ? "#E8883A" : sym === "NIF" ? "#FF9933" : sym === "BNK" ? "#00B4D8" : sym === "REL" ? "#0077B6" : S.blue;
            const trend = r.trend;
            const patterns = r.patterns;
            const patterns2M = r.patterns2M;
            const currentPrice = price;

            const isExpanded = expandedSym === sym;

            const renderPatternCard = (p) => {
              const formulaVal = p.trend === "UP"
                ? `${fmt(p.retLow, 2)} + (${fmt(p.momHigh, 2)} − ${fmt(p.momLow, 2)}) × 1.618`
                : `${fmt(p.retHigh, 2)} − (${fmt(p.momHigh, 2)} − ${fmt(p.momLow, 2)}) × 1.618`;
              return (
                <div key={p.label} style={{
                  display: "flex", flexDirection: "column", gap: 4,
                  padding: "6px 10px", background: S.bg, borderRadius: 6, fontSize: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 11, color: p.trend === "UP" ? S.green : S.red, minWidth: 16 }}>{p.label}.</span>
                    <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600, background: p.trend === "UP" ? S.green + "18" : S.red + "18", color: p.trend === "UP" ? S.green : S.red }}>
                      {p.trend === "UP" ? "BULL" : "BEAR"}
                    </span>
                    <span style={{ color: S.dim }}>{p.momCount}M → {p.retCount}R</span>
                    <span style={{ color: S.amber, ...mono }}>Range: {fmt(p.range, 2)}</span>
                    <span style={{ color: S.bright, fontWeight: 700, ...mono }}>14K: {fmt(p.level, 2)}</span>
                    {currentPrice != null && (
                      <span style={{ ...mono, fontWeight: 600, color: currentPrice >= p.level ? S.green : S.red }}>
                        {pct(((currentPrice - p.level) / p.level) * 100)}
                      </span>
                    )}
                    <div style={{ flex: 1 }} />
                    <span style={{ color: S.dim, fontSize: 9 }}>{p.lastRetTime ? new Date(p.lastRetTime).toLocaleString() : "—"}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 9, color: S.dim, padding: "4px 0 0 18px", flexWrap: "wrap" }}>
                    <span>{p.trend === "UP" ? "Retrace Low" : "Retrace High"} = <span style={{ color: S.text, ...mono }}>{fmt(p.trend === "UP" ? p.retLow : p.retHigh, 2)}</span></span>
                    <span>Mom High = <span style={{ color: S.text, ...mono }}>{fmt(p.momHigh, 2)}</span></span>
                    <span>Mom Low = <span style={{ color: S.text, ...mono }}>{fmt(p.momLow, 2)}</span></span>
                    <span>Range = {fmt(p.momHigh, 2)} − {fmt(p.momLow, 2)} = <span style={{ color: S.amber, ...mono }}>{fmt(p.range, 2)}</span></span>
                    <span>Formula: {formulaVal} = <span style={{ color: S.bright, fontWeight: 700, ...mono }}>{fmt(p.level, 2)}</span></span>
                  </div>
                </div>
              );
            };

            const has3M = patterns && patterns.length > 0;
            const has2M = patterns2M && patterns2M.length > 0;

            return (
              <div key={sym} style={{
                background: S.card, border: `1px solid ${S.border}`, borderRadius: 8,
                padding: "12px 16px",
              }}>
                <div onClick={() => setExpandedSym(isExpanded ? null : sym)} style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: isExpanded && (has3M || has2M) ? 10 : 0,
                  cursor: "pointer", userSelect: "none",
                }}>
                  <span style={{ fontSize: 10, color: S.dim, transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: assetColor, boxShadow: `0 0 6px ${assetColor}66` }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: assetColor }}>{sym}</span>
                  {currentPrice != null && (
                    <span style={{ fontSize: 10, color: S.dim, ...mono }}>${fmt(currentPrice, 2)}</span>
                  )}
                  {trend && (
                    <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 7px", borderRadius: 3, background: trend === "UP" ? S.green + "18" : S.red + "18", color: trend === "UP" ? S.green : S.red, border: `1px solid ${trend === "UP" ? S.green : S.red}44` }}>
                      1h {trend === "UP" ? "↑ BULL" : "↓ BEAR"}
                    </span>
                  )}
                  {r.error && <span style={{ fontSize: 10, color: S.red }}>{r.error}</span>}
                  {!r.error && !has3M && !has2M && (
                    <span style={{ fontSize: 10, color: S.dim }}>No patterns detected</span>
                  )}
                  {has3M && <span style={{ fontSize: 9, color: S.amber }}>3M: {patterns.length}</span>}
                  {has2M && <span style={{ fontSize: 9, color: S.purple }}>2M: {patterns2M.length}</span>}
                </div>

                {isExpanded && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {has3M && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: S.mid, marginBottom: 4 }}>3-Candle Momentum Patterns</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {patterns.map(renderPatternCard)}
                        </div>
                      </div>
                    )}
                    {has2M && (
                      <details style={{ marginTop: has3M ? 4 : 0 }}>
                        <summary style={{ fontSize: 10, fontWeight: 600, color: S.purple, cursor: "pointer", userSelect: "none" }}>
                          2-Candle Momentum Patterns ({patterns2M.length})
                        </summary>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                          {patterns2M.map(renderPatternCard)}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
