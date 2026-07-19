import { useState, useMemo, useEffect, useCallback } from "react";

const mono = { fontFamily: "'JetBrains Mono', monospace" };
const fmt = (v, d = 2) => v == null ? "--" : Number(v).toFixed(d);
const pct = (v) => v == null ? "--" : (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%";

const SUPPORTED = ["BTC","ETH","SOL","ADA","AVAX","XAU/USD","XAG/USD","OIL","NIF","BNK","REL"];

const isGreen = (c) => c.close >= c.open;
const isRed = (c) => c.close < c.open;

function findAllPatterns(candles) {
  if (!candles || candles.length < 6) return [];
  const patterns = [];

  for (let i = candles.length - 1; i >= 3; i--) {
    const momDir = isGreen(candles[i - 1]) ? "GREEN" : "RED";

    if (momDir === "GREEN" && isRed(candles[i])) {
      let rEnd = i;
      while (rEnd < candles.length - 1 && isRed(candles[rEnd + 1]) && (rEnd - i) < 2) rEnd++;
      const retCount = rEnd - i + 1;
      if (retCount !== 1 && retCount !== 3) continue;

      let mStart = i - 1;
      while (mStart > 0 && isGreen(candles[mStart - 1])) mStart--;
      const momCount = i - mStart;
      if (momCount < 3) continue;

      const momCandles = candles.slice(mStart, i);
      const retCandles = candles.slice(i, rEnd + 1);
      const range = Math.max(...momCandles.map(c => c.high)) - Math.min(...momCandles.map(c => c.low));
      const level = retCandles[retCandles.length - 1].low + range * 1.618;

      patterns.push({
        trend: "UP",
        momCount, retCount, range,
        level: Math.round(level * 100) / 100,
        momHigh: Math.max(...momCandles.map(c => c.high)),
        momLow: Math.min(...momCandles.map(c => c.low)),
        retLow: retCandles[retCandles.length - 1].low,
        retHigh: Math.max(...retCandles.map(c => c.high)),
        lastRetOpen: retCandles[retCandles.length - 1].open,
        lastRetClose: retCandles[retCandles.length - 1].close,
        lastRetTime: retCandles[retCandles.length - 1].time,
        momStart: mStart, momEnd: i - 1, retStart: i, retEnd: rEnd,
      });
    }

    if (momDir === "RED" && isGreen(candles[i])) {
      let rEnd = i;
      while (rEnd < candles.length - 1 && isGreen(candles[rEnd + 1]) && (rEnd - i) < 2) rEnd++;
      const retCount = rEnd - i + 1;
      if (retCount !== 1 && retCount !== 3) continue;

      let mStart = i - 1;
      while (mStart > 0 && isRed(candles[mStart - 1])) mStart--;
      const momCount = i - mStart;
      if (momCount < 3) continue;

      const momCandles = candles.slice(mStart, i);
      const retCandles = candles.slice(i, rEnd + 1);
      const range = Math.max(...momCandles.map(c => c.high)) - Math.min(...momCandles.map(c => c.low));
      const level = retCandles[retCandles.length - 1].high - range * 1.618;

      patterns.push({
        trend: "DOWN",
        momCount, retCount, range,
        level: Math.round(level * 100) / 100,
        momHigh: Math.max(...momCandles.map(c => c.high)),
        momLow: Math.min(...momCandles.map(c => c.low)),
        retHigh: retCandles[retCandles.length - 1].high,
        retLow: Math.min(...retCandles.map(c => c.low)),
        lastRetOpen: retCandles[retCandles.length - 1].open,
        lastRetClose: retCandles[retCandles.length - 1].close,
        lastRetTime: retCandles[retCandles.length - 1].time,
        momStart: mStart, momEnd: i - 1, retStart: i, retEnd: rEnd,
      });
    }
  }

  // Reverse so oldest first, then assign labels a, b, c...
  patterns.reverse();
  patterns.forEach((p, idx) => { p.label = String.fromCharCode(97 + idx); });
  return patterns;
}

function buildLiveCandles(ohlc, histPrices, currentPrice) {
  if (!ohlc || ohlc.length < 2) return ohlc || [];
  const candles = [...ohlc];
  const last = candles[candles.length - 1];
  const lastTime = new Date(last.time).getTime();
  const now = Date.now();
  const fifteenMin = 15 * 60 * 1000;

  if (now - lastTime >= fifteenMin) {
    const open = last.close;
    const close = currentPrice != null ? currentPrice : last.close;
    const allP = [open, close, ...(histPrices || [])];
    candles.push({
      time: new Date(now).toISOString(),
      open,
      high: Math.max(...allP),
      low: Math.min(...allP),
      close,
      volume: 0,
    });
  }
  return candles;
}

export default function FourteenKTab({ prices, hist, S }) {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);

  const analyze = useCallback(async () => {
    setLoading(true);
    const out = {};

    for (const sym of SUPPORTED) {
      try {
        const r = await fetch(`/api/chart/history?symbol=${sym}&interval=15m`, {
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) { out[sym] = { error: "fetch failed" }; continue; }
        const data = await r.json();
        if (!data.ohlc || data.ohlc.length < 10) { out[sym] = { error: "insufficient data" }; continue; }

        // Blend historical 15m candles with a live candle from realtime data
        const currentPrice = prices?.[sym]?.usd;
        const histPrices = hist?.[sym];
        const blended = buildLiveCandles(data.ohlc, histPrices, currentPrice);
        const patterns = findAllPatterns(blended);
        out[sym] = { patterns, candleCount: data.ohlc.length, blendedCount: blended.length };
      } catch (e) {
        out[sym] = { error: e.message };
      }
    }

    setResults(out);
    setLoading(false);
  }, []);

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
          Detects momentum-retracement patterns on 1h charts using the 1.618 Fibonacci ratio
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
          {SUPPORTED.map(sym => {
            const r = results[sym];
            if (!r) return null;
            const price = prices?.[sym]?.usd;
            const assetColor = sym === "BTC" ? "#F7931A" : sym === "ETH" ? "#627EEA" : sym === "SOL" ? "#9945FF" : sym === "ADA" ? "#0D99FF" : sym === "AVAX" ? "#E84142" : sym === "XAU/USD" ? "#FFD700" : sym === "XAG/USD" ? "#C0C0C0" : sym === "OIL" ? "#E8883A" : sym === "NIF" ? "#FF9933" : sym === "BNK" ? "#00B4D8" : sym === "REL" ? "#0077B6" : S.blue;
            const patterns = r.patterns;
            const currentPrice = price;

            return (
              <div key={sym} style={{
                background: S.card, border: `1px solid ${S.border}`, borderRadius: 8,
                padding: "12px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: patterns?.length ? 10 : 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: assetColor, boxShadow: `0 0 6px ${assetColor}66` }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: assetColor }}>{sym}</span>
                  {currentPrice != null && (
                    <span style={{ fontSize: 10, color: S.dim, ...mono }}>${fmt(currentPrice, 2)}</span>
                  )}
                  {r.error && <span style={{ fontSize: 10, color: S.red }}>{r.error}</span>}
                  {!r.error && (!patterns || patterns.length === 0) && (
                    <span style={{ fontSize: 10, color: S.dim }}>No patterns detected</span>
                  )}
                  {patterns && patterns.length > 0 && (
                    <span style={{ fontSize: 9, color: S.amber }}>{patterns.length} pattern{patterns.length > 1 ? "s" : ""} found</span>
                  )}
                </div>

                {patterns && patterns.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {patterns.map(p => {
                      const formulaVal = p.trend === "UP"
                        ? `${fmt(p.retLow, 2)} + (${fmt(p.momHigh, 2)} − ${fmt(p.momLow, 2)}) × 1.618`
                        : `${fmt(p.retHigh, 2)} − (${fmt(p.momHigh, 2)} − ${fmt(p.momLow, 2)}) × 1.618`;
                      return (
                      <div key={p.label} style={{
                        display: "flex", flexDirection: "column", gap: 4,
                        padding: "6px 10px", background: S.bg, borderRadius: 6, fontSize: 10,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{
                          fontWeight: 700, fontSize: 11,
                          color: p.trend === "UP" ? S.green : S.red,
                          minWidth: 16,
                        }}>{p.label}.</span>

                        <span style={{
                          padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600,
                          background: p.trend === "UP" ? S.green + "18" : S.red + "18",
                          color: p.trend === "UP" ? S.green : S.red,
                        }}>
                          {p.trend === "UP" ? "BULL" : "BEAR"}
                        </span>

                        <span style={{ color: S.dim }}>
                          {p.momCount}M → {p.retCount}R
                        </span>

                        <span style={{ color: S.amber, ...mono }}>
                          Range: {fmt(p.range, 2)}
                        </span>

                        <span style={{ color: S.bright, fontWeight: 700, ...mono }}>
                          14K: {fmt(p.level, 2)}
                        </span>

                        {currentPrice != null && (
                          <span style={{
                            ...mono, fontWeight: 600,
                            color: currentPrice >= p.level ? S.green : S.red,
                          }}>
                            {pct(((currentPrice - p.level) / p.level) * 100)}
                          </span>
                        )}

                        <div style={{ flex: 1 }} />

                        <span style={{ color: S.dim, fontSize: 9 }}>
                          {p.lastRetTime ? new Date(p.lastRetTime).toLocaleString() : "—"}
                        </span>
                        </div>

                        {/* Formula breakdown */}
                        <div style={{
                          display: "flex", gap: 12, fontSize: 9, color: S.dim,
                          padding: "4px 0 0 18px", flexWrap: "wrap",
                        }}>
                          <span>
                            {p.trend === "UP" ? "Retrace Low" : "Retrace High"} ={" "}
                            <span style={{ color: S.text, ...mono }}>{fmt(p.trend === "UP" ? p.retLow : p.retHigh, 2)}</span>
                          </span>
                          <span>
                            Mom High = <span style={{ color: S.text, ...mono }}>{fmt(p.momHigh, 2)}</span>
                          </span>
                          <span>
                            Mom Low = <span style={{ color: S.text, ...mono }}>{fmt(p.momLow, 2)}</span>
                          </span>
                          <span>
                            Range = {fmt(p.momHigh, 2)} − {fmt(p.momLow, 2)} ={" "}
                            <span style={{ color: S.amber, ...mono }}>{fmt(p.range, 2)}</span>
                          </span>
                          <span>
                            Formula: {formulaVal} ={" "}
                            <span style={{ color: S.bright, fontWeight: 700, ...mono }}>{fmt(p.level, 2)}</span>
                          </span>
                        </div>
                      </div>
                    );})}
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
