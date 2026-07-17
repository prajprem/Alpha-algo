import { useMemo } from "react";
import { getAllSignals, getMajoritySignal } from "../indicators";

const fmt = (v, d = 2) => (v == null ? "--" : v > 9999 ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : Number(v).toFixed(d));
const pct = (v) => (v == null ? "--" : (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%");

export default function TradeVerdictTab({ ALL, prices, indicators, gannData, hist, S, toast_ }) {
  const verdicts = useMemo(() => {
    return ALL.map((a) => {
      const price = prices[a.symbol]?.usd || a.demo;
      const ind = indicators[a.symbol];
      const gann = gannData[a.symbol];
      const chg = prices[a.symbol]?.usd_24h_change || a.demoChg;

      if (!ind || !price) return { symbol: a.symbol, name: a.name, color: a.color, verdict: "HOLD", price, chg };

      const signals = getAllSignals(ind, gann, price, null, a.symbol);
      const majority = getMajoritySignal(ind, gann, price, null, a.symbol);

      let longCount = 0, shortCount = 0, total = 0;
      let topLongScore = 0, topShortScore = 0;
      let topLongName = "", topShortName = "";
      const indicatorVotes = [];

      if (signals && signals.length > 0) {
        total = signals.length;
        signals.forEach(s => {
          if (s.dir === "LONG") {
            longCount++;
            if (s.score > topLongScore) { topLongScore = s.score; topLongName = s.name; }
            indicatorVotes.push({ name: s.name, dir: s.dir, strength: s.strength, score: s.score });
          } else if (s.dir === "SHORT") {
            shortCount++;
            if (s.score > topShortScore) { topShortScore = s.score; topShortName = s.name; }
            indicatorVotes.push({ name: s.name, dir: s.dir, strength: s.strength, score: s.score });
          }
        });
      }

      const verdict = majority ? (majority.dir === "LONG" ? "BUY" : "SELL") : "HOLD";
      const longRatio = total > 0 ? (longCount / total * 100) : 0;
      const shortRatio = total > 0 ? (shortCount / total * 100) : 0;

      let reasoning = "";
      if (verdict === "BUY") {
        reasoning = `${longCount}/${total} indicators (${longRatio.toFixed(0)}%) align BUY, exceeding the 70% threshold. `;
        reasoning += `Key drivers: ${topLongName} (score ${topLongScore}). `;
        reasoning += `Bearish counter: ${shortCount} indicator${shortCount !== 1 ? 's' : ''} dissent.`;
      } else if (verdict === "SELL") {
        reasoning = `${shortCount}/${total} indicators (${shortRatio.toFixed(0)}%) align SELL, exceeding the 70% threshold. `;
        reasoning += `Key drivers: ${topShortName} (score ${topShortScore}). `;
        reasoning += `Bullish counter: ${longCount} indicator${longCount !== 1 ? 's' : ''} dissent.`;
      } else {
        if (total === 0) {
          reasoning = "Insufficient indicator data to form a verdict.";
        } else {
          reasoning = `No clear consensus. ${longCount} LONG vs ${shortCount} SHORT. `;
          reasoning += `BUY conviction: ${longRatio.toFixed(0)}%, SELL conviction: ${shortRatio.toFixed(0)}%. Need >70% for a verdict.`;
        }
      }

      return {
        symbol: a.symbol, name: a.name, color: a.color, dec: a.dec || 2,
        price, chg, verdict, longCount, shortCount, total,
        longRatio, shortRatio, reasoning, indicatorVotes, majority,
        topLongName, topShortName,
      };
    });
  }, [ALL, prices, indicators, gannData, hist]);

  const buyCount = verdicts.filter(v => v.verdict === "BUY").length;
  const sellCount = verdicts.filter(v => v.verdict === "SELL").length;
  const holdCount = verdicts.filter(v => v.verdict === "HOLD").length;

  return (
    <div className="fin" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Summary bar */}
      <div style={{
        background: S.card, border: `1px solid ${S.border}`, borderRadius: 8,
        padding: "14px 18px", marginBottom: 14,
        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: S.bright }}>Trade Verdicts</div>
        <div style={{ display: "flex", gap: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: S.green }}>BUY {buyCount}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: S.red }}>SELL {sellCount}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: S.amber }}>HOLD {holdCount}</span>
        </div>
        <div style={{ fontSize: 10, color: S.dim }}>
          Verdict requires &gt;70% indicator agreement
        </div>
      </div>

      {/* Verdict cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: 12 }}>
        {verdicts.map(v => {
          const verdictColor = v.verdict === "BUY" ? S.green : v.verdict === "SELL" ? S.red : S.amber;
          const longPct = v.total > 0 ? (v.longCount / v.total * 100) : 0;
          const shortPct = v.total > 0 ? (v.shortCount / v.total * 100) : 0;

          return (
            <div key={v.symbol} style={{
              background: S.card, border: `1px solid ${verdictColor}44`,
              borderRadius: 8, overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                padding: "12px 14px",
                borderBottom: `1px solid ${S.border}`,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: v.color }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: v.color }}>{v.symbol}</span>
                <span style={{ fontSize: 10, color: S.dim }}>{v.name}</span>
                <div style={{ flex: 1 }} />
                <div style={{
                  padding: "3px 10px", borderRadius: 4,
                  background: `${verdictColor}20`,
                  border: `1px solid ${verdictColor}55`,
                  fontSize: 12, fontWeight: 700, color: verdictColor,
                }}>
                  {v.verdict}
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "12px 14px" }}>
                {/* Price & Change */}
                <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: 11 }}>
                  <span style={{ color: S.dim }}>
                    Price: <span style={{ color: S.text, fontWeight: 600 }}>${fmt(v.price, v.dec)}</span>
                  </span>
                  <span style={{ color: v.chg >= 0 ? S.green : S.red, fontWeight: 600 }}>
                    {pct(v.chg)}
                  </span>
                </div>

                {/* Indicator vote bars */}
                {v.total > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: S.dim, marginBottom: 4 }}>
                      <span style={{ color: S.green }}>BUY {v.longCount}/{v.total}</span>
                      <span style={{ color: S.red }}>SELL {v.shortCount}/{v.total}</span>
                    </div>
                    <div style={{ height: 6, background: S.bg, borderRadius: 3, display: "flex", overflow: "hidden" }}>
                      <div style={{ width: `${longPct}%`, background: S.green, transition: "width 0.3s" }} />
                      <div style={{ width: `${shortPct}%`, background: S.red, transition: "width 0.3s" }} />
                    </div>
                    <div style={{ fontSize: 9, color: S.dim, marginTop: 2 }}>
                      BUY {longPct.toFixed(0)}% / SELL {shortPct.toFixed(0)}%
                    </div>
                  </div>
                )}

                {/* Verdict reasoning */}
                <div style={{
                  fontSize: 10, color: S.text, lineHeight: 1.6,
                  background: S.bg, borderRadius: 6, padding: "8px 10px",
                  border: `1px solid ${S.border}`,
                }}>
                  <strong style={{ color: verdictColor }}>Analysis:</strong> {v.reasoning}
                </div>

                {/* Indicator breakdown (collapsible detail) */}
                {v.indicatorVotes.length > 0 && (
                  <details style={{ marginTop: 10 }}>
                    <summary style={{
                      fontSize: 10, color: S.blue, cursor: "pointer",
                      fontWeight: 600, userSelect: "none",
                    }}>
                      Indicator Details ({v.indicatorVotes.length})
                    </summary>
                    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                      {v.indicatorVotes.sort((a, b) => b.score - a.score).map(sig => (
                        <div key={sig.name} style={{
                          display: "flex", alignItems: "center", gap: 6,
                          fontSize: 10, padding: "3px 6px",
                          background: sig.dir === "LONG" ? "#10b98108" : "#ef444408",
                          borderRadius: 4,
                        }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: "50%",
                            background: sig.dir === "LONG" ? S.green : S.red, flexShrink: 0,
                          }} />
                          <span style={{ color: S.text, fontWeight: 600, width: 100, flexShrink: 0 }}>{sig.name}</span>
                          <span style={{
                            color: sig.dir === "LONG" ? S.green : S.red,
                            fontWeight: 600, width: 40,
                          }}>
                            {sig.dir}
                          </span>
                          <span style={{ color: S.dim }}>score: {sig.score.toFixed(1)}</span>
                          <div style={{ flex: 1 }} />
                          <div style={{
                            height: 4, width: 60, background: S.bg, borderRadius: 2, overflow: "hidden",
                          }}>
                            <div style={{
                              height: "100%", width: `${Math.min(100, sig.strength)}%`,
                              background: sig.dir === "LONG" ? S.green : S.red,
                              borderRadius: 2,
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
