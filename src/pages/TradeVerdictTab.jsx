import React, { useState, useMemo, useCallback, useEffect } from "react";
import { runFullVerdict } from "../VerdictEngine";
import { isOpen } from "../constants";

const mono = { fontFamily: "'JetBrains Mono', monospace" };
const labelStyle = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 };

const Spinner = ({ S }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 20, justifyContent: 'center' }}>
    <div style={{
      width: 16, height: 16, border: `2px solid ${S.border}`,
      borderTop: `2px solid ${S.green}`, borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    }} />
    <span style={{ fontSize: 11, color: S.dim }}>Running analysis...</span>
  </div>
);

const SectionBlock = ({ num, title, children, S }) => (
  <div style={{ padding: '12px 14px', borderBottom: `1px solid ${S.border}` }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: S.bright, marginBottom: 8 }}>
      Section {num} — {title}
    </div>
    {children}
  </div>
);

const Row = ({ label, value, color, S }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
    <span style={{ color: S.dim }}>{label}</span>
    <span style={{ color: color || S.text, ...mono, fontWeight: 600 }}>{value ?? 'N/A'}</span>
  </div>
);

const getColorForTrend = (trend, S) => {
  if (!trend) return S.dim;
  const t = trend.toString().toLowerCase();
  if (t.includes('bull') || t.includes('up') || t.includes('buy') || t.includes('long')) return S.green;
  if (t.includes('bear') || t.includes('down') || t.includes('sell') || t.includes('short')) return S.red;
  return S.amber;
};

// --- SECTION RENDERERS ---

