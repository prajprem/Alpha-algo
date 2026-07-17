import { useState, useMemo } from "react";

/* ─── helpers ─────────────────────────────────────── */
const mono = { fontFamily: "'JetBrains Mono', monospace" };
const fmt = (v, dec = 2) =>
  v == null ? "--" : v > 9999 ? v.toLocaleString(undefined, { maximumFractionDigits: dec }) : v.toFixed(dec);
const dur = (ms) => {
  if (!ms || ms <= 0) return "--";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
};
const tsStr = (v) => {
  if (!v) return "--";
  try {
    const d = new Date(v);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "--"; }
};
const getCur = (sym, ALL) => {
  const a = (ALL || []).find((x) => x.symbol === sym);
  return a?.currency === "INR" ? "Rs " : "$";
};
const getDec = (sym, ALL) => {
  const a = (ALL || []).find((x) => x.symbol === sym);
  return a?.dec || 2;
};
const getAsset = (sym, ALL) => (ALL || []).find((x) => x.symbol === sym);
const safeParse = (v) => {
  if (!v) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return null; }
};
const AUTO_SOURCES = ["auto", "agent", "crypto-auto", "fno-auto", "crypto-agent", "fno-agent"];

/* ─── trade quality grading ──────────────────────── */
const gradeColors = { A: "#10b981", B: "#3b82f6", C: "#f59e0b", D: "#f97316", F: "#ef4444" };
const gradeTrade = (t) => {
  const pnl = t.pnl != null ? t.pnl : 0;
  const risk = t.dir === "LONG"
    ? Math.abs(t.entry - (t.sl || t.entry))
    : Math.abs((t.sl || t.entry) - t.entry);
  const reward = t.dir === "LONG"
    ? Math.abs((t.tp || t.entry) - t.entry)
    : Math.abs(t.entry - (t.tp || t.entry));
  const maxRisk = risk * (t.qty || 1);
  const maxReward = reward * (t.qty || 1);

  if (maxReward <= 0 && maxRisk <= 0) return pnl >= 0 ? "B" : "D";
  const ratio = maxRisk > 0 ? pnl / maxRisk : 0;
  if (pnl > 0 && ratio >= 0.8) return "A";
  if (pnl > 0 && ratio >= 0.3) return "B";
  if (pnl >= 0) return "C";
  if (pnl < 0 && Math.abs(pnl) < maxRisk * 0.5) return "D";
  return "F";
};

/* ─── was entry direction correct? ───────────────── */
const wasEntryCorrect = (t) => {
  if (!t.exitPrice || !t.entry) return null;
  if (t.dir === "LONG") return t.exitPrice > t.entry;
  return t.exitPrice < t.entry;
};

/* ─── compute P&L for a trade ────────────────────── */
const computePnl = (t) => {
  if (t.pnl != null) return t.pnl;
  const exit = t.exitPrice || t.entry;
  return (t.dir === "LONG" ? exit - t.entry : t.entry - exit) * (t.qty || 1) - (t.fee || 0);
};

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

/* ─── Horizontal Bar (for indicator hit-rate chart) ── */
const HBar = ({ label, wins, losses, maxVal, S }) => {
  const total = wins + losses;
  const wr = total > 0 ? (wins / total) * 100 : 0;
  const wPct = maxVal > 0 ? (wins / maxVal) * 100 : 0;
  const lPct = maxVal > 0 ? (losses / maxVal) * 100 : 0;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: S.text, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 9, color: S.dim, ...mono }}>
          {wins}W / {losses}L ({wr.toFixed(0)}%)
        </span>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: S.bg }}>
        <div
          style={{
            width: `${wPct}%`,
            background: S.green,
            borderRadius: "4px 0 0 4px",
            transition: "width 0.3s",
          }}
        />
        <div
          style={{
            width: `${lPct}%`,
            background: S.red + "99",
            borderRadius: "0 4px 4px 0",
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
};

/* ─── Condition Badge ────────────────────────────── */
const CondBadge = ({ cond, S }) => {
  const signal = (cond.signal || "").toUpperCase();
  const isBull = signal.includes("BULL") || signal.includes("UP") || signal.includes("BUY") || signal.includes("LONG");
  const isBear = signal.includes("BEAR") || signal.includes("DOWN") || signal.includes("SELL") || signal.includes("SHORT");
  const col = isBull ? S.green : isBear ? S.red : S.mid;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 9,
        padding: "2px 7px",
        borderRadius: 4,
        background: col + "15",
        border: `1px solid ${col}33`,
        color: col,
        marginRight: 4,
        marginBottom: 3,
      }}
    >
      {cond.name}: {cond.signal}
    </span>
  );
};

