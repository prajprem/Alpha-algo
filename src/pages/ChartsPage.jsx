import { useState, useMemo, useCallback, useRef, useEffect } from "react";

const mono = { fontFamily: "'JetBrains Mono', monospace" };
const fmt = (v, d = 2) => (v == null ? "--" : v > 9999 ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : Number(v).toFixed(d));
const pct = (v) => (v == null ? "--" : (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%");

const calcEma = (arr, p) => {
  if (!arr || arr.length < p) return [];
  const k = 2 / (p + 1);
  const result = [];
  let e = arr.slice(0, p).reduce((a, b) => a + b, 0) / p;
  for (let i = 0; i < p - 1; i++) result.push(null);
  result.push(e);
  for (let i = p; i < arr.length; i++) { e = arr[i] * k + e * (1 - k); result.push(e); }
  return result;
};

const calcBBArr = (arr, p = 20) => {
  if (!arr || arr.length < p) return { upper: [], mid: [], lower: [] };
  const upper = [], mid = [], lower = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < p - 1) { upper.push(null); mid.push(null); lower.push(null); continue; }
    const sl = arr.slice(i - p + 1, i + 1);
    const m = sl.reduce((a, b) => a + b, 0) / p;
    const std = Math.sqrt(sl.reduce((a, b) => a + Math.pow(b - m, 2), 0) / p);
    upper.push(m + 2 * std); mid.push(m); lower.push(m - 2 * std);
  }
  return { upper, mid, lower };
};

const calcRSIArr = (arr, p = 14) => {
  if (!arr || arr.length < p + 1) return [];
  const result = new Array(p).fill(null);
  for (let i = p; i < arr.length; i++) {
    const sl = arr.slice(i - p, i + 1);
    let g = 0, l = 0;
    for (let j = 1; j < sl.length; j++) { const d = sl[j] - sl[j - 1]; d > 0 ? g += d : l -= d; }
    result.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  }
  return result;
};

const buildHeikinAshi = (candles) => {
  if (!candles.length) return [];
  const ha = [];
  candles.forEach((c, i) => {
    const haC = (c.o + c.h + c.l + c.c) / 4;
    const haO = i === 0 ? (c.o + c.c) / 2 : (ha[i - 1].o + ha[i - 1].c) / 2;
    ha.push({ o: haO, h: Math.max(c.h, haO, haC), l: Math.min(c.l, haO, haC), c: haC, time: c.time });
  });
  return ha;
};

