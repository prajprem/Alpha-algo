import { useState, useMemo, useEffect, useCallback } from "react";
import { gannSignal } from "../indicators";

const mono = { fontFamily: "'JetBrains Mono', monospace" };
const fmt = (n, d = 2) => n == null ? "--" : Number(n).toFixed(d);

const INSTRUMENTS = [
  { key: "NIFTY", name: "Nifty 50", assetSym: "NIF", color: "#FF9933", lotSize: 25 },
  { key: "BANKNIFTY", name: "Bank Nifty", assetSym: "BNK", color: "#00B4D8", lotSize: 15 },
  { key: "FINNIFTY", name: "FinNifty", assetSym: "FIN", color: "#8b5cf6", lotSize: 25 },
];

const getExpiries = (count = 4) => {
  const expiries = [];
  const d = new Date();
  let c = 0;
  while (c < count) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 4) {
      expiries.push(new Date(d));
      c++;
    }
  }
  return expiries.map((e) => ({
    date: e,
    label: e.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    daysToExpiry: Math.max(1, Math.ceil((e - new Date()) / 86400000)),
  }));
};

const calcMaxPain = (strikes) => {
  let maxPainStrike = strikes.length > 0 ? strikes[Math.floor(strikes.length / 2)].strike : 0;
  let minPain = Infinity;
  strikes.forEach((row) => {
    let pain = 0;
    strikes.forEach((r) => {
      if (r.strike < row.strike) pain += r.ce.oi * (row.strike - r.strike);
      if (r.strike > row.strike) pain += r.pe.oi * (r.strike - row.strike);
    });
    if (pain < minPain) { minPain = pain; maxPainStrike = row.strike; }
  });
  return maxPainStrike;
};