/* ─── Analysis Card ──────────────────────────────── */
const AnalysisCard = ({ t, ALL, S }) => {
  const [expanded, setExpanded] = useState(false);
  const asset = getAsset(t.symbol, ALL);
  const dec = getDec(t.symbol, ALL);
  const c = getCur(t.symbol, ALL);
  const pnl = computePnl(t);
  const isWin = pnl >= 0;
  const ea = safeParse(t.entryAnalysis);
  const xa = safeParse(t.exitAnalysis);
  const grade = gradeTrade(t);
  const correct = wasEntryCorrect(t);
  const duration = t.closedAt && t.openedAt
    ? new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime()
    : t.closedAt && t.id ? t.closedAt - t.id : 0;

  const accentColor = t.dir === "LONG" ? S.green : S.red;

  const reasonColors = { TP: S.green, SL: S.red, INDICATOR: S.blue, MANUAL: S.amber };
  const exitReason = xa?.reason || t.exitReason || "MANUAL";

  return (
    <div
      style={{
        background: S.card,
        border: `1px solid ${S.border}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 8,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "border-color 0.2s",
      }}
      onClick={() => setExpanded((p) => !p)}
    >
      {/* ── Header row ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
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
              background: accentColor + "18",
              color: accentColor,
              border: `1px solid ${accentColor}44`,
            }}
          >
            {t.dir}
          </span>
          {ea?.indicator && (
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
              {ea.indicator}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Grade badge */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              width: 22,
              height: 22,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: gradeColors[grade] + "20",
              color: gradeColors[grade],
              border: `1px solid ${gradeColors[grade]}44`,
              ...mono,
            }}
          >
            {grade}
          </span>
          {/* P&L */}
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: isWin ? S.green : S.red,
                ...mono,
                lineHeight: 1,
              }}
            >
              {isWin ? "+" : ""}{fmt(pnl)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Compact summary row ── */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 10, color: S.dim }}>
        <span>Entry: <span style={{ color: S.text, ...mono }}>{c}{fmt(t.entry, dec)}</span></span>
        <span>Exit: <span style={{ color: S.text, ...mono }}>{t.exitPrice ? `${c}${fmt(t.exitPrice, dec)}` : "--"}</span></span>
        <span>Duration: <span style={{ color: S.text, ...mono }}>{dur(duration)}</span></span>
        <span>
          Reason: <span style={{ color: reasonColors[exitReason] || S.mid, fontWeight: 600 }}>{exitReason}</span>
        </span>
        {ea?.confluenceCount != null && (
          <span>Confluence: <span style={{ color: S.bright, fontWeight: 600, ...mono }}>{ea.confluenceCount}</span></span>
        )}
        <span style={{ marginLeft: "auto", color: S.dim, fontSize: 9 }}>{expanded ? "[-]" : "[+]"}</span>
      </div>

      {/* ── Expanded details ── */}
      {expanded && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${S.border}`, paddingTop: 12 }}>
          {/* ─ Entry Analysis ─ */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: S.bright,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                marginBottom: 6,
              }}
            >
              Entry Analysis
            </div>
            {ea ? (
              <div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 8, fontSize: 11 }}>
                  <div>
                    <span style={{ color: S.dim, fontSize: 9 }}>Indicator</span>
                    <div style={{ color: S.bright, fontWeight: 600 }}>{ea.indicator || ea.signal?.name || "--"}</div>
                  </div>
                  {ea.signal && (
                    <>
                      <div>
                        <span style={{ color: S.dim, fontSize: 9 }}>Direction</span>
                        <div style={{ color: ea.signal.dir === "LONG" || ea.signal.dir === "BUY" ? S.green : S.red, fontWeight: 600 }}>
                          {ea.signal.dir || "--"}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: S.dim, fontSize: 9 }}>Strength</span>
                        <div style={{ ...mono, color: S.text }}>{ea.signal.strength != null ? ea.signal.strength : "--"}</div>
                      </div>
                      <div>
                        <span style={{ color: S.dim, fontSize: 9 }}>Score</span>
                        <div style={{ ...mono, color: S.amber, fontWeight: 600 }}>{ea.signal.score != null ? ea.signal.score : "--"}</div>
                      </div>
                    </>
                  )}
                  <div>
                    <span style={{ color: S.dim, fontSize: 9 }}>Timestamp</span>
                    <div style={{ color: S.mid, ...mono, fontSize: 10 }}>{tsStr(t.openedAt)}</div>
                  </div>
                </div>

                {/* Market conditions at entry */}
                {ea.conditions && ea.conditions.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9, color: S.dim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      Market Conditions at Entry
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap" }}>
                      {ea.conditions.slice(0, 6).map((cond, i) => (
                        <CondBadge key={i} cond={cond} S={S} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Confluence + sentiment */}
                <div style={{ display: "flex", gap: 14, fontSize: 10, color: S.dim }}>
                  {ea.confluenceCount != null && (
                    <span>
                      Confluence: <span style={{ color: ea.confluenceCount >= 3 ? S.green : ea.confluenceCount >= 2 ? S.amber : S.red, fontWeight: 600, ...mono }}>{ea.confluenceCount} indicators</span>
                    </span>
                  )}
                  {ea.sentimentAvg != null && (
                    <span>
                      Sentiment: <span style={{ color: ea.sentimentAvg > 0 ? S.green : ea.sentimentAvg < 0 ? S.red : S.mid, ...mono }}>{ea.sentimentAvg.toFixed(2)}</span>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: S.dim, fontStyle: "italic" }}>Analysis not available</div>
            )}
          </div>

          {/* ─ Exit Analysis ─ */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: S.bright,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                marginBottom: 6,
              }}
            >
              Exit Analysis
            </div>
            {xa ? (
              <div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 8, fontSize: 11 }}>
                  <div>
                    <span style={{ color: S.dim, fontSize: 9 }}>Reason</span>
                    <div style={{ color: reasonColors[xa.reason] || S.mid, fontWeight: 700 }}>{xa.reason || exitReason}</div>
                  </div>
                  <div>
                    <span style={{ color: S.dim, fontSize: 9 }}>Exit Indicator</span>
                    <div style={{ color: S.bright, fontWeight: 600 }}>{xa.indicator || xa.signal?.name || "--"}</div>
                  </div>
                  {xa.signal && (
                    <>
                      <div>
                        <span style={{ color: S.dim, fontSize: 9 }}>Direction</span>
                        <div style={{ color: xa.signal.dir === "LONG" || xa.signal.dir === "BUY" ? S.green : S.red, fontWeight: 600 }}>
                          {xa.signal.dir || "--"}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: S.dim, fontSize: 9 }}>Score</span>
                        <div style={{ ...mono, color: S.amber, fontWeight: 600 }}>{xa.signal.score != null ? xa.signal.score : "--"}</div>
                      </div>
                    </>
                  )}
                  <div>
                    <span style={{ color: S.dim, fontSize: 9 }}>Exit Price</span>
                    <div style={{ ...mono, color: S.text }}>{t.exitPrice ? `${c}${fmt(t.exitPrice, dec)}` : "--"}</div>
                  </div>
                  <div>
                    <span style={{ color: S.dim, fontSize: 9 }}>Timestamp</span>
                    <div style={{ color: S.mid, ...mono, fontSize: 10 }}>{tsStr(t.closedAt)}</div>
                  </div>
                </div>

                {xa.conditions && xa.conditions.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, color: S.dim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      Conditions at Exit
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap" }}>
                      {xa.conditions.slice(0, 6).map((cond, i) => (
                        <CondBadge key={i} cond={cond} S={S} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: S.dim, fontStyle: "italic" }}>Analysis not available</div>
            )}
          </div>

          {/* ─ Verdict ─ */}
          <div
            style={{
              background: S.bg,
              borderRadius: 6,
              padding: "10px 14px",
              border: `1px solid ${S.border}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: S.bright,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                marginBottom: 6,
              }}
            >
              Verdict
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 11 }}>
              <div>
                <span style={{ color: S.dim, fontSize: 9 }}>Entry Correct?</span>
                <div
                  style={{
                    fontWeight: 700,
                    color: correct === null ? S.dim : correct ? S.green : S.red,
                  }}
                >
                  {correct === null ? "--" : correct ? "YES - price moved in predicted direction" : "NO - price moved against entry"}
                </div>
              </div>
              <div>
                <span style={{ color: S.dim, fontSize: 9 }}>Trade Quality</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: gradeColors[grade],
                      ...mono,
                    }}
                  >
                    {grade}
                  </span>
                  <span style={{ fontSize: 9, color: S.dim }}>
                    {grade === "A" ? "Excellent" : grade === "B" ? "Good" : grade === "C" ? "Acceptable" : grade === "D" ? "Poor" : "Failed"}
                  </span>
                </div>
              </div>
              <div>
                <span style={{ color: S.dim, fontSize: 9 }}>P&L</span>
                <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: isWin ? S.green : S.red }}>
                  {isWin ? "+" : ""}{fmt(pnl)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ANALYSIS TAB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function AnalysisTab({ trades, prices, indicators, ALL, S, toast_ }) {
  const [sortIndicator, setSortIndicator] = useState("uses");

  /* ── Filter to auto/agent trades only ── */
  const autoTrades = useMemo(
    () =>
      (trades || []).filter((t) => AUTO_SOURCES.includes(t.src)),
    [trades]
  );

  const analysisTrades = useMemo(
    () => autoTrades
      .filter((t) => t.entryAnalysis || t.exitAnalysis || t.status === "OPEN")
      .sort((a, b) => (b.closedAt || b.openedAt || b.id || 0) - (a.closedAt || a.openedAt || a.id || 0)),
    [autoTrades]
  );

  const closedAuto = useMemo(
    () =>
      autoTrades
        .filter((t) => t.status !== "OPEN" && (t.exitPrice || t.closedAt))
        .sort((a, b) => (b.closedAt || b.id || 0) - (a.closedAt || a.id || 0)),
    [autoTrades]
  );

  /* ── Summary stats ── */
  const stats = useMemo(() => {
    const pnls = closedAuto.map(computePnl);
    const wins = pnls.filter((p) => p > 0);
    const losses = pnls.filter((p) => p <= 0);
    const total = pnls.length;
    const winRate = total > 0 ? (wins.length / total) * 100 : 0;
    const avgPnl = total > 0 ? pnls.reduce((a, b) => a + b, 0) / total : 0;
    const best = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worst = pnls.length > 0 ? Math.min(...pnls) : 0;
    return { total, winRate, avgPnl, best, worst, wins: wins.length, losses: losses.length };
  }, [closedAuto]);

  /* ── Indicator hit rate data ── */
  const indicatorHits = useMemo(() => {
    const map = {};
    closedAuto.forEach((t) => {
      const ea = safeParse(t.entryAnalysis);
      const indName = ea?.indicator || t.indicator || "Unknown";
      if (!map[indName]) map[indName] = { wins: 0, losses: 0 };
      const pnl = computePnl(t);
      if (pnl > 0) map[indName].wins++;
      else map[indName].losses++;
    });
    const arr = Object.entries(map)
      .map(([name, v]) => ({ name, ...v, total: v.wins + v.losses }))
      .sort((a, b) => b.total - a.total);
    return arr;
  }, [closedAuto]);

  const maxHitVal = useMemo(
    () => Math.max(1, ...indicatorHits.map((h) => Math.max(h.wins, h.losses))),
    [indicatorHits]
  );

  /* ── Indicator performance table data ── */
  const indicatorPerf = useMemo(() => {
    const entryMap = {};
    const exitMap = {};
    closedAuto.forEach((t) => {
      const pnl = computePnl(t);
      const ea = safeParse(t.entryAnalysis);
      const xa = safeParse(t.exitAnalysis);
      const entryInd = ea?.indicator || t.indicator || null;
      const exitInd = xa?.indicator || t.exitIndicator || null;

      if (entryInd) {
        if (!entryMap[entryInd]) entryMap[entryInd] = { uses: 0, wins: 0, totalPnl: 0, bestPnl: -Infinity, bestSignal: null };
        entryMap[entryInd].uses++;
        if (pnl > 0) entryMap[entryInd].wins++;
        entryMap[entryInd].totalPnl += pnl;
        if (pnl > entryMap[entryInd].bestPnl) {
          entryMap[entryInd].bestPnl = pnl;
          entryMap[entryInd].bestSignal = ea?.signal?.name || ea?.signal?.dir || entryInd;
        }
      }
      if (exitInd) {
        if (!exitMap[exitInd]) exitMap[exitInd] = { uses: 0 };
        exitMap[exitInd].uses++;
      }
    });

    const allIndicators = new Set([...Object.keys(entryMap), ...Object.keys(exitMap)]);
    const arr = [];
    allIndicators.forEach((name) => {
      const e = entryMap[name] || { uses: 0, wins: 0, totalPnl: 0, bestPnl: -Infinity, bestSignal: null };
      const x = exitMap[name] || { uses: 0 };
      const totalUses = e.uses + x.uses;
      const winRate = e.uses > 0 ? (e.wins / e.uses) * 100 : 0;
      const avgPnl = e.uses > 0 ? e.totalPnl / e.uses : 0;
      arr.push({
        name,
        entryUses: e.uses,
        exitUses: x.uses,
        totalUses,
        winRate,
        avgPnl,
        bestSignal: e.bestPnl > -Infinity ? e.bestSignal : "--",
      });
    });

    if (sortIndicator === "winRate") arr.sort((a, b) => b.winRate - a.winRate);
    else if (sortIndicator === "avgPnl") arr.sort((a, b) => b.avgPnl - a.avgPnl);
    else arr.sort((a, b) => b.totalUses - a.totalUses);

    return arr;
  }, [closedAuto, sortIndicator]);

  /* ── Styles ── */
  const cardStyle = {
    background: S.card,
    border: `1px solid ${S.border}`,
    borderRadius: 8,
    padding: "14px 16px",
    marginBottom: 16,
  };

  const statCell = {
    background: S.bg,
    borderRadius: 6,
    padding: "10px 14px",
    border: `1px solid ${S.border}`,
    flex: "1 1 110px",
  };

  const thStyle = (col) => ({
    padding: "8px 10px",
    textAlign: "left",
    fontSize: 10,
    color: sortIndicator === col ? S.bright : S.dim,
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

      {/* ════════════════════════════════════════════════
         SECTION 1: Summary Stats Bar
         ════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <SectionHead title="Trade Analysis Summary" count={stats.total} color={S.blue} S={S} />

        {/* Stats row */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          {[
            ["Total Auto Trades", stats.total, S.bright],
            ["Win Rate", `${stats.winRate.toFixed(1)}%`, stats.winRate >= 50 ? S.green : S.red],
            ["Avg P&L", fmt(stats.avgPnl), stats.avgPnl >= 0 ? S.green : S.red],
            ["Best Trade", `+${fmt(stats.best)}`, S.green],
            ["Worst Trade", fmt(stats.worst), S.red],
          ].map(([label, val, color]) => (
            <div key={label} style={statCell}>
              <div style={{ fontSize: 9, color: S.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                {label}
              </div>
              <div style={{ ...mono, fontSize: 15, fontWeight: 700, color }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Indicator hit rate horizontal bars */}
        {indicatorHits.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: S.text, marginBottom: 8 }}>
              Indicator Hit Rate
            </div>
            {indicatorHits.slice(0, 8).map((h) => (
              <HBar key={h.name} label={h.name} wins={h.wins} losses={h.losses} maxVal={maxHitVal} S={S} />
            ))}
          </div>
        )}

        {stats.total === 0 && (
          <div style={{ textAlign: "center", padding: "16px 0", color: S.dim, fontSize: 12 }}>
            No AI-gated auto trades to analyze yet. Trades placed after indicator screening and AI approval will appear here.
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════
         SECTION 2: Trade Analysis Cards
         ════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <SectionHead
          title="Trade Analysis"
          count={analysisTrades.length}
          color={S.purple}
          S={S}
        />

        {analysisTrades.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: S.dim, fontSize: 12 }}>
            No trading analysis available yet. Open AI-gated positions and closed trades will appear here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {analysisTrades.slice(0, 50).map((t) => (
              <AnalysisCard key={t.id} t={t} ALL={ALL} S={S} />
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════
         SECTION 3: Indicator Performance Table
         ════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <SectionHead title="Indicator Performance" count={indicatorPerf.length} color={S.amber} S={S} />

        {indicatorPerf.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: S.dim, fontSize: 12 }}>
            No indicator data available yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 660 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle("name"), cursor: "default" }}>Indicator</th>
                  <th style={thStyle("uses")} onClick={() => setSortIndicator("uses")}>
                    Entry Uses{sortIndicator === "uses" ? " v" : ""}
                  </th>
                  <th style={{ ...thStyle("exitUses"), cursor: "default" }}>Exit Uses</th>
                  <th style={thStyle("winRate")} onClick={() => setSortIndicator("winRate")}>
                    Win Rate{sortIndicator === "winRate" ? " v" : ""}
                  </th>
                  <th style={thStyle("avgPnl")} onClick={() => setSortIndicator("avgPnl")}>
                    Avg P&L{sortIndicator === "avgPnl" ? " v" : ""}
                  </th>
                  <th style={{ ...thStyle("bestSignal"), cursor: "default" }}>Best Signal</th>
                </tr>
              </thead>
              <tbody>
                {indicatorPerf.map((row) => {
                  const wrColor = row.winRate > 60 ? S.green : row.winRate >= 40 ? S.amber : S.red;
                  return (
                    <tr key={row.name} style={{ borderBottom: `1px solid ${S.border}22` }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: S.bright, fontSize: 11 }}>
                        {row.name}
                      </td>
                      <td style={{ padding: "8px 10px", ...mono, color: S.text }}>{row.entryUses}</td>
                      <td style={{ padding: "8px 10px", ...mono, color: S.text }}>{row.exitUses}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span
                          style={{
                            ...mono,
                            fontWeight: 700,
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: wrColor + "15",
                            color: wrColor,
                          }}
                        >
                          {row.winRate.toFixed(0)}%
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          ...mono,
                          fontWeight: 600,
                          color: row.avgPnl >= 0 ? S.green : S.red,
                        }}
                      >
                        {row.avgPnl >= 0 ? "+" : ""}{fmt(row.avgPnl)}
                      </td>
                      <td style={{ padding: "8px 10px", color: S.mid, fontSize: 10 }}>{row.bestSignal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
