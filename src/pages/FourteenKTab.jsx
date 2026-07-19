import { useState, useMemo, useEffect, useCallback } from "react";

const mono = { fontFamily: "'JetBrains Mono', monospace" };
const fmt = (v, d = 2) => v == null ? "--" : Number(v).toFixed(d);
const pct = (v) => v == null ? "--" : (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%";

const SUPPORTED = ["BTC","ETH","SOL","ADA","AVAX","XAU/USD","XAG/USD","OIL","NIF","BNK","REL"];

const isGreen = (c) => c.close >= c.open;
const isRed = (c) => c.close < c.open;

function findPattern(candles) {
  if (!candles || candles.length < 6) return null;

  for (let i = candles.length - 1; i >= 3; i--) {
    const momDir = isGreen(candles[i - 1]) ? "GREEN" : "RED";

    // Check retracement: 1-3 candles of opposite direction from i to i+r
    if (momDir === "GREEN" && isRed(candles[i])) {
      let rEnd = i;
      while (rEnd < candles.length - 1 && isRed(candles[rEnd + 1]) && (rEnd - i) < 2) rEnd++;
      const retCount = rEnd - i + 1;
      if (retCount < 1 || retCount > 3) continue;

      // Check momentum: >=3 green candles before i-1
      let mStart = i - 1;
      while (mStart > 0 && isGreen(candles[mStart - 1])) mStart--;
      const momCount = i - mStart;
      if (momCount < 3) continue;

      const momCandles = candles.slice(mStart, i);
      const retCandles = candles.slice(i, rEnd + 1);
      const range = Math.max(...momCandles.map(c => c.high)) - Math.min(...momCandles.map(c => c.low));
      const level = retCandles[retCandles.length - 1].low + range * 1.618;

      return {
        trend: "UP",
        momCount,
        retCount,
        range,
        level: Math.round(level * 100) / 100,
        lastRetLow: retCandles[retCandles.length - 1].low,
        lastRetTime: retCandles[retCandles.length - 1].time,
        momStart: mStart,
        momEnd: i - 1,
        retStart: i,
        retEnd: rEnd,
      };
    }

    if (momDir === "RED" && isGreen(candles[i])) {
      let rEnd = i;
      while (rEnd < candles.length - 1 && isGreen(candles[rEnd + 1]) && (rEnd - i) < 2) rEnd++;
      const retCount = rEnd - i + 1;
      if (retCount < 1 || retCount > 3) continue;

      let mStart = i - 1;
      while (mStart > 0 && isRed(candles[mStart - 1])) mStart--;
      const momCount = i - mStart;
      if (momCount < 3) continue;

      const momCandles = candles.slice(mStart, i);
      const retCandles = candles.slice(i, rEnd + 1);
      const range = Math.max(...momCandles.map(c => c.high)) - Math.min(...momCandles.map(c => c.low));
      const level = retCandles[retCandles.length - 1].high - range * 1.618;

      return {
        trend: "DOWN",
        momCount,
        retCount,
        range,
        level: Math.round(level * 100) / 100,
        lastRetHigh: retCandles[retCandles.length - 1].high,
        lastRetTime: retCandles[retCandles.length - 1].time,
        momStart: mStart,
        momEnd: i - 1,
        retStart: i,
        retEnd: rEnd,
      };
    }
  }
  return null;
}

export default function FourteenKTab({ prices, S }) {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);

  const analyze = useCallback(async () => {
    setLoading(true);
    const out = {};

    for (const sym of SUPPORTED) {
      try {
        const r = await fetch(`/api/chart/history?symbol=${sym}&interval=1h`, {
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) { out[sym] = { error: "fetch failed" }; continue; }
        const data = await r.json();
        if (!data.ohlc || data.ohlc.length < 10) { out[sym] = { error: "insufficient data" }; continue; }

        const pattern = findPattern(data.ohlc);
        out[sym] = { pattern, candleCount: data.ohlc.length };
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
          Analyzing 1h charts across all assets...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {SUPPORTED.map(sym => {
            const r = results[sym];
            if (!r) return null;
            const price = prices?.[sym]?.usd;
            const assetColor = sym === "BTC" ? "#F7931A" : sym === "ETH" ? "#627EEA" : sym === "SOL" ? "#9945FF" : sym === "ADA" ? "#0D99FF" : sym === "AVAX" ? "#E84142" : sym === "XAU/USD" ? "#FFD700" : sym === "XAG/USD" ? "#C0C0C0" : sym === "OIL" ? "#E8883A" : sym === "NIF" ? "#FF9933" : sym === "BNK" ? "#00B4D8" : sym === "REL" ? "#0077B6" : S.blue;
            const pattern = r.pattern;

            return (
              <div key={sym} style={{
                background: S.card, border: `1px solid ${S.border}`, borderRadius: 8,
                padding: "12px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: assetColor, boxShadow: `0 0 6px ${assetColor}66` }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: assetColor }}>{sym}</span>

                  {r.error ? (
                    <span style={{ fontSize: 10, color: S.red }}>{r.error}</span>
                  ) : pattern ? (
                    <>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 3,
                        background: pattern.trend === "UP" ? S.green + "18" : S.red + "18",
                        color: pattern.trend === "UP" ? S.green : S.red,
                        border: `1px solid ${pattern.trend === "UP" ? S.green : S.red}44`,
                      }}>
                        {pattern.trend === "UP" ? "BULLISH" : "BEARISH"}
                      </span>

                      <span style={{ fontSize: 10, color: S.dim }}>
                        {pattern.momCount} momentum → {pattern.retCount} retracement
                      </span>

                      <span style={{ fontSize: 10, color: S.amber, ...mono }}>
                        Range: {fmt(pattern.range, 2)}
                      </span>

                      <span style={{ fontSize: 12, fontWeight: 700, color: S.bright, ...mono }}>
                        14K: {fmt(pattern.level, 2)}
                      </span>

                      {price != null && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, ...mono,
                          color: price >= pattern.level ? S.green : S.red,
                        }}>
                          Current: {fmt(price, 2)}
                          <span style={{ color: S.dim, marginLeft: 4 }}>
                            ({pct(((price - pattern.level) / pattern.level) * 100)})
                          </span>
                        </span>
                      )}

                      <div style={{ flex: 1 }} />

                      <div style={{
                        height: 4, borderRadius: 2, minWidth: 80,
                        background: S.bg, overflow: "hidden", flex: "0 0 100px",
                      }}>
                        <div style={{
                          height: "100%", borderRadius: 2,
                          width: `${Math.min(100, price != null ? Math.abs((price / pattern.level - 1) * 200) : 0)}%`,
                          background: pattern.trend === "UP" ? S.green : S.red,
                          opacity: 0.6,
                        }} />
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize: 10, color: S.dim }}>No pattern detected</span>
                  )}
                </div>

                {/* Detail row */}
                {pattern && (
                  <div style={{
                    marginTop: 8, paddingTop: 8, borderTop: `1px solid ${S.border}`,
                    display: "flex", gap: 20, fontSize: 9, color: S.dim, flexWrap: "wrap",
                  }}>
                    <span>Formula: last retracement {pattern.trend === "UP" ? "low" : "high"} ({fmt(pattern.trend === "UP" ? pattern.lastRetLow : pattern.lastRetHigh, 2)}) + range ({fmt(pattern.range, 2)}) × 1.618</span>
                    <span>Time: {pattern.lastRetTime ? new Date(pattern.lastRetTime).toLocaleString() : "—"}</span>
                    {pattern.lastRetTime && (
                      <span>Candle idx: {pattern.momStart}–{pattern.momEnd} momentum, {pattern.retStart}–{pattern.retEnd} retracement</span>
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