const CHART_TYPES = [
  { id: "candle", label: "Candlestick" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
  { id: "ohlc", label: "OHLC" },
  { id: "ha", label: "Heikin-Ashi" },
];

const TIMEFRAMES = [
  { id: "1m", interval: "1m", label: "1m" },
  { id: "5m", interval: "5m", label: "5m" },
  { id: "15m", interval: "15m", label: "15m" },
  { id: "1h", interval: "1h", label: "1h" },
  { id: "4h", interval: "4h", label: "4h" },
  { id: "1d", interval: "1d", label: "1D" },
];

const OVERLAYS = [
  { id: "ema12", label: "EMA 12", color: "#3b82f6" },
  { id: "ema26", label: "EMA 26", color: "#f59e0b" },
  { id: "bb", label: "Bollinger", color: "#8b5cf6" },
  { id: "vwap", label: "VWAP", color: "#ec4899" },
];

export default function ChartsPage({ ALL, prices, hist, sel, setSel, S }) {
  const [chartType, setChartType] = useState("candle");
  const [timeframe, setTimeframe] = useState("1h");
  const [overlays, setOverlays] = useState(["ema12"]);
  const [crosshair, setCrosshair] = useState(null);
  const [ohlcData, setOhlcData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(0);
  const [selection, setSelection] = useState(null);
  const [scrollDrag, setScrollDrag] = useState(null);
  const svgRef = useRef(null);
  const selRef = useRef(null);
  const onWheelRef = useRef(null);
  const scrollTrackRef = useRef(null);

  const W = 900, H = 420, RSI_H = 90, PAD = { t: 20, r: 64, b: 28, l: 14 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  const asset = ALL.find(a => a.symbol === sel) || ALL[0];
  const rawHist = hist[asset?.symbol] || [];
  const price = prices[asset?.symbol]?.usd || asset?.demo || 0;
  const chg = prices[asset?.symbol]?.usd_24h_change || asset?.demoChg || 0;
  const dec = asset?.dec || 2;

  const toggleOverlay = (id) => setOverlays(p => p.includes(id) ? p.filter(o => o !== id) : [...p, id]);

  // Fetch real OHLC data from backend
  useEffect(() => {
    if (!sel) return;
    let active = true;
    setLoading(true);
    fetch(`/api/chart/history?symbol=${sel}&interval=${timeframe}`)
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        if (data.ohlc && data.ohlc.length > 1) {
          setOhlcData(data.ohlc);
        } else {
          setOhlcData(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) { setOhlcData(null); setLoading(false); }
      });
    return () => { active = false; };
  }, [sel, timeframe]);

  // Use real OHLC close prices, or fall back to hist
  const closePrices = useMemo(() => {
    if (ohlcData && ohlcData.length > 1) {
      return ohlcData.map(c => c.close);
    }
    return rawHist;
  }, [ohlcData, rawHist]);

  // Build candles from real OHLC or synthetic
  const candles = useMemo(() => {
    if (ohlcData && ohlcData.length > 1) {
      return ohlcData.map(c => ({ o: c.open, h: c.high, l: c.low, c: c.close, time: c.time }));
    }
    // Fallback: synthetic candles from hist
    if (rawHist.length < 2) return [];
    const synthetic = [];
    const avgVol = rawHist.reduce((s, v, i, a) => i > 0 ? s + Math.abs(v - a[i - 1]) : s, 0) / rawHist.length || rawHist[0] * 0.001;
    for (let i = 0; i < rawHist.length; i++) {
      const c = rawHist[i];
      const prevC = i > 0 ? rawHist[i - 1] : c;
      const seed = c + i;
      const r1 = (Math.sin(seed) * 10000) - Math.floor(Math.sin(seed) * 10000);
      const r2 = (Math.cos(seed) * 10000) - Math.floor(Math.cos(seed) * 10000);
      const o = prevC + (c - prevC) * r1 * 0.3;
      const h = Math.max(o, c) + (avgVol * r1);
      const l = Math.min(o, c) - (avgVol * r2);
      synthetic.push({ o, h, l, c });
    }
    return synthetic;
  }, [ohlcData, rawHist]);

  const haCandles = useMemo(() => buildHeikinAshi(candles), [candles]);
  const ema12Arr = useMemo(() => calcEma(closePrices, 12), [closePrices]);
  const ema26Arr = useMemo(() => calcEma(closePrices, 26), [closePrices]);
  const bbArr = useMemo(() => calcBBArr(closePrices, 20), [closePrices]);
  const vwapArr = useMemo(() => calcEma(closePrices, 20), [closePrices]);
  const rsiArr = useMemo(() => calcRSIArr(closePrices, 14), [closePrices]);

  const isCandleType = chartType === "candle" || chartType === "ohlc" || chartType === "ha";
  const displayCandles = chartType === "ha" ? haCandles : candles;

  // Zoom / visible range
  const totalDataLen = useMemo(() =>
    (isCandleType ? displayCandles.length : closePrices.length) || 1,
    [isCandleType, displayCandles.length, closePrices.length]
  );
  const visibleCount = useMemo(() =>
    Math.max(5, Math.round(Math.min(totalDataLen, totalDataLen / zoom))),
    [totalDataLen, zoom]
  );
  const startIdx = useMemo(() =>
    Math.max(0, Math.min(offset, totalDataLen - visibleCount)),
    [offset, totalDataLen, visibleCount]
  );
  const visibleCandles = useMemo(() =>
    displayCandles.slice(startIdx, startIdx + visibleCount) || [],
    [displayCandles, startIdx, visibleCount]
  );
  const visibleClosePrices = useMemo(() =>
    closePrices.slice(startIdx, startIdx + visibleCount) || [],
    [closePrices, startIdx, visibleCount]
  );
  const visEma12 = useMemo(() => ema12Arr.slice(startIdx, startIdx + visibleCount), [ema12Arr, startIdx, visibleCount]);
  const visEma26 = useMemo(() => ema26Arr.slice(startIdx, startIdx + visibleCount), [ema26Arr, startIdx, visibleCount]);
  const visBBU = useMemo(() => bbArr.upper.slice(startIdx, startIdx + visibleCount), [bbArr.upper, startIdx, visibleCount]);
  const visBBM = useMemo(() => bbArr.mid.slice(startIdx, startIdx + visibleCount), [bbArr.mid, startIdx, visibleCount]);
  const visBBL = useMemo(() => bbArr.lower.slice(startIdx, startIdx + visibleCount), [bbArr.lower, startIdx, visibleCount]);
  const visVwap = useMemo(() => vwapArr.slice(startIdx, startIdx + visibleCount), [vwapArr, startIdx, visibleCount]);
  const visRsi = useMemo(() => rsiArr.slice(startIdx, startIdx + visibleCount), [rsiArr, startIdx, visibleCount]);

  // Recompute price range from visible data only
  const { pMin, pMax, pRange } = useMemo(() => {
    let mn, mx;
    if (isCandleType && visibleCandles.length > 0) {
      mn = Math.min(...visibleCandles.map(c => c.l));
      mx = Math.max(...visibleCandles.map(c => c.h));
    } else if (visibleClosePrices.length > 0) {
      mn = Math.min(...visibleClosePrices);
      mx = Math.max(...visibleClosePrices);
    } else {
      mn = (price || 1) * 0.99;
      mx = (price || 1) * 1.01;
    }
    const validU = visBBU.filter(v => v != null);
    const validL = visBBL.filter(v => v != null);
    if (validU.length) mx = Math.max(mx, Math.max(...validU));
    if (validL.length) mn = Math.min(mn, Math.min(...validL));
    const validE12 = visEma12.filter(v => v != null);
    if (validE12.length) { mn = Math.min(mn, Math.min(...validE12)); mx = Math.max(mx, Math.max(...validE12)); }
    const validE26 = visEma26.filter(v => v != null);
    if (validE26.length) { mn = Math.min(mn, Math.min(...validE26)); mx = Math.max(mx, Math.max(...validE26)); }
    const range = mx - mn || mn * 0.01 || 1;
    const pad = range * 0.03;
    return { pMin: mn - pad, pMax: mx + pad, pRange: range + pad * 2 };
  }, [visibleClosePrices, visibleCandles, isCandleType, price, visBBU, visBBL, visEma12, visEma26]);

  const barW = useMemo(() => chartW / (visibleCount || 1), [chartW, visibleCount]);

  const tickToX = useCallback((i) => {
    const n = visibleClosePrices.length;
    if (n <= 1) return PAD.l + chartW / 2;
    return PAD.l + (i / (n - 1)) * chartW;
  }, [visibleClosePrices.length, chartW]);

  const candleToX = useCallback((i) => {
    const n = visibleCount;
    if (n <= 1) return PAD.l + chartW / 2;
    return PAD.l + i * barW + barW / 2;
  }, [visibleCount, barW, chartW]);

  const toY = useCallback((v) => {
    return PAD.t + chartH - ((v - pMin) / pRange) * chartH;
  }, [pMin, pRange, chartH]);

  // Wheel zoom: centered on mouse position (ref-based to allow passive:false)
  const handleWheel = useCallback((e) => {
    const total = totalDataLen;
    if (total <= 5) return;
    const delta = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(0.5, Math.min(20, zoom * delta));
    const curVisible = Math.max(5, Math.round(Math.min(total, total / zoom)));
    const curStart = Math.max(0, Math.min(offset, total - curVisible));
    const svg = svgRef.current;
    if (!svg) { setZoom(newZoom); return; }
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const relPos = (mx - PAD.l) / chartW;
    const centerIdx = curStart + relPos * curVisible;
    const newVisible = Math.max(5, Math.round(Math.min(total, total / newZoom)));
    const newStart = Math.max(0, Math.min(total - newVisible, Math.round(centerIdx - relPos * newVisible)));
    setZoom(newZoom);
    setOffset(newStart);
  }, [zoom, offset, totalDataLen, chartW]);
  onWheelRef.current = handleWheel;

  useEffect(() => {
    const handler = (e) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX, y = e.clientY;
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        e.preventDefault();
        onWheelRef.current?.(e);
      }
    };
    window.addEventListener('wheel', handler, { passive: false });
    return () => window.removeEventListener('wheel', handler);
  }, []);

  // Start selection drag
  const onMouseDown = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleX;
    if (mx < PAD.l || mx > W - PAD.r || my < PAD.t || my > PAD.t + chartH) return;
    selRef.current = { startX: mx, startY: my };
    setSelection({ x1: mx, y1: my, x2: mx, y2: my });
  }, []);

  // Finalize selection on mouseup → fixate with avg/high/low
  const onMouseUp = useCallback((e) => {
    if (!selRef.current) return;
    const svg = svgRef.current;
    if (!svg) { selRef.current = null; setSelection(null); return; }
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleX;
    const { startX, startY } = selRef.current;
    const dx = Math.abs(mx - startX);
    const dy = Math.abs(my - startY);

    // Click (no meaningful drag) → just clear
    if (dx < 5 && dy < 5) {
      selRef.current = null;
      setSelection(null);
      return;
    }

    // Compute selection data
    const total = totalDataLen;
    const curVisible = Math.max(5, Math.round(Math.min(total, total / zoom)));
    const curStart = Math.max(0, Math.min(offset, total - curVisible));
    const leftPx = Math.min(startX, mx);
    const rightPx = Math.max(startX, mx);
    const topPx = Math.min(startY, my);
    const bottomPx = Math.max(startY, my);
    const leftFrac = Math.max(0, (leftPx - PAD.l) / chartW);
    const rightFrac = Math.min(1, (rightPx - PAD.l) / chartW);
    const sIdx = Math.round(curStart + leftFrac * curVisible);
    const eIdx = Math.round(curStart + rightFrac * curVisible);

    // Compute stats from visible close prices in range
    const relStart = Math.max(0, sIdx - curStart);
    const relEnd = Math.min(visibleClosePrices.length - 1, eIdx - curStart);
    const selected = visibleClosePrices.slice(relStart, relEnd + 1).filter(v => v != null);
    let avg = 0, high = -Infinity, low = Infinity;
    selected.forEach(v => { avg += v; if (v > high) high = v; if (v < low) low = v; });
    avg /= selected.length || 1;

    selRef.current = null;
    setSelection({ x1: leftPx, y1: topPx, x2: rightPx, y2: bottomPx, avg, high, low, startIdx: sIdx, endIdx: eIdx });
  }, [zoom, offset, totalDataLen, chartW, visibleClosePrices]);

  // Cancel ONLY an in-progress drag if mouse released outside SVG
  useEffect(() => {
    const up = () => {
      if (selRef.current) { selRef.current = null; setSelection(null); }
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const onMouseMove = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleX;

    // Handle active selection
    if (selRef.current) {
      setSelection({ x1: selRef.current.startX, y1: selRef.current.startY, x2: mx, y2: my });
      return;
    }

    // Crosshair
    if (mx < PAD.l || mx > W - PAD.r || my < PAD.t || my > PAD.t + chartH) { setCrosshair(null); return; }

    if (isCandleType && visibleCandles.length > 0) {
      const idx = Math.max(0, Math.min(Math.floor((mx - PAD.l) / barW), visibleCandles.length - 1));
      const c = visibleCandles[idx];
      setCrosshair({
        x: candleToX(idx), y: my, idx,
        price: c.c, open: c.o, high: c.h, low: c.l, close: c.c,
        time: c.time ? new Date(c.time).toLocaleString() : null,
      });
    } else if (visibleClosePrices.length > 0) {
      const idx = Math.max(0, Math.min(Math.round(((mx - PAD.l) / chartW) * (visibleClosePrices.length - 1)), visibleClosePrices.length - 1));
      setCrosshair({ x: tickToX(idx), y: my, idx, price: visibleClosePrices[idx] });
    }
  }, [visibleClosePrices, visibleCandles, isCandleType, chartW, chartH, PAD, W, barW, tickToX, candleToX]);

  // Horizontal scrollbar handlers
  const isScrollable = zoom > 1.01 && totalDataLen > 5;
  const scrollMax = Math.max(1, totalDataLen - visibleCount);

  const onScrollTrackClick = useCallback((e) => {
    if (!isScrollable || !scrollTrackRef.current) return;
    const rect = scrollTrackRef.current.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    setOffset(Math.round(frac * scrollMax));
  }, [isScrollable, scrollMax]);

  const onScrollThumbDown = useCallback((e) => {
    e.stopPropagation();
    if (!isScrollable) return;
    setScrollDrag({ startX: e.clientX, startOffset: offset });
  }, [isScrollable, offset]);

  useEffect(() => {
    if (!scrollDrag) return;
    const move = (e) => {
      const dx = e.clientX - scrollDrag.startX;
      if (!scrollTrackRef.current) return;
      const frac = dx / scrollTrackRef.current.offsetWidth;
      setOffset(Math.max(0, Math.min(scrollMax, Math.round(scrollDrag.startOffset + frac * scrollMax))));
    };
    const up = () => setScrollDrag(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [scrollDrag, scrollMax]);

  const scrollPct = scrollMax > 0 ? (offset / scrollMax) * 100 : 0;
  const thumbPct = totalDataLen > 0 ? (visibleCount / totalDataLen) * 100 : 100;

  const renderLine = () => {
    if (visibleClosePrices.length < 2) return null;
    const pts = visibleClosePrices.map((v, i) => `${tickToX(i)},${toY(v)}`).join(" ");
    const isUp = visibleClosePrices[visibleClosePrices.length - 1] >= visibleClosePrices[0];
    const col = isUp ? S.green : S.red;
    const bottomY = PAD.t + chartH;
    return (
      <>
        {chartType === "area" && (
          <>
            <defs><linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity="0.25" /><stop offset="100%" stopColor={col} stopOpacity="0.02" /></linearGradient></defs>
            <polygon points={`${tickToX(0)},${bottomY} ${pts} ${tickToX(visibleClosePrices.length - 1)},${bottomY}`} fill="url(#area-grad)" />
          </>
        )}
        <polyline points={pts} fill="none" stroke={col} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={tickToX(visibleClosePrices.length - 1)} cy={toY(visibleClosePrices[visibleClosePrices.length - 1])} r="3" fill={col} />
      </>
    );
  };

  const renderCandles = (data) => {
    if (!data.length) return null;
    const cw = Math.max(1, barW * 0.7);
    return data.map((c, i) => {
      const cx = candleToX(i);
      const isUp = c.c >= c.o;
      const col = isUp ? S.green : S.red;
      const bodyTop = toY(Math.max(c.o, c.c));
      const bodyBot = toY(Math.min(c.o, c.c));
      const bodyH = Math.max(1, bodyBot - bodyTop);
      return (
        <g key={i}>
          <line x1={cx} y1={toY(c.h)} x2={cx} y2={toY(c.l)} stroke={col} strokeWidth="1" />
          <rect x={cx - cw / 2} y={bodyTop} width={cw} height={bodyH} fill={isUp ? col : col} stroke={col} strokeWidth="0.5" rx="0.5" opacity="0.9" />
        </g>
      );
    });
  };

  const renderOHLC = (data) => {
    if (!data.length) return null;
    const tickLen = Math.max(2, barW * 0.3);
    return data.map((c, i) => {
      const cx = candleToX(i);
      const isUp = c.c >= c.o;
      const col = isUp ? S.green : S.red;
      return (
        <g key={i}>
          <line x1={cx} y1={toY(c.h)} x2={cx} y2={toY(c.l)} stroke={col} strokeWidth="1.5" />
          <line x1={cx - tickLen} y1={toY(c.o)} x2={cx} y2={toY(c.o)} stroke={col} strokeWidth="1.5" />
          <line x1={cx} y1={toY(c.c)} x2={cx + tickLen} y2={toY(c.c)} stroke={col} strokeWidth="1.5" />
        </g>
      );
    });
  };

  const renderOverlay = (arr, color, dash = "") => {
    if (!arr || arr.length < 2) return null;
    const segments = [];
    let current = [];
    arr.forEach((v, i) => {
      if (v != null) {
        current.push(`${tickToX(i)},${toY(v)}`);
      } else if (current.length > 1) {
        segments.push(current.join(" "));
        current = [];
      } else {
        current = [];
      }
    });
    if (current.length > 1) segments.push(current.join(" "));
    return segments.map((pts, si) => (
      <polyline key={si} points={pts} fill="none" stroke={color} strokeWidth="1.2" strokeDasharray={dash} opacity="0.75" strokeLinejoin="round" />
    ));
  };

  const renderBB = () => {
    if (!overlays.includes("bb") || !visBBU.length) return null;
    const upperPts = [];
    const lowerPts = [];
    for (let i = 0; i < visBBU.length; i++) {
      if (visBBU[i] != null && visBBL[i] != null) {
        const x = tickToX(i);
        upperPts.push(`${x},${toY(visBBU[i])}`);
        lowerPts.push(`${x},${toY(visBBL[i])}`);
      }
    }
    if (upperPts.length < 2) return null;
    const fillPts = [...upperPts, ...lowerPts.slice().reverse()].join(" ");
    return (
      <>
        <polygon points={fillPts} fill="#8b5cf6" opacity="0.06" />
        {renderOverlay(visBBU, "#8b5cf6", "4,2")}
        {renderOverlay(visBBM, "#8b5cf688", "2,3")}
        {renderOverlay(visBBL, "#8b5cf6", "4,2")}
      </>
    );
  };

  const priceLabels = useMemo(() => {
    const count = 7;
    const labels = [];
    for (let i = 0; i <= count; i++) {
      const v = pMin + (i / count) * pRange;
      labels.push({ v, y: toY(v) });
    }
    return labels;
  }, [pMin, pRange, toY]);

  const renderRSI = () => {
    const validRsi = visRsi.filter(v => v != null);
    if (validRsi.length < 2) return null;
    const rsiTop = H + 12;
    const rsiH = RSI_H;
    const rsiY = (v) => rsiTop + rsiH - (v / 100) * rsiH;
    const segments = [];
    let current = [];
    visRsi.forEach((v, i) => {
      if (v != null) {
        current.push(`${tickToX(i)},${rsiY(v)}`);
      } else if (current.length > 1) {
        segments.push(current.join(" "));
        current = [];
      } else {
        current = [];
      }
    });
    if (current.length > 1) segments.push(current.join(" "));
    const lastRsi = validRsi[validRsi.length - 1];
    return (
      <g>
        <rect x={PAD.l} y={rsiTop} width={chartW} height={rsiH} fill={S.bg} rx="4" stroke={S.border} strokeWidth="0.5" />
        <rect x={PAD.l} y={rsiY(70)} width={chartW} height={rsiY(30) - rsiY(70)} fill={S.dim + "06"} />
        <line x1={PAD.l} y1={rsiY(70)} x2={PAD.l + chartW} y2={rsiY(70)} stroke={S.red + "44"} strokeWidth="0.7" strokeDasharray="4,3" />
        <line x1={PAD.l} y1={rsiY(30)} x2={PAD.l + chartW} y2={rsiY(30)} stroke={S.green + "44"} strokeWidth="0.7" strokeDasharray="4,3" />
        <line x1={PAD.l} y1={rsiY(50)} x2={PAD.l + chartW} y2={rsiY(50)} stroke={S.border} strokeWidth="0.5" strokeDasharray="2,4" />
        {segments.map((pts, si) => (
          <polyline key={si} points={pts} fill="none" stroke={S.amber} strokeWidth="1.5" strokeLinejoin="round" />
        ))}
        <text x={PAD.l + chartW + 4} y={rsiY(70) + 3} fill={S.red} fontSize="8" fontFamily="JetBrains Mono">70</text>
        <text x={PAD.l + chartW + 4} y={rsiY(30) + 3} fill={S.green} fontSize="8" fontFamily="JetBrains Mono">30</text>
        <text x={PAD.l + chartW + 4} y={rsiY(50) + 3} fill={S.dim} fontSize="7" fontFamily="JetBrains Mono">50</text>
        <rect x={PAD.l + chartW} y={rsiY(lastRsi) - 7} width={50} height={14} rx="2" fill={lastRsi > 70 ? S.red : lastRsi < 30 ? S.green : S.amber} opacity="0.15" />
        <text x={PAD.l + chartW + 4} y={rsiY(lastRsi) + 4} fill={lastRsi > 70 ? S.red : lastRsi < 30 ? S.green : S.amber} fontSize="9" fontFamily="JetBrains Mono" fontWeight="600">{lastRsi.toFixed(1)}</text>
        <text x={PAD.l + 4} y={rsiTop + 10} fill={S.dim} fontSize="9" fontFamily="Inter" fontWeight="600">RSI (14)</text>
        {crosshair && <line x1={crosshair.x} y1={rsiTop} x2={crosshair.x} y2={rsiTop + rsiH} stroke={S.dim} strokeWidth="0.5" strokeDasharray="2,3" />}
      </g>
    );
  };

  const hasData = (isCandleType ? visibleCandles.length : visibleClosePrices.length) > 1;
  const isRealData = ohlcData && ohlcData.length > 1;
  const totalH = H + RSI_H + 20;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Controls Bar */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: "10px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <select value={sel} onChange={e => setSel(e.target.value)} style={{
          background: S.bg, border: `1px solid ${S.border}`, borderRadius: 4,
          padding: "6px 12px", fontSize: 12, fontWeight: 600, color: S.bright, cursor: "pointer", outline: "none",
        }}>
          {ALL.map(a => <option key={a.symbol} value={a.symbol} style={{ background: S.bg, color: S.text }}>{a.symbol} - {a.name}</option>)}
        </select>

        <div style={{ width: 1, height: 20, background: S.border }} />

        {CHART_TYPES.map(t => (
          <button key={t.id} onClick={() => setChartType(t.id)} style={{
            padding: "4px 10px", fontSize: 10, fontWeight: chartType === t.id ? 600 : 400,
            background: chartType === t.id ? S.blue + "18" : "transparent",
            border: `1px solid ${chartType === t.id ? S.blue + "44" : "transparent"}`,
            borderRadius: 4, color: chartType === t.id ? S.blue : S.dim, cursor: "pointer",
          }}>{t.label}</button>
        ))}

        <div style={{ width: 1, height: 20, background: S.border }} />

        {TIMEFRAMES.map(tf => (
          <button key={tf.id} onClick={() => setTimeframe(tf.id)} style={{
            padding: "4px 8px", fontSize: 10, fontWeight: timeframe === tf.id ? 600 : 400,
            background: timeframe === tf.id ? S.purple + "18" : "transparent",
            border: `1px solid ${timeframe === tf.id ? S.purple + "44" : "transparent"}`,
            borderRadius: 4, color: timeframe === tf.id ? S.purple : S.dim, cursor: "pointer", ...mono,
          }}>{tf.label}</button>
        ))}

        <div style={{ flex: 1 }} />

        {OVERLAYS.map(ov => (
          <label key={ov.id} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 10, color: overlays.includes(ov.id) ? ov.color : S.dim }}>
            <input type="checkbox" checked={overlays.includes(ov.id)} onChange={() => toggleOverlay(ov.id)}
              style={{ accentColor: ov.color, width: 12, height: 12 }} />
            {ov.label}
          </label>
        ))}

        {isRealData && (
          <span style={{ fontSize: 9, color: S.green, border: `1px solid ${S.green}33`, borderRadius: 4, padding: "2px 6px" }}>
            LIVE
          </span>
        )}
      </div>

      {/* Price Info */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: "10px 16px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: asset?.color, boxShadow: `0 0 8px ${asset?.color}66` }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: asset?.color }}>{asset?.symbol}</span>
          <span style={{ fontSize: 11, color: S.dim }}>{asset?.name}</span>
        </div>
        <span style={{ fontSize: 24, fontWeight: 800, color: S.bright, ...mono }}>
          {asset?.currency === "INR" ? "\u20B9" : "$"}{fmt(price, dec)}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: chg >= 0 ? S.green : S.red, ...mono }}>{pct(chg)}</span>
        {visibleClosePrices.length >= 2 && (
          <>
            <div style={{ fontSize: 10, color: S.dim }}>
              H: <span style={{ color: S.green, ...mono }}>{fmt(Math.max(...visibleClosePrices), dec)}</span>
            </div>
            <div style={{ fontSize: 10, color: S.dim }}>
              L: <span style={{ color: S.red, ...mono }}>{fmt(Math.min(...visibleClosePrices), dec)}</span>
            </div>
          </>
        )}
        {crosshair && (
          <div style={{ marginLeft: "auto", fontSize: 11, display: "flex", gap: 12 }}>
            {crosshair.time && <span style={{ color: S.dim, fontSize: 10 }}>{crosshair.time}</span>}
            {crosshair.open != null ? (
              <>
                <span style={{ color: S.dim }}>O: <span style={{ color: S.text, ...mono }}>{fmt(crosshair.open, dec)}</span></span>
                <span style={{ color: S.dim }}>H: <span style={{ color: S.green, ...mono }}>{fmt(crosshair.high, dec)}</span></span>
                <span style={{ color: S.dim }}>L: <span style={{ color: S.red, ...mono }}>{fmt(crosshair.low, dec)}</span></span>
                <span style={{ color: S.dim }}>C: <span style={{ color: S.amber, ...mono }}>{fmt(crosshair.close, dec)}</span></span>
              </>
            ) : (
              <span style={{ color: S.amber, ...mono }}>Crosshair: {fmt(crosshair.price, dec)}</span>
            )}
          </div>
        )}
        {selection && selection.avg != null && (
          <div style={{ marginLeft: "auto", fontSize: 11, display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ color: S.blue, fontSize: 10, fontWeight: 600 }}>Sel</span>
            <span style={{ color: S.dim }}>Avg: <span style={{ color: S.text, ...mono }}>{fmt(selection.avg, dec)}</span></span>
            <span style={{ color: S.dim }}>H: <span style={{ color: S.green, ...mono }}>{fmt(selection.high, dec)}</span></span>
            <span style={{ color: S.dim }}>L: <span style={{ color: S.red, ...mono }}>{fmt(selection.low, dec)}</span></span>
            <button onClick={() => setSelection(null)} style={{
              background: S.red + "14", border: `1px solid ${S.red}55`,
              borderRadius: 4, color: S.red, cursor: "pointer",
              fontSize: 10, fontWeight: 700, padding: "2px 8px", fontFamily: "Inter, sans-serif",
            }}>X</button>
          </div>
        )}
      </div>

      {/* Main Chart */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: S.dim, fontSize: 14 }}>
            Loading chart data for {asset?.symbol}...
          </div>
        ) : !hasData ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: S.dim, fontSize: 14 }}>
            Collecting price data for {asset?.symbol}... Chart will appear shortly.
          </div>
        ) : (
          <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${totalH}`} style={{ display: "block" }}
            onMouseMove={onMouseMove} onMouseLeave={() => setCrosshair(null)}
            onMouseDown={onMouseDown} onMouseUp={onMouseUp}>

            {priceLabels.map((pl, i) => (
              <g key={i}>
                <line x1={PAD.l} y1={pl.y} x2={PAD.l + chartW} y2={pl.y} stroke={S.border} strokeWidth="0.5" strokeDasharray="4,6" />
                <text x={PAD.l + chartW + 4} y={pl.y + 3} fill={S.dim} fontSize="8" fontFamily="JetBrains Mono">
                  {fmt(pl.v, dec > 2 ? 4 : 2)}
                </text>
              </g>
            ))}

            <rect x={PAD.l} y={PAD.t} width={chartW} height={chartH} fill="none" stroke={S.border} strokeWidth="0.5" rx="2" />

            {/* Selection rectangle + close button + price levels */}
            {selection && (
              <>
                <rect
                  x={Math.min(selection.x1, selection.x2)}
                  y={Math.min(selection.y1, selection.y2)}
                  width={Math.max(1, Math.abs(selection.x2 - selection.x1))}
                  height={Math.max(1, Math.abs(selection.y2 - selection.y1))}
                  fill={S.blue + "12"} stroke={S.blue} strokeWidth="1" strokeDasharray="4,3" rx="1"
                />
                {selection.avg != null && (
                  <>
                    {/* Close button (top-right) */}
                    <g onMouseDown={(ev) => { ev.stopPropagation(); setSelection(null); }} style={{ cursor: "pointer" }}>
                      <circle cx={Math.max(selection.x1, selection.x2)} cy={Math.min(selection.y1, selection.y2)} r="8" fill={S.card} stroke={S.red} strokeWidth="1.5" />
                      <line x1={Math.max(selection.x1, selection.x2) - 4} y1={Math.min(selection.y1, selection.y2) - 4} x2={Math.max(selection.x1, selection.x2) + 4} y2={Math.min(selection.y1, selection.y2) + 4} stroke={S.red} strokeWidth="2" />
                      <line x1={Math.max(selection.x1, selection.x2) + 4} y1={Math.min(selection.y1, selection.y2) - 4} x2={Math.max(selection.x1, selection.x2) - 4} y2={Math.min(selection.y1, selection.y2) + 4} stroke={S.red} strokeWidth="2" />
                    </g>
                    {/* Horizontal price level lines */}
                    {[
                      { val: selection.high, color: S.green, label: "H" },
                      { val: selection.avg, color: S.blue, label: "Avg" },
                      { val: selection.low, color: S.red, label: "L" },
                    ].map(({ val, color, label }) => {
                      const yy = toY(val);
                      if (yy < PAD.t || yy > PAD.t + chartH) return null;
                      return (
                        <g key={label}>
                          <line x1={PAD.l} y1={yy} x2={PAD.l + chartW} y2={yy} stroke={color} strokeWidth="0.7" strokeDasharray="4,3" opacity="0.6" />
                          <rect x={PAD.l + chartW} y={yy - 7} width={58} height={14} rx="2" fill={color + "cc"} />
                          <text x={PAD.l + chartW + 4} y={yy + 4} fill="#fff" fontSize="8" fontFamily="JetBrains Mono" fontWeight="600">
                            {label}: {fmt(val, dec)}
                          </text>
                        </g>
                      );
                    })}
                  </>
                )}
              </>
            )}

            {renderBB()}

            {(chartType === "line" || chartType === "area") && renderLine()}
            {chartType === "candle" && renderCandles(visibleCandles)}
            {chartType === "ohlc" && renderOHLC(visibleCandles)}
            {chartType === "ha" && renderCandles(visibleCandles)}

            {overlays.includes("ema12") && renderOverlay(visEma12, "#3b82f6")}
            {overlays.includes("ema26") && renderOverlay(visEma26, "#f59e0b")}
            {overlays.includes("vwap") && renderOverlay(visVwap, "#ec4899", "3,2")}

            {price > pMin && price < pMax && (
              <>
                <line x1={PAD.l} y1={toY(price)} x2={PAD.l + chartW} y2={toY(price)} stroke={chg >= 0 ? S.green : S.red} strokeWidth="0.7" strokeDasharray="3,3" opacity="0.5" />
                <rect x={PAD.l + chartW} y={toY(price) - 8} width={58} height={16} rx="3" fill={chg >= 0 ? S.green : S.red} />
                <text x={PAD.l + chartW + 4} y={toY(price) + 4} fill="#fff" fontSize="9" fontFamily="JetBrains Mono" fontWeight="600">{fmt(price, dec > 2 ? 4 : 2)}</text>
              </>
            )}

            {crosshair && (
              <>
                <line x1={crosshair.x} y1={PAD.t} x2={crosshair.x} y2={PAD.t + chartH} stroke={S.mid} strokeWidth="0.5" strokeDasharray="3,3" />
                <line x1={PAD.l} y1={crosshair.y} x2={PAD.l + chartW} y2={crosshair.y} stroke={S.mid} strokeWidth="0.5" strokeDasharray="3,3" />
                <circle cx={crosshair.x} cy={toY(crosshair.price || crosshair.close)} r="3.5" fill={S.bright} stroke={S.blue} strokeWidth="1.5" />
                <rect x={PAD.l + chartW} y={crosshair.y - 7} width={58} height={14} rx="2" fill={S.card} stroke={S.border} strokeWidth="0.5" />
                <text x={PAD.l + chartW + 4} y={crosshair.y + 3} fill={S.text} fontSize="8" fontFamily="JetBrains Mono">
                  {fmt(pMin + ((PAD.t + chartH - crosshair.y) / chartH) * pRange, dec > 2 ? 4 : 2)}
                </text>
              </>
            )}

            {renderRSI()}
          </svg>
        )}
        {/* Horizontal scrollbar */}
        {isScrollable && (
          <div ref={scrollTrackRef} onClick={onScrollTrackClick} style={{
            height: 8, marginTop: 6, background: S.bg, borderRadius: 4,
            cursor: "pointer", position: "relative",
          }}>
            <div onMouseDown={onScrollThumbDown} style={{
              position: "absolute", height: "100%", borderRadius: 4,
              background: scrollDrag ? S.blue : S.blue + "cc",
              width: `${Math.max(10, thumbPct)}%`,
              left: `${scrollPct}%`,
              cursor: "grab", transition: scrollDrag ? "none" : "background 0.15s",
            }} />
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, padding: "4px 8px", fontSize: 9, color: S.dim, flexWrap: "wrap" }}>
        <span>Chart: <span style={{ color: S.text }}>{CHART_TYPES.find(t => t.id === chartType)?.label}</span></span>
        <span>TF: <span style={{ color: S.text, ...mono }}>{timeframe}</span></span>
        <span>Data: <span style={{ color: isRealData ? S.green : S.amber }}>{isRealData ? "Real OHLC" : "Synthetic"}</span></span>
        <span>Candles: <span style={{ color: S.text, ...mono }}>{(isCandleType ? visibleCandles.length : visibleClosePrices.length)}</span></span>
        <span>Zoom: <span style={{ color: S.amber, ...mono }}>{(zoom).toFixed(1)}x</span></span>
        {overlays.map(ov => {
          const o = OVERLAYS.find(x => x.id === ov);
          return o ? <span key={ov} style={{ color: o.color }}>-- {o.label}</span> : null;
        })}
      </div>
    </div>
  );
}