const computeSignals = (chain, spot, hist, chgVal) => {
  const strikes = chain.strikes || [];
  if (strikes.length === 0) return null;

  // 1. OI Buildup - compare total CE vs PE OI change
  const totalCEOiChg = strikes.reduce((s, r) => s + (r.ce.oiChg || 0), 0);
  const totalPEOiChg = strikes.reduce((s, r) => s + (r.pe.oiChg || 0), 0);
  const totalCEOi = strikes.reduce((s, r) => s + (r.ce.oi || 0), 0);
  const totalPEOi = strikes.reduce((s, r) => s + (r.pe.oi || 0), 0);

  let oiBuildupSignal = "HOLD";
  let oiBuildupReason = "";
  const oiChgDiff = totalPEOiChg - totalCEOiChg;
  if (Math.abs(oiChgDiff) > Math.max(totalCEOi, totalPEOi) * 0.02) {
    if (oiChgDiff > 0) {
      oiBuildupSignal = "BUY";
      oiBuildupReason = `PE OI buildup (${fmt(totalPEOiChg)}) exceeds CE OI buildup (${fmt(totalCEOiChg)}) — bullish positioning`;
    } else {
      oiBuildupSignal = "SELL";
      oiBuildupReason = `CE OI buildup (${fmt(totalCEOiChg)}) exceeds PE OI buildup (${fmt(totalPEOiChg)}) — bearish positioning`;
    }
  } else {
    oiBuildupReason = `CE OI: ${fmt(totalCEOiChg)} | PE OI: ${fmt(totalPEOiChg)} — no significant directional buildup`;
  }

  // 2. Max Pain
  const maxPainStrike = calcMaxPain(strikes);
  const maxPainDiff = spot - maxPainStrike;
  let maxPainSignal = "HOLD";
  let maxPainReason = "";
  const painPct = Math.abs(maxPainDiff) / spot * 100;
  if (maxPainDiff > 0 && painPct > 0.3) {
    maxPainSignal = "BUY";
    maxPainReason = `Spot (${fmt(spot, 0)}) above Max Pain (${fmt(maxPainStrike, 0)}) by ${fmt(maxPainDiff, 0)} pts — bullish pressure`;
  } else if (maxPainDiff < 0 && painPct > 0.3) {
    maxPainSignal = "SELL";
    maxPainReason = `Spot (${fmt(spot, 0)}) below Max Pain (${fmt(maxPainStrike, 0)}) by ${fmt(Math.abs(maxPainDiff), 0)} pts — bearish pressure`;
  } else {
    maxPainReason = `Spot near Max Pain (${fmt(maxPainStrike, 0)}) — range-bound, expiry may pin`;
  }

  // 3. Put-Call Ratio (OI-based, contrarian)
  const pcr = totalCEOi > 0 ? totalPEOi / totalCEOi : 1;
  let pcrSignal = "HOLD";
  let pcrReason = "";
  if (pcr > 1.3) {
    pcrSignal = "BUY";
    pcrReason = `PCR ${fmt(pcr, 2)} — excessively high (put OI dominates), contrarian bullish signal`;
  } else if (pcr < 0.7) {
    pcrSignal = "SELL";
    pcrReason = `PCR ${fmt(pcr, 2)} — excessively low (call OI dominates), contrarian bearish signal`;
  } else if (pcr > 1.1) {
    pcrSignal = "BUY";
    pcrReason = `PCR ${fmt(pcr, 2)} — elevated, leaning bullish (contrarian)`;
  } else if (pcr < 0.9) {
    pcrSignal = "SELL";
    pcrReason = `PCR ${fmt(pcr, 2)} — depressed, leaning bearish (contrarian)`;
  } else {
    pcrReason = `PCR ${fmt(pcr, 2)} — neutral range`;
  }

  // 4. IV Skew - compare ATM put vs call IV
  const atmIdx = Math.floor(strikes.length / 2);
  const atmRow = strikes[atmIdx];
  const nearAtm = strikes.filter(s => !s.ceIV || !s.peIV);
  const callIV = atmRow?.ce?.iv || 0;
  const putIV = atmRow?.pe?.iv || 0;
  const ivSkew = putIV - callIV;
  let ivSkewSignal = "HOLD";
  let ivSkewReason = "";
  if (ivSkew > 3) {
    ivSkewSignal = "SELL";
    ivSkewReason = `Put IV (${putIV}%) > Call IV (${callIV}%) by ${fmt(ivSkew, 1)}% — fear premium elevated, bearish skew`;
  } else if (ivSkew < -3) {
    ivSkewSignal = "BUY";
    ivSkewReason = `Call IV (${callIV}%) > Put IV (${putIV}%) by ${fmt(Math.abs(ivSkew), 1)}% — call premium elevated, bullish skew`;
  } else if (ivSkew > 1.5) {
    ivSkewSignal = "SELL";
    ivSkewReason = `Put IV ${fmt(ivSkew, 1)}% higher — slight bearish skew`;
  } else if (ivSkew < -1.5) {
    ivSkewSignal = "BUY";
    ivSkewReason = `Call IV ${fmt(Math.abs(ivSkew), 1)}% higher — slight bullish skew`;
  } else {
    ivSkewReason = `Put/Call IV balanced (${fmt(ivSkew, 1)}% skew) — neutral`;
  }

  // 5. Gann Square of Nine
  const gann = gannSignal(spot, hist, chgVal);
  let gannSignalFinal = "HOLD";
  let gannReason = "";
  if (gann.dir === "LONG") {
    gannSignalFinal = "BUY";
    gannReason = `Gann Square of Nine signals BUY (score ${gann.score}/4). Nearest level: ${fmt(gann.nearest, 0)} (${gann.distPct}% away)`;
  } else if (gann.dir === "SHORT") {
    gannSignalFinal = "SELL";
    gannReason = `Gann Square of Nine signals SELL (score ${gann.score}/4). Nearest level: ${fmt(gann.nearest, 0)} (${gann.distPct}% away)`;
  } else {
    gannReason = `Gann Square of Nine: WAIT (score ${gann.score}/4). Support: ${fmt(gann.below, 0)}, Resistance: ${fmt(gann.above, 0)}`;
  }

  const allSignals = [
    { name: "OI Buildup", dir: oiBuildupSignal, reason: oiBuildupReason },
    { name: "Max Pain", dir: maxPainSignal, reason: maxPainReason },
    { name: "Put-Call Ratio", dir: pcrSignal, reason: pcrReason },
    { name: "IV Skew", dir: ivSkewSignal, reason: ivSkewReason },
    { name: "Gann Square", dir: gannSignalFinal, reason: gannReason },
  ];

  // Verdict: >70% agreement (4 out of 5)
  const buyCount = allSignals.filter(s => s.dir === "BUY").length;
  const sellCount = allSignals.filter(s => s.dir === "SELL").length;
  const holdCount = allSignals.filter(s => s.dir === "HOLD").length;
  const threshold = 4;
  let verdict = "HOLD";
  if (buyCount >= threshold) verdict = "BUY";
  else if (sellCount >= threshold) verdict = "SELL";

  return {
    signals: allSignals,
    verdict,
    buyCount, sellCount, holdCount,
    spot,
    maxPainStrike,
    pcr: fmt(pcr, 2),
    ivSkew: fmt(ivSkew, 1),
    gannScore: gann.score,
    gannDir: gann.dir,
    totalCEOiChg, totalPEOiChg, totalCEOi, totalPEOi,
  };
};