// S1 — Price Data (OHLCV)
const RenderS1 = ({ data, S }) => (
  <SectionBlock num={1} title="Price Data (OHLCV)" S={S}>
    {data ? (
      <>
        <Row label="Open" value={typeof data.open === 'number' ? data.open.toFixed(2) : data.open} S={S} />
        <Row label="High" value={typeof data.high === 'number' ? data.high.toFixed(2) : data.high} S={S} />
        <Row label="Low" value={typeof data.low === 'number' ? data.low.toFixed(2) : data.low} S={S} />
        <Row label="Close" value={typeof data.close === 'number' ? data.close.toFixed(2) : data.close} S={S} />
        <Row label="Volume" value={data.volume && typeof data.volume === 'number' ? data.volume.toFixed(2) : data.volume} S={S} />
        <Row label="Timeframe" value={data.timeframe} S={S} />
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S2 — Market Structure
const RenderS2 = ({ data, S }) => (
  <SectionBlock num={2} title="Market Structure" S={S}>
    {data ? (
      <>
        <Row label="Current Trend" value={data.trend} color={getColorForTrend(data.trend, S)} S={S} />
        <Row label="Higher Highs" value={data.higherHighs ? 'Yes' : 'No'} color={data.higherHighs ? S.green : S.red} S={S} />
        <Row label="Lower Lows" value={data.lowerLows ? 'Yes' : 'No'} color={data.lowerLows ? S.red : S.green} S={S} />
        <Row label="Market Phase" value={data.phase} color={S.bright} S={S} />
        <Row label="Swing Labels" value={(data.swingLabels || []).join(', ')} S={S} />
        <Row label="BOS" value={`${data.bos?.type} @ ${data.bos?.price?.toFixed(2) || 'N/A'}`} color={data.bos?.type?.includes('Bullish') ? S.green : data.bos?.type?.includes('Bearish') ? S.red : S.dim} S={S} />
        <Row label="CHOCH" value={`${data.choch?.type} @ ${data.choch?.price?.toFixed(2) || 'N/A'}`} color={data.choch?.type?.includes('Bullish') ? S.green : data.choch?.type?.includes('Bearish') ? S.red : S.dim} S={S} />
        <Row label="Trend Strength" value={data.trendStrength} S={S} />
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S3 — Trend Direction
const RenderS3 = ({ data, S }) => (
  <SectionBlock num={3} title="Trend Direction" S={S}>
    {data && data.methods ? (
      <>
        <div style={{ fontSize: 10, color: S.dim, marginBottom: 4 }}>Methods:</div>
        {data.methods.map((m, i) => (
          <Row key={i} label={m.name} value={m.signal} color={getColorForTrend(m.signal, S)} S={S} />
        ))}
        <div style={{ borderTop: `1px solid ${S.border}`, margin: '4px 0' }} />
        <Row label="Bullish Votes" value={data.bullishVotes} color={S.green} S={S} />
        <Row label="Bearish Votes" value={data.bearishVotes} color={S.red} S={S} />
        <Row label="VERDICT" value={data.verdict} color={getColorForTrend(data.verdict, S)} S={S} />
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S4 — Support & Resistance
const RenderS4 = ({ data, S }) => (
  <SectionBlock num={4} title="Support & Resistance" S={S}>
    {data && data.levels && data.levels.length > 0 ? (
      <>
        {data.levels.map((lvl, i) => (
          <Row key={i} label={`${lvl.label} (${lvl.type})`} value={lvl.price?.toFixed(2)} color={lvl.type === 'Support' ? S.green : lvl.type === 'Resistance' ? S.red : S.amber} S={S} />
        ))}
        {data.nearest && <Row label="Nearest" value={data.nearest} color={S.bright} S={S} />}
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S5 — Volume Analysis
const RenderS5 = ({ data, S }) => (
  <SectionBlock num={5} title="Volume Analysis" S={S}>
    {data ? (
      <>
        <Row label="Relative Volume" value={data.relativeVolume?.toFixed(2)} S={S} />
        <Row label="Volume Spike" value={data.isSpike ? 'Yes' : 'No'} color={data.isSpike ? S.amber : S.dim} S={S} />
        <Row label="Average Volume" value={data.avgVolume?.toFixed(0)} S={S} />
        <Row label="OBV" value={data.obv?.toFixed(0)} S={S} />
        <Row label="MFI (14)" value={data.mfi?.toFixed(2)} color={data.mfi > 80 ? S.red : data.mfi < 20 ? S.green : S.amber} S={S} />
        <Row label="CMF (20)" value={data.cmf?.toFixed(4)} color={data.cmf > 0 ? S.green : data.cmf < 0 ? S.red : S.dim} S={S} />
        <Row label="A/D Line" value={data.adLine?.toFixed(0)} S={S} />
        <Row label="Volume Delta" value={data.volumeDelta} S={S} />
        <Row label="CVD" value={data.cvd} S={S} />
        <Row label="Volume Trend" value={data.trend} color={getColorForTrend(data.trend, S)} S={S} />
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S6 — Momentum
const RenderS6 = ({ data, S }) => (
  <SectionBlock num={6} title="Momentum Indicators" S={S}>
    {data ? (
      <>
        <Row label="RSI (14)" value={data.rsi?.toFixed(2)} color={data.rsi > 70 ? S.red : data.rsi < 30 ? S.green : S.amber} S={S} />
        <Row label={`RSI State: ${data.rsiLabel}`} value={data.rsiLabel} color={data.rsiLabel === 'Overbought' ? S.red : data.rsiLabel === 'Oversold' ? S.green : S.amber} S={S} />
        <Row label="MACD Line" value={data.macd?.toFixed(4)} S={S} />
        <Row label="MACD Signal" value={data.macdSignal?.toFixed(4)} S={S} />
        <Row label="MACD Hist" value={data.macdHist?.toFixed(4)} color={data.macdHist > 0 ? S.green : S.red} S={S} />
        <Row label="Stochastic K" value={data.stochK?.toFixed(2)} S={S} />
        <Row label="Stochastic D" value={data.stochD?.toFixed(2)} S={S} />
        <Row label="Momentum (10)" value={`${data.momentum?.value?.toFixed(2)} (${data.momentum?.label})`} color={getColorForTrend(data.momentum?.label, S)} S={S} />
        <Row label="ROC (10)" value={`${data.roc?.value?.toFixed(2)}% (${data.roc?.label})`} color={getColorForTrend(data.roc?.label, S)} S={S} />
        <Row label="CCI (20)" value={`${data.cci?.value?.toFixed(2)} (${data.cci?.label})`} color={data.cci?.label === 'Overbought' ? S.red : data.cci?.label === 'Oversold' ? S.green : S.amber} S={S} />
        <Row label="Williams %R" value={`${data.williamsR?.value?.toFixed(2)} (${data.williamsR?.label})`} color={data.williamsR?.label === 'Overbought' ? S.red : data.williamsR?.label === 'Oversold' ? S.green : S.amber} S={S} />
        <Row label="Ultimate Osc" value={`${data.ultimateOsc?.value?.toFixed(2)} (${data.ultimateOsc?.label})`} color={data.ultimateOsc?.label === 'Overbought' ? S.red : data.ultimateOsc?.label === 'Oversold' ? S.green : S.amber} S={S} />
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S7 — Volatility
const RenderS7 = ({ data, S }) => (
  <SectionBlock num={7} title="Volatility" S={S}>
    {data ? (
      <>
        <Row label="ATR (14)" value={data.atr?.toFixed(2)} S={S} />
        <Row label="ATR %" value={`${data.atrPct?.toFixed(2)}%`} S={S} />
        <Row label="BB Upper" value={data.bbUpper?.toFixed(2)} S={S} />
        <Row label="BB Middle" value={data.bbMiddle?.toFixed(2)} S={S} />
        <Row label="BB Lower" value={data.bbLower?.toFixed(2)} S={S} />
        <Row label="%B" value={data.pctB?.toFixed(2)} S={S} />
        <Row label="Bandwidth" value={data.bandwidth?.toFixed(2)} S={S} />
        <Row label="Keltner Upper" value={data.keltner?.upper?.toFixed(2)} S={S} />
        <Row label="Keltner Lower" value={data.keltner?.lower?.toFixed(2)} S={S} />
        <Row label="Donchian Upper" value={data.donchian?.upper?.toFixed(2)} S={S} />
        <Row label="Donchian Lower" value={data.donchian?.lower?.toFixed(2)} S={S} />
        <Row label="Std Dev (20)" value={data.stdDev?.toFixed(2)} S={S} />
        <Row label="Hist Vol (20)" value={data.histVol?.toFixed(2)} S={S} />
        <Row label="Choppiness" value={`${data.choppiness?.value?.toFixed(1)} (${data.choppiness?.label})`} color={data.choppiness?.label === 'Choppy' ? S.red : data.choppiness?.label === 'Trending' ? S.green : S.amber} S={S} />
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S8 — Trend Indicators
const RenderS8 = ({ data, S }) => (
  <SectionBlock num={8} title="Trend Indicators" S={S}>
    {data ? (
      <>
        <Row label="Overall Trend" value={data.trend} color={getColorForTrend(data.trend, S)} S={S} />
        <Row label="SMA 20" value={data.sma20?.toFixed(2)} S={S} />
        <Row label="SMA 50" value={data.sma50?.toFixed(2)} S={S} />
        <Row label="SMA 200" value={data.sma200?.toFixed(2)} S={S} />
        <Row label="EMA 9" value={data.ema9?.toFixed(2)} S={S} />
        <Row label="EMA 21" value={data.ema21?.toFixed(2)} S={S} />
        <Row label="HMA (20)" value={`${data.hma?.value?.toFixed(2)} (${data.hma?.signal})`} color={getColorForTrend(data.hma?.signal, S)} S={S} />
        <Row label="VWMA (20)" value={`${data.vwma?.value?.toFixed(2)} (${data.vwma?.signal})`} color={getColorForTrend(data.vwma?.signal, S)} S={S} />
        <Row label="SuperTrend" value={`${data.superTrend?.direction} @ ${data.superTrend?.value?.toFixed(2)}`} color={getColorForTrend(data.superTrend?.direction, S)} S={S} />
        <Row label="Parabolic SAR" value={`${data.psar?.direction} @ ${data.psar?.value?.toFixed(2)}`} color={getColorForTrend(data.psar?.direction, S)} S={S} />
        <Row label="ADX (14)" value={data.adx?.value?.toFixed(2)} S={S} />
        <Row label="+DI" value={data.adx?.plusDI?.toFixed(2)} color={data.adx?.plusDI > data.adx?.minusDI ? S.green : S.dim} S={S} />
        <Row label="-DI" value={data.adx?.minusDI?.toFixed(2)} color={data.adx?.minusDI > data.adx?.plusDI ? S.red : S.dim} S={S} />
        <Row label="ADX Signal" value={data.adx?.signal} color={getColorForTrend(data.adx?.signal, S)} S={S} />
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S9 — Price Action
const RenderS9 = ({ data, S }) => (
  <SectionBlock num={9} title="Price Action" S={S}>
    {data && data.patterns && data.patterns.length > 0 ? (
      <>
        {data.patterns.map((pat, i) => (
          <Row key={i} label={pat.name} value={pat.description} color={pat.type === 'bullish' ? S.green : pat.type === 'bearish' ? S.red : S.amber} S={S} />
        ))}
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>No significant price action pattern in last 3 candles</div>}
  </SectionBlock>
);

// S10 — Candlestick Patterns
const RenderS10 = ({ data, S }) => (
  <SectionBlock num={10} title="Candlestick Patterns" S={S}>
    {data && data.patterns && data.patterns.length > 0 ? (
      <>
        {data.bullish?.length > 0 && <><div style={{ fontSize: 10, color: S.green, fontWeight: 700 }}>Bullish</div>{data.bullish.map((p, i) => <Row key={`b${i}`} label={p.name} value={p.significance} color={S.green} S={S} />)}</>}
        {data.bearish?.length > 0 && <><div style={{ fontSize: 10, color: S.red, fontWeight: 700, marginTop: 4 }}>Bearish</div>{data.bearish.map((p, i) => <Row key={`be${i}`} label={p.name} value={p.significance} color={S.red} S={S} />)}</>}
        {data.neutral?.length > 0 && <><div style={{ fontSize: 10, color: S.amber, fontWeight: 700, marginTop: 4 }}>Neutral</div>{data.neutral.map((p, i) => <Row key={`n${i}`} label={p.name} value={p.significance} color={S.amber} S={S} />)}</>}
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>No patterns detected</div>}
  </SectionBlock>
);

// S11 — Chart Patterns
const RenderS11 = ({ data, S }) => (
  <SectionBlock num={11} title="Chart Patterns" S={S}>
    {data && data.patterns && data.patterns.length > 0 ? (
      <>
        {data.patterns.map((pat, i) => (
          <Row key={i} label={pat.name} value={`${pat.dir} — ${pat.description}`} color={pat.dir === 'bullish' ? S.green : pat.dir === 'bearish' ? S.red : S.amber} S={S} />
        ))}
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>No chart pattern detected in current data window</div>}
  </SectionBlock>
);

// S12 — Smart Money Concepts
const RenderS12 = ({ data, S }) => (
  <SectionBlock num={12} title="Smart Money Concepts" S={S}>
    {data ? (
      <>
        {data.orderBlock?.found && (
          <Row label={`${data.orderBlock.type} Order Block`} value={data.orderBlock.price?.toFixed(2)} color={data.orderBlock.type === 'Bullish' ? S.green : S.red} S={S} />
        )}
        {data.bos?.type !== 'None' && (
          <Row label="BOS" value={`${data.bos.type} @ ${data.bos.price?.toFixed(2)}`} color={S.amber} S={S} />
        )}
        {data.choch?.type !== 'None' && (
          <Row label="CHOCH" value={`${data.choch.type} @ ${data.choch.price?.toFixed(2)}`} color={S.bright} S={S} />
        )}
        {data.zones && data.zones.length > 0 && data.zones.map((z, i) => (
          <Row key={i} label={z.type} value={`${z.low?.toFixed(2)} - ${z.high?.toFixed(2)}`} color={z.type?.includes('Bullish') ? S.green : z.type?.includes('Bearish') ? S.red : S.amber} S={S} />
        ))}
        {data.premiumZone && <Row label="Premium Zone (>61.8%)" value={data.premiumZone.level?.toFixed(2)} color={data.premiumZone.active ? S.red : S.dim} S={S} />}
        {data.discountZone && <Row label="Discount Zone (<38.2%)" value={data.discountZone.level?.toFixed(2)} color={data.discountZone.active ? S.green : S.dim} S={S} />}
        {!data.orderBlock?.found && (!data.zones || data.zones.length === 0) && <div style={{ color: S.dim, fontSize: 11 }}>No SMC concepts detected</div>}
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S13 — ICT Concepts
const RenderS13 = ({ data, S }) => (
  <SectionBlock num={13} title="ICT Concepts" S={S}>
    {data ? (
      <>
        <Row label="Kill Zone" value={`${data.killZone?.name} (${data.killZone?.active ? 'Active' : 'Inactive'})`} color={data.killZone?.active ? S.amber : S.dim} S={S} />
        <Row label="OTE Zone" value={`${data.ote?.low?.toFixed(2)} - ${data.ote?.high?.toFixed(2)}`} color={data.ote?.inZone ? S.green : S.dim} S={S} />
        <Row label="Price in OTE" value={data.ote?.inZone ? 'Yes' : 'No'} color={data.ote?.inZone ? S.green : S.dim} S={S} />
        {data.fvg && data.fvg.length > 0 && data.fvg.map((f, i) => (
          <Row key={i} label={f.type} value={`${f.low?.toFixed(2)} - ${f.high?.toFixed(2)}`} color={f.type?.includes('Bullish') ? S.green : S.red} S={S} />
        ))}
        <Row label="Liquidity Sweep" value={data.liquiditySweep?.found ? `${data.liquiditySweep.type} @ ${data.liquiditySweep.price?.toFixed(2)}` : 'None'} color={data.liquiditySweep?.found ? S.amber : S.dim} S={S} />
        <Row label="MSS" value={data.mss?.detected ? data.mss.type : 'None'} color={data.mss?.detected ? (data.mss.type?.includes('Bullish') ? S.green : S.red) : S.dim} S={S} />
        <Row label="Power of 3" value={data.powerOfThree?.phase} color={S.bright} S={S} />
        <Row label="Judas Swing" value={data.judasSwing?.detected ? data.judasSwing.direction : 'Not detected'} color={data.judasSwing?.detected ? S.amber : S.dim} S={S} />
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S14 — Wyckoff Analysis
const RenderS14 = ({ data, S }) => (
  <SectionBlock num={14} title="Wyckoff Analysis" S={S}>
    {data ? (
      <>
        <Row label="Phase" value={data.phase} color={data.phase === 'Accumulation' ? S.green : data.phase === 'Distribution' ? S.red : S.amber} S={S} />
        <Row label="Confidence" value={data.confidence} S={S} />
        <Row label="Conditions Met" value={`${data.conditionsMet}/${data.totalConditions}`} S={S} />
        {data.events && data.events.length > 0 && <><div style={{ fontSize: 10, color: S.dim, marginTop: 4 }}>Events:</div>{data.events.map((e, i) => <Row key={i} label={`#${i+1}`} value={e} color={S.text} S={S} />)}</>}
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S15 — Elliott Wave
const RenderS15 = ({ data, S }) => (
  <SectionBlock num={15} title="Elliott Wave" S={S}>
    {data ? (
      <>
        <Row label="Type" value={data.type} color={data.valid ? S.green : S.amber} S={S} />
        <Row label="Current Wave" value={data.currentWave} color={S.bright} S={S} />
        <Row label="Wave Count" value={(data.waveCount || []).join(', ') || 'N/A'} S={S} />
        <Row label="Target" value={data.target?.toFixed(2)} S={S} />
        <Row label="Valid" value={data.valid ? 'Yes' : 'No'} color={data.valid ? S.green : S.red} S={S} />
        {data.validationNotes && data.validationNotes.length > 0 && <><div style={{ fontSize: 10, color: S.dim, marginTop: 4 }}>Notes:</div>{data.validationNotes.map((n, i) => <Row key={i} label={`#${i+1}`} value={n} color={S.text} S={S} />)}</>}
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S16 — Harmonic Patterns
const RenderS16 = ({ data, S }) => (
  <SectionBlock num={16} title="Harmonic Patterns" S={S}>
    {data && data.patterns && data.patterns.length > 0 ? (
      <>
        {data.patterns.map((pat, i) => (
          pat.name !== 'No harmonic pattern detected' ? (
            <Row key={i} label={pat.name} value={`PRZ: ${pat.prz?.toFixed(2)}`} color={getColorForTrend(pat.type, S)} S={S} />
          ) : <div key={i} style={{ color: S.dim, fontSize: 11 }}>{pat.name}</div>
        ))}
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>No harmonic pattern detected</div>}
  </SectionBlock>
);

// S17 — Fibonacci
const RenderS17 = ({ data, S }) => (
  <SectionBlock num={17} title="Fibonacci" S={S}>
    {data && data.levels ? (
      <>
        {Object.entries(data.levels).map(([level, price]) => (
          <Row key={level} label={level} value={Number(price).toFixed(2)} S={S} />
        ))}
        {data.nearest && <Row label="Nearest Level" value={data.nearest} color={S.bright} S={S} />}
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S18 — Session Analysis
const RenderS18 = ({ data, S }) => (
  <SectionBlock num={18} title="Session Analysis" S={S}>
    {data ? (
      <>
        <Row label="Current Session" value={data.currentSession} color={data.currentSession !== 'Off-hours' ? S.amber : S.dim} S={S} />
        <Row label="Overlap" value={data.overlap || 'None'} color={data.overlap ? S.bright : S.dim} S={S} />
        <Row label="Opening Range High" value={data.openingRange?.high?.toFixed(2)} S={S} />
        <Row label="Opening Range Low" value={data.openingRange?.low?.toFixed(2)} S={S} />
        <Row label="Initial Balance High" value={data.initialBalance?.high?.toFixed(2)} S={S} />
        <Row label="Initial Balance Low" value={data.initialBalance?.low?.toFixed(2)} S={S} />
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S19 — Gap Analysis
const RenderS19 = ({ data, S }) => (
  <SectionBlock num={19} title="Gap Analysis" S={S}>
    {data ? (
      <>
        <Row label="Gap Detected" value={data.hasGap ? 'Yes' : 'No'} color={data.hasGap ? S.amber : S.dim} S={S} />
        {data.hasGap && (
          <>
            <Row label="Direction" value={data.direction} color={data.direction === 'Up' ? S.green : S.red} S={S} />
            <Row label="Size" value={`${data.sizePct?.toFixed(2)}%`} S={S} />
            <Row label="Type" value={data.type} color={S.bright} S={S} />
          </>
        )}
        {!data.hasGap && <Row label="Result" value={data.type || 'No significant gap detected'} S={S} />}
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S20 — Options Data
const RenderS20 = ({ data, S }) => (
  <SectionBlock num={20} title="Options Data" S={S}>
    {data ? (
      <>
        {data.available ? (
          <>
            <Row label="Max Pain" value={data.maxPain?.toFixed(2)} color={S.amber} S={S} />
            <Row label="Put/Call Ratio" value={data.pcr?.toFixed(2)} color={data.pcr > 1 ? S.red : S.green} S={S} />
            <Row label="Highest Call OI" value={data.highCall?.toFixed(2)} S={S} />
            <Row label="Highest Put OI" value={data.highPut?.toFixed(2)} S={S} />
            <Row label="IV" value={`${(data.iv * 100).toFixed(2)}%`} S={S} />
          </>
        ) : (
          <div style={{ color: S.dim, fontSize: 11 }}>{data.message || 'External feed required'}</div>
        )}
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S21 — Market Breadth
const RenderS21 = ({ data, S }) => (
  <SectionBlock num={21} title="Market Breadth" S={S}>
    {data ? (
      <>
        {data.relativeStrength && (
          <Row label="Relative Strength" value={`${data.relativeStrength.value?.toFixed(2)} (${data.relativeStrength.label})`} color={data.relativeStrength.label === 'Strong' ? S.green : data.relativeStrength.label === 'Weak' ? S.red : S.amber} S={S} />
        )}
        {data.correlations && Object.keys(data.correlations).length > 0 && (
          <>{Object.entries(data.correlations).map(([asset, corr]) => (
            <Row key={asset} label={`vs ${asset}`} value={typeof corr === 'number' ? corr.toFixed(2) : corr} color={typeof corr === 'number' ? (corr > 0.7 ? S.green : corr < -0.7 ? S.red : S.dim) : S.dim} S={S} />
          ))}</>
        )}
        <Row label="A/D" value={data.advanceDecline ?? 'N/A'} color={S.dim} S={S} />
        <Row label="TRIN" value={data.trin ?? 'N/A'} color={S.dim} S={S} />
        <Row label="Tick Index" value={data.tickIndex ?? 'N/A'} color={S.dim} S={S} />
        {data.message && <Row label="Note" value={data.message} color={S.dim} S={S} />}
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

// S22 — Risk Management
const RenderS22 = ({ data, S }) => (
  <SectionBlock num={22} title="Risk Management" S={S}>
    {data ? (
      <>
        <Row label="Risk %" value={`${data.riskPct?.toFixed(2)}%`} color={S.amber} S={S} />
        <Row label="Stop Loss" value={data.stopLoss?.toFixed(2)} color={S.red} S={S} />
        <Row label="Take Profit 1" value={data.tp1?.toFixed(2)} color={S.green} S={S} />
        <Row label="Take Profit 2" value={data.tp2?.toFixed(2)} color={S.green} S={S} />
        <Row label="Risk/Reward" value={data.riskReward?.toFixed(2)} color={data.riskReward >= 3 ? S.green : data.riskReward >= 2 ? S.amber : S.red} S={S} />
        <Row label="Position Size" value={data.positionSize?.toFixed(4)} S={S} />
        <Row label="Max Daily Loss" value={data.maxDailyLoss?.toFixed(2)} color={S.red} S={S} />
        <Row label="Max Drawdown" value={data.maxDrawdown?.toFixed(2)} color={S.red} S={S} />
        <Row label="Margin Usage" value={data.marginUsage?.toFixed(2)} S={S} />
        <Row label="Leverage" value={`${data.leverage}x`} S={S} />
        <Row label="Exposure" value={data.exposure?.toFixed(2)} S={S} />
      </>
    ) : <div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div>}
  </SectionBlock>
);

const RenderS23 = ({ data, S }) => {
  if (!data) return <SectionBlock num={23} title="Signal Scoring" S={S}><div style={{ color: S.dim, fontSize: 11 }}>Insufficient data</div></SectionBlock>;
  const score = data.score || 0;
  const signal = data.signal || 'Neutral';
  return (
    <SectionBlock num={23} title="Signal Scoring" S={S}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: getColorForTrend(signal, S), ...mono }}>
          {signal.toUpperCase()}
        </div>
        <div style={{
          height: 6, width: '100%', background: S.border, borderRadius: 3, marginTop: 8, overflow: 'hidden'
        }}>
          <div style={{
            height: '100%', width: `${score}%`, background: getColorForTrend(signal, S), transition: 'width 0.3s'
          }} />
        </div>
        <div style={{ fontSize: 10, color: S.dim, marginTop: 4 }}>Confidence: {score.toFixed(0)}%</div>
      </div>
      {data.factors && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Object.entries(data.factors).map(([factor, pts]) => (
            <div key={factor} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: S.dim }}>{factor}</span>
              <span style={{ color: pts > 0 ? S.green : pts < 0 ? S.red : S.text, ...mono }}>
                {pts > 0 ? '+' : ''}{pts}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionBlock>
  );
};

// S24 is rendered specially at the top — 22-field Dashboard Summary
const dashField = (label, value, color, S) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <span style={{ ...labelStyle, color: S.dim }}>{label}</span>
    <span style={{ ...mono, fontSize: 11, color: color || S.text }}>{value ?? 'N/A'}</span>
  </div>
);

const fmtNum = (n, d = 2) => { const v = Number(n); return isNaN(v) ? 'N/A' : v.toFixed(d); };
const fmtPct = (n, d = 1) => { const v = Number(n); return isNaN(v) ? 'N/A' : `${v.toFixed(d)}%`; };
const fmtVol = (n) => {
  const v = Number(n);
  if (isNaN(v)) return 'N/A';
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
};
const fmtPnl = (n) => {
  const v = Number(n);
  if (isNaN(v)) return 'N/A';
  const s = v.toFixed(2);
  return v >= 0 ? `+${s}` : s;
};

const RenderS24 = ({ data, S }) => {
  if (!data) return null;
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '8px 16px', padding: '8px 14px',
      background: S.bg, borderBottom: `1px solid ${S.border}`, borderRadius: '4px 4px 0 0', alignItems: 'flex-start'
    }}>
      {/* Row 1 — Core */}
      {dashField('PRICE', data.price?.toFixed(2), S.bright, S)}
      {dashField('TREND', data.trend || 'N/A', getColorForTrend(data.trend, S), S)}
      {dashField('SIGNAL', data.signal || 'N/A', getColorForTrend(data.signal, S), S)}
      {dashField('CONF.', data.confidence ? `${data.confidence.toFixed(0)}%` : 'N/A', S.text, S)}
      {/* Row 2 — Indicators */}
      {dashField('RSI', fmtNum(data.rsi), S.text, S)}
      {dashField('MACD', fmtNum(data.macd, 4), S.text, S)}
      {dashField('ATR', fmtNum(data.atr), S.text, S)}
      {dashField('VOL%', fmtPct(data.volatility), S.text, S)}
      {dashField('VOLUME', fmtVol(data.volume), S.text, S)}
      {/* Row 3 — Levels */}
      {dashField('SUPPORT', fmtNum(data.nearestSupport), S.green, S)}
      {dashField('RESIST', fmtNum(data.nearestResistance), S.red, S)}
      {dashField('STOP', fmtNum(data.stopLoss), S.red, S)}
      {dashField('TP1', fmtNum(data.tp1), S.green, S)}
      {dashField('TP2', fmtNum(data.tp2), S.green, S)}
      {/* Row 4 — Signals & Session */}
      {dashField('EMA', data.emaAlign || 'N/A', getColorForTrend(data.emaAlign, S), S)}
      {dashField('MTF', data.multiTF || 'N/A', getColorForTrend(data.multiTF, S), S)}
      {dashField('SESSION', data.session || 'N/A', S.text, S)}
      {dashField('R:R', fmtNum(data.riskReward, 2), data.riskReward >= 2 ? S.green : S.amber, S)}
      {/* Row 5 — Trade & Risk */}
      {dashField('STATUS', data.tradeStatus || 'N/A', data.tradeStatus === 'Open' ? S.green : S.dim, S)}
      {dashField('WIN%', data.winRate || 'N/A', S.text, S)}
      {dashField('P&L', fmtPnl(data.pnl), data.pnl >= 0 ? S.green : S.red, S)}
      {dashField('DD', fmtPct(data.drawdown), data.drawdown > 0 ? S.red : S.text, S)}
    </div>
  );
};


export default function TradeVerdictTab({ ALL, prices, indicators, gannData, hist, ohlcPrices, sentiments, cfg, S, toast_ }) {
  const [verdictData, setVerdictData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('alpha_verdict')) || {}; } catch { return {}; }
  });
  const [loading, setLoading] = useState({});
  const [expanded, setExpanded] = useState({});

  useEffect(() => { localStorage.setItem('alpha_verdict', JSON.stringify(verdictData)); }, [verdictData]);

  const toggleExpand = (symbol) => {
    setExpanded(prev => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  const handleAnalyse = useCallback(async (asset) => {
    const symbol = asset.symbol;
    setLoading(prev => ({ ...prev, [symbol]: true }));
    
    try {
      let ohlc1h, ohlc15m, ohlc1d, optionChain;

      // Always try to fetch fresh 1h data; fall back to pre-fetched if API unavailable
      try {
        const res1h = await fetch(`/api/chart/history?symbol=${symbol}&interval=1h`);
        if (res1h.ok) ohlc1h = (await res1h.json()).ohlc;
        else ohlc1h = ohlcPrices?.[symbol];
      } catch (e) { ohlc1h = ohlcPrices?.[symbol]; }

      try {
        const res15 = await fetch(`/api/chart/history?symbol=${symbol}&interval=15m`);
        if (res15.ok) ohlc15m = (await res15.json()).ohlc;
      } catch (e) { /* ignore */ }

      try {
        const res1d = await fetch(`/api/chart/history?symbol=${symbol}&interval=1d`);
        if (res1d.ok) ohlc1d = (await res1d.json()).ohlc;
      } catch (e) { /* ignore */ }

      // Use best available OHLC: 1h > 1d > 15m
      const ohlc = ohlc1h || ohlc1d || ohlc15m;

      if (asset.exchange === 'NSE') {
        try {
          const resOpt = await fetch(`/api/nse/option-chain/${symbol}`);
          if (resOpt.ok) optionChain = await resOpt.json();
        } catch (e) { /* ignore */ }
      }
      
      const tradesArr = [];
      
      const vData = runFullVerdict(
        asset, 
        prices[symbol], 
        hist[symbol], 
        ohlc, 
        gannData[symbol], 
        sentiments, 
        cfg, 
        ALL, 
        prices, 
        tradesArr,
        optionChain
      );
      
      if (ohlc15m) vData.sections.s1_15m = ohlc15m;
      if (ohlc1d) vData.sections.s1_1d = ohlc1d;
      if (optionChain) vData.sections.s17_options = optionChain;

      setVerdictData(prev => ({
        ...prev,
        [symbol]: {
          sections: vData.sections || {},
          timestamp: Date.now()
        }
      }));
    } catch (err) {
      console.error(err);
      if (toast_) toast_(`Error analysing ${symbol}: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, [symbol]: false }));
    }
  }, [ALL, cfg, gannData, hist, ohlcPrices, prices, sentiments, toast_]);

  const openAssets = (ALL || []).filter(a => isOpen(a));
  const openCount = openAssets.length;

  const runFullAnalysis = useCallback(async () => {
    const open = (ALL || []).filter(a => isOpen(a));
    for (const asset of open) {
      if (asset.symbol) {
        await handleAnalyse(asset);
      }
    }
    if (toast_) toast_("Full analysis complete.");
  }, [ALL, handleAnalyse, toast_]);

  const analyzedCount = useMemo(() => Object.keys(verdictData).length, [verdictData]);

  return (
    <div style={{ padding: 16, background: S.bg, minHeight: '100%', color: S.text }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: S.bright }}>Trade Verdicts</h2>
          <div style={{ fontSize: 12, color: S.dim, marginTop: 4 }}>
            Analysed: {analyzedCount}/{openCount} open assets
          </div>
        </div>
        <button 
          onClick={runFullAnalysis}
          style={{
            background: S.blue, color: '#fff', border: 'none', padding: '6px 12px',
            borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold'
          }}
        >
          Run Full Analysis
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {openAssets.map(asset => {
          const sym = asset.symbol;
          const isLoading = loading[sym];
          const isExpanded = expanded[sym];
          const vData = verdictData[sym];

          return (
            <div key={sym} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
              <div style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderBottom: `1px solid ${S.border}`, background: 'rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: 14, color: S.bright }}>{sym}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    onClick={() => handleAnalyse(asset)}
                    disabled={isLoading}
                    style={{
                      background: 'transparent', border: `1px solid ${S.border}`, color: S.text,
                      padding: '4px 8px', borderRadius: 4, cursor: isLoading ? 'default' : 'pointer', fontSize: 11
                    }}
                  >
                    Analyse
                  </button>
                  {vData && (
                    <button 
                      onClick={() => toggleExpand(sym)}
                      style={{
                        background: 'transparent', border: `1px solid ${S.border}`, color: S.text,
                        padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11
                      }}
                    >
                      {isExpanded ? '▲ Collapse' : '▼ Expand'}
                    </button>
                  )}
                </div>
              </div>

              {isLoading ? (
                <Spinner S={S} />
              ) : !vData ? (
                <div style={{ padding: 20, fontSize: 12, color: S.dim, textAlign: 'center' }}>
                  Not analysed yet
                </div>
              ) : (
                <div>
                  <RenderS24 data={vData.sections.s24} S={S} />
                  
                  {isExpanded && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1 }}>
                      <div style={{ background: S.card }}><RenderS1 data={vData.sections.s1} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS2 data={vData.sections.s2} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS3 data={vData.sections.s3} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS4 data={vData.sections.s4} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS5 data={vData.sections.s5} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS6 data={vData.sections.s6} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS7 data={vData.sections.s7} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS8 data={vData.sections.s8} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS9 data={vData.sections.s9} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS10 data={vData.sections.s10} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS11 data={vData.sections.s11} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS12 data={vData.sections.s12} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS13 data={vData.sections.s13} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS14 data={vData.sections.s14} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS15 data={vData.sections.s15} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS16 data={vData.sections.s16} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS17 data={vData.sections.s17} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS18 data={vData.sections.s18} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS19 data={vData.sections.s19} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS20 data={vData.sections.s20} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS21 data={vData.sections.s21} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS22 data={vData.sections.s22} S={S} /></div>
                      <div style={{ background: S.card }}><RenderS23 data={vData.sections.s23} S={S} /></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