const SignalBadge = ({ dir, S }) => {
  const color = dir === "BUY" ? S.green : dir === "SELL" ? S.red : S.amber;
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", borderRadius: 3,
      fontSize: 9, fontWeight: 700,
      background: color + "18", color, border: `1px solid ${color}44`,
    }}>
      {dir}
    </span>
  );
};

export default function FnoVerdictTab({ prices, hist, S, toast_ }) {
  const expiries = useMemo(() => getExpiries(4), []);
  const [chainMap, setChainMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState(null);

  const fetchKey = (inst, exp) => `${inst.key}_${exp.date.getTime()}`;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const results = {};
    const fetches = [];
    for (const inst of INSTRUMENTS) {
      for (const exp of expiries) {
        const key = fetchKey(inst, exp);
        const days = exp.daysToExpiry;
        const p = fetch(`/api/nse/option-chain/${inst.key}?expiryDays=${days}`)
          .then(r => r.json())
          .then(data => { if (!data.error) results[key] = data; })
          .catch(() => {});
        fetches.push(p);
      }
    }
    await Promise.all(fetches);
    setChainMap(results);
    setLoading(false);
  }, [expiries]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const verdictGrid = useMemo(() => {
    const grid = [];
    for (const inst of INSTRUMENTS) {
      const row = { inst, cells: [] };
      for (const exp of expiries) {
        const key = fetchKey(inst, exp);
        const chain = chainMap[key];
        if (!chain) {
          row.cells.push({ exp, loading: true, signals: null, verdict: null });
          continue;
        }
        const spot = chain.spot;
        const chgVal = chain.change || 0;
        const histArr = hist?.[inst.assetSym] || (prices?.[inst.assetSym]?.usd ? [prices[inst.assetSym].usd] : []);
        const result = computeSignals(chain, spot, histArr, chgVal);
        row.cells.push({ exp, loading: false, ...result });
      }
      grid.push(row);
    }
    return grid;
  }, [chainMap, expiries, hist, prices, fetchKey]);

  const getVerdictColor = (verdict) => {
    if (verdict === "BUY") return S.green;
    if (verdict === "SELL") return S.red;
    return S.amber;
  };

  return (
    <div className="fin" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{
        background: S.card, border: `1px solid ${S.border}`, borderRadius: 8,
        padding: "14px 18px", marginBottom: 14,
        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: S.bright }}>F&O Verdict</div>
        <div style={{ fontSize: 10, color: S.dim }}>
          F&O-specific signals per expiry | Verdict requires &ge;4/5 signals agreeing
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={fetchAll} style={{
          padding: "5px 12px", fontSize: 10, fontWeight: 600,
          background: S.blue + "18", border: `1px solid ${S.blue}44`,
          borderRadius: 4, color: S.blue, cursor: "pointer",
        }}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Grid */}
      <div style={{
        background: S.card, border: `1px solid ${S.border}`, borderRadius: 8,
        overflow: "hidden",
      }}>
        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `140px repeat(${expiries.length}, 1fr)`,
          borderBottom: `1px solid ${S.border}`,
        }}>
          <div style={{ padding: "10px 12px", fontSize: 10, color: S.dim, fontWeight: 600 }}>
            Instrument
          </div>
          {expiries.map((exp, i) => (
            <div key={i} style={{
              padding: "10px 6px", textAlign: "center", fontSize: 10, color: S.dim, fontWeight: 600,
              borderLeft: `1px solid ${S.border}`,
            }}>
              {exp.label.split(" ").slice(0, 2).join(" ")}
              <div style={{ fontSize: 8, color: S.dim }}>{exp.daysToExpiry}d</div>
            </div>
          ))}
        </div>

        {/* Body rows */}
        {verdictGrid.map((row, ri) => (
          <div key={row.inst.key} style={{
            display: "grid",
            gridTemplateColumns: `140px repeat(${expiries.length}, 1fr)`,
            borderBottom: ri < verdictGrid.length - 1 ? `1px solid ${S.border}` : "none",
          }}>
            {/* Instrument label */}
            <div style={{
              padding: "12px", display: "flex", alignItems: "center", gap: 8,
              background: ri % 2 === 0 ? S.bg : "transparent",
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.inst.color }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: row.inst.color }}>{row.inst.key}</div>
                <div style={{ fontSize: 9, color: S.dim }}>{row.inst.name}</div>
              </div>
            </div>

            {/* Cells */}
            {row.cells.map((cell, ci) => {
              const vColor = cell.verdict ? getVerdictColor(cell.verdict) : S.dim;
              const isSelected = selectedCell?.instKey === row.inst.key && selectedCell?.expTs === cell.exp.date.getTime();
              return (
                <div
                  key={ci}
                  onClick={() => {
                    if (!cell.loading && cell.signals) {
                      setSelectedCell(isSelected ? null : {
                        instKey: row.inst.key,
                        inst: row.inst,
                        exp: cell.exp,
                        ...cell,
                      });
                    }
                  }}
                  style={{
                    padding: "10px 6px", textAlign: "center",
                    borderLeft: `1px solid ${S.border}`,
                    background: isSelected
                      ? vColor + "18"
                      : ri % 2 === 0 ? S.bg : "transparent",
                    cursor: cell.loading ? "default" : "pointer",
                    transition: "all 0.15s",
                    position: "relative",
                  }}
                >
                  {cell.loading ? (
                    <div style={{ fontSize: 9, color: S.dim }}>Loading...</div>
                  ) : cell.signals ? (
                    <>
                      <div style={{
                        fontSize: 13, fontWeight: 700, color: vColor,
                        padding: "3px 0", ...mono,
                      }}>
                        {cell.verdict}
                      </div>
                      <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 4 }}>
                        {cell.buyCount > 0 && (
                          <span style={{ fontSize: 8, color: S.green, ...mono }}>{cell.buyCount}B</span>
                        )}
                        {cell.sellCount > 0 && (
                          <span style={{ fontSize: 8, color: S.red, ...mono }}>{cell.sellCount}S</span>
                        )}
                        {cell.holdCount > 0 && (
                          <span style={{ fontSize: 8, color: S.amber, ...mono }}>{cell.holdCount}H</span>
                        )}
                      </div>
                      <div style={{
                        height: 2, borderRadius: 1, marginTop: 6,
                        background: S.bg, overflow: "hidden", maxWidth: 80, marginLeft: "auto", marginRight: "auto",
                      }}>
                        <div style={{
                          height: "100%", borderRadius: 1,
                          width: `${(cell.buyCount / 5) * 100}%`,
                          background: cell.verdict === "BUY" ? S.green : cell.verdict === "SELL" ? S.red : S.amber,
                          transition: "width 0.3s",
                        }} />
                      </div>
                      <div style={{ fontSize: 8, color: S.dim, marginTop: 3, ...mono }}>
                        {fmt(cell.spot, 0)}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 9, color: S.dim }}>No data</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {selectedCell && selectedCell.signals && (
        <div style={{
          marginTop: 14,
          background: S.card, border: `1px solid ${S.border}`, borderRadius: 8,
          padding: 16, overflow: "hidden",
        }}>
          {/* Detail header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
            paddingBottom: 12, borderBottom: `1px solid ${S.border}`,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: selectedCell.inst.color }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: selectedCell.inst.color }}>
              {selectedCell.inst.key}
            </span>
            <span style={{ fontSize: 11, color: S.dim }}>
              {selectedCell.exp.label} ({selectedCell.exp.daysToExpiry}d to expiry)
            </span>
            <div style={{ flex: 1 }} />
            <div style={{
              padding: "4px 14px", borderRadius: 4,
              background: getVerdictColor(selectedCell.verdict) + "20",
              border: `1px solid ${getVerdictColor(selectedCell.verdict)}55`,
              fontSize: 14, fontWeight: 700, color: getVerdictColor(selectedCell.verdict),
            }}>
              {selectedCell.verdict}
            </div>
            <button onClick={() => setSelectedCell(null)} style={{
              background: "none", border: "none", color: S.dim, fontSize: 16,
              cursor: "pointer", padding: "2px 6px", lineHeight: 1,
            }}>
              x
            </button>
          </div>

          {/* Spot & key metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Spot", value: fmt(selectedCell.spot, 0), color: S.bright },
              { label: "Max Pain", value: fmt(selectedCell.maxPainStrike, 0), color: S.amber },
              { label: "PCR (OI)", value: selectedCell.pcr, color: selectedCell.pcr > 1.1 ? S.green : selectedCell.pcr < 0.9 ? S.red : S.amber },
              { label: "IV Skew", value: `${selectedCell.ivSkew}%`, color: selectedCell.ivSkew > 1.5 ? S.red : selectedCell.ivSkew < -1.5 ? S.green : S.amber },
              { label: "Gann Score", value: `${selectedCell.gannScore}/4`, color: selectedCell.gannDir === "LONG" ? S.green : selectedCell.gannDir === "SHORT" ? S.red : S.amber },
              { label: "Vote", value: `${selectedCell.buyCount}B / ${selectedCell.sellCount}S / ${selectedCell.holdCount}H`, color: S.text },
            ].map(m => (
              <div key={m.label} style={{ background: S.bg, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: S.dim, marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: m.color, ...mono }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Signal breakdown */}
          <div style={{ fontSize: 11, fontWeight: 700, color: S.bright, marginBottom: 8 }}>
            Signal Breakdown
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {selectedCell.signals.map((sig, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "8px 10px", background: S.bg, borderRadius: 6,
                border: `1px solid ${S.border}`,
              }}>
                <div style={{ minWidth: 100 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: S.text }}>{sig.name}</span>
                  <div style={{ marginTop: 2 }}>
                    <SignalBadge dir={sig.dir} S={S} />
                  </div>
                </div>
                <div style={{ fontSize: 10, color: S.mid, lineHeight: 1.5, flex: 1 }}>
                  {sig.reason}
                </div>
              </div>
            ))}
          </div>

          {/* Verdict summary */}
          <div style={{
            marginTop: 12, padding: "10px 12px", borderRadius: 6,
            background: getVerdictColor(selectedCell.verdict) + "0a",
            border: `1px solid ${getVerdictColor(selectedCell.verdict)}33`,
            fontSize: 11, color: S.text, lineHeight: 1.6,
          }}>
            <strong style={{ color: getVerdictColor(selectedCell.verdict) }}>
              Verdict: {selectedCell.verdict}
            </strong>
            {" — "}
            {selectedCell.verdict === "BUY" && `${selectedCell.buyCount}/5 F&O signals align BULLISH. Key drivers: OI buildup favoring Puts, Max Pain below spot, PCR elevated, bullish IV skew.`}
            {selectedCell.verdict === "SELL" && `${selectedCell.sellCount}/5 F&O signals align BEARISH. Key drivers: OI buildup favoring Calls, Max Pain above spot, PCR depressed, bearish IV skew.`}
            {selectedCell.verdict === "HOLD" && `No clear consensus (${selectedCell.buyCount}B / ${selectedCell.sellCount}S / ${selectedCell.holdCount}H). Need ≥4/5 signals agreeing for a directional verdict.`}
          </div>
        </div>
      )}
    </div>
  );
}
