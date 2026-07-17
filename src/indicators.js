/* ================================================================
   INDICATORS MODULE - Alpha Algo Trading Terminal
   All technical analysis indicator functions
   ================================================================ */

export const ema = (arr, p) => {
  if (arr.length < p) return null;
  const k = 2 / (p + 1);
  let e = arr.slice(0, p).reduce((a, b) => a + b, 0) / p;
  for (let i = p; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
  return parseFloat(e.toFixed(4));
};

export const calcRSI = arr => {
  if (arr.length < 2) return 50;
  let g = 0, l = 0;
  for (let i = 1; i < arr.length; i++) {
    const d = arr[i] - arr[i - 1];
    d > 0 ? g += d : l -= d;
  }
  return l === 0 ? 100 : parseFloat((100 - 100 / (1 + g / l)).toFixed(2));
};

export const calcMACD = arr => {
  if (arr.length < 26) return null;
  const e12 = ema(arr, 12), e26 = ema(arr, 26);
  if (!e12 || !e26) return null;
  const macd = parseFloat((e12 - e26).toFixed(4));
  return { macd, signal: 0, hist: macd };
};

export const calcBB = (arr, p = 20) => {
  if (arr.length < p) return null;
  const sl = arr.slice(-p);
  const mn = sl.reduce((a, b) => a + b, 0) / p;
  const std = Math.sqrt(sl.reduce((a, b) => a + Math.pow(b - mn, 2), 0) / p);
  return {
    upper: parseFloat((mn + 2 * std).toFixed(4)),
    mid: parseFloat(mn.toFixed(4)),
    lower: parseFloat((mn - 2 * std).toFixed(4)),
    bw: parseFloat((4 * std / mn * 100).toFixed(2))
  };
};

export const calcStoch = arr => {
  if (arr.length < 28) return null;
  const rsis = [];
  for (let i = 14; i <= arr.length; i++) {
    const s = arr.slice(i - 14, i);
    let g = 0, l = 0;
    for (let j = 1; j < s.length; j++) {
      const d = s[j] - s[j - 1];
      d > 0 ? g += d : l -= d;
    }
    rsis.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  }
  if (rsis.length < 14) return null;
  const sl = rsis.slice(-14), mn = Math.min(...sl), mx = Math.max(...sl), rng = mx - mn;
  return rng === 0 ? 50 : parseFloat(((rsis[rsis.length - 1] - mn) / rng * 100).toFixed(2));
};

export const calcADX = (arr, p = 14) => {
  if (arr.length < p * 2 + 1) return null;
  const tr = [], pdm = [], ndm = [];
  for (let i = 1; i < arr.length; i++) {
    const h = arr[i], l = arr[i], ph = arr[i - 1], pl = arr[i - 1];
    tr.push(Math.max(Math.abs(h - l), Math.abs(h - pl), Math.abs(l - pl)));
    const up = h - ph, dn = pl - l;
    pdm.push(up > dn && up > 0 ? up : 0);
    ndm.push(dn > up && dn > 0 ? dn : 0);
  }
  if (tr.length < p) return null;
  let atr = tr.slice(0, p).reduce((a, b) => a + b, 0) / p;
  let apdm = pdm.slice(0, p).reduce((a, b) => a + b, 0) / p;
  let andm = ndm.slice(0, p).reduce((a, b) => a + b, 0) / p;
  const dx = [];
  for (let i = p; i < tr.length; i++) {
    atr = (atr * (p - 1) + tr[i]) / p;
    apdm = (apdm * (p - 1) + pdm[i]) / p;
    andm = (andm * (p - 1) + ndm[i]) / p;
    const pdi = atr ? apdm / atr * 100 : 0, ndi = atr ? andm / atr * 100 : 0;
    const sum = pdi + ndi;
    dx.push(sum ? Math.abs(pdi - ndi) / sum * 100 : 0);
  }
  if (dx.length < p) return null;
  let adx = dx.slice(0, p).reduce((a, b) => a + b, 0) / p;
  for (let i = p; i < dx.length; i++) adx = (adx * (p - 1) + dx[i]) / p;
  const lastPDI = atr ? apdm / atr * 100 : 0, lastNDI = atr ? andm / atr * 100 : 0;
  return {
    adx: parseFloat(adx.toFixed(2)),
    pdi: parseFloat(lastPDI.toFixed(2)),
    ndi: parseFloat(lastNDI.toFixed(2)),
    trend: adx > 25 ? "STRONG" : adx > 20 ? "MODERATE" : "WEAK",
    bull: lastPDI > lastNDI
  };
};

export const calcAlphaTrend = (arr, p = 14, mult = 1) => {
  if (arr.length < p + 2) return null;
  const rsi = arr.length >= p ? calcRSI(arr.slice(-p)) : 50;
  const sl = arr.slice(-p), mn = Math.min(...sl), mx = Math.max(...sl), atr = (mx - mn) / p;
  const price = arr[arr.length - 1];
  const upT = price - atr * mult, dnT = price + atr * mult;
  const trend = rsi >= 50 ? "BULL" : "BEAR";
  return {
    value: parseFloat((trend === "BULL" ? upT : dnT).toFixed(4)),
    trend, rsi: parseFloat(rsi.toFixed(1)),
    atr: parseFloat(atr.toFixed(4)),
    signal: trend === "BULL" && price > upT ? "BUY" : trend === "BEAR" && price < dnT ? "SELL" : "HOLD"
  };
};

export const calcBOP = arr => {
  if (arr.length < 4) return null;
  const bops = [];
  for (let i = 1; i < arr.length; i++) {
    const range = Math.max(arr[i], arr[i - 1]) - Math.min(arr[i], arr[i - 1]);
    bops.push(range ? ((arr[i] - arr[i - 1]) / range) : 0);
  }
  const period = Math.min(14, bops.length);
  const avg = bops.slice(-period).reduce((a, b) => a + b, 0) / period;
  return {
    value: parseFloat(avg.toFixed(4)),
    signal: avg > 0.1 ? "BULL" : avg < -0.1 ? "BEAR" : "NEUTRAL",
    raw: parseFloat(bops[bops.length - 1].toFixed(4))
  };
};

export const calcHalfTrend = (arr, p = 2) => {
  if (arr.length < p * 4) return null;
  const sl = arr.slice(-(p * 4));
  const highs = [], lows = [];
  for (let i = 0; i <= sl.length - p; i++) {
    const chunk = sl.slice(i, i + p);
    highs.push(Math.max(...chunk));
    lows.push(Math.min(...chunk));
  }
  const currHigh = highs[highs.length - 1], prevHigh = highs[highs.length - 2] || currHigh;
  const currLow = lows[lows.length - 1], prevLow = lows[lows.length - 2] || currLow;
  const price = arr[arr.length - 1];
  const trend = price > prevHigh ? "UP" : price < prevLow ? "DOWN" : "FLAT";
  const ht = trend === "UP" ? currLow : trend === "DOWN" ? currHigh : (currHigh + currLow) / 2;
  return {
    value: parseFloat(ht.toFixed(4)), trend,
    signal: trend === "UP" ? "BUY" : trend === "DOWN" ? "SELL" : "HOLD",
    high: parseFloat(currHigh.toFixed(4)), low: parseFloat(currLow.toFixed(4))
  };
};

export const calcIchimoku = arr => {
  if (arr.length < 52) return null;
  const periodHL = (a, p) => { const s = a.slice(-p); return { h: Math.max(...s), l: Math.min(...s) }; };
  const t9 = periodHL(arr, 9), k26 = periodHL(arr, 26), s52 = periodHL(arr, 52);
  const tenkan = (t9.h + t9.l) / 2, kijun = (k26.h + k26.l) / 2;
  const senkouA = (tenkan + kijun) / 2, senkouB = (s52.h + s52.l) / 2;
  const price = arr[arr.length - 1];
  const aboveCloud = price > Math.max(senkouA, senkouB), belowCloud = price < Math.min(senkouA, senkouB);
  const tkCross = tenkan > kijun ? "BULL" : "BEAR";
  return {
    tenkan: parseFloat(tenkan.toFixed(4)), kijun: parseFloat(kijun.toFixed(4)),
    senkouA: parseFloat(senkouA.toFixed(4)), senkouB: parseFloat(senkouB.toFixed(4)),
    chikou: parseFloat(arr[arr.length - 1].toFixed(4)),
    signal: aboveCloud && tkCross === "BULL" ? "STRONG BUY" : belowCloud && tkCross === "BEAR" ? "STRONG SELL" : tkCross === "BULL" ? "BUY" : "SELL",
    cloud: aboveCloud ? "ABOVE" : belowCloud ? "BELOW" : "INSIDE", tkCross
  };
};

export const calcMARibbon = arr => {
  if (arr.length < 55) return null;
  const periods = [8, 13, 21, 34, 55];
  const emas = periods.map(p => ({ p, v: ema(arr, p) })).filter(e => e.v != null);
  if (emas.length < 3) return null;
  const allBull = emas.every((e, i) => i === 0 || e.v <= emas[i - 1].v);
  const allBear = emas.every((e, i) => i === 0 || e.v >= emas[i - 1].v);
  const spread = emas.length >= 2 ? Math.abs(emas[0].v - emas[emas.length - 1].v) / arr[arr.length - 1] * 100 : 0;
  return { emas, trend: allBull ? "STRONG BULL" : allBear ? "STRONG BEAR" : "MIXED", spread: parseFloat(spread.toFixed(3)), expanding: spread > 0.5 };
};

export const calcRSIMulti = arr => {
  if (arr.length < 21) return null;
  const r7 = arr.length >= 7 ? calcRSI(arr.slice(-7)) : null;
  const r14 = arr.length >= 14 ? calcRSI(arr.slice(-14)) : null;
  const r21 = arr.length >= 21 ? calcRSI(arr.slice(-21)) : null;
  const avg = [r7, r14, r21].filter(v => v != null);
  const mean = avg.reduce((a, b) => a + b, 0) / avg.length;
  const allOver = avg.every(v => v > 60), allUnder = avg.every(v => v < 40);
  return { r7, r14, r21, avg: parseFloat(mean.toFixed(1)), signal: allOver ? "OVERBOUGHT" : allUnder ? "OVERSOLD" : "NEUTRAL", confluence: allOver || allUnder };
};

export const calcRSIDivergence = arr => {
  if (arr.length < 30) return null;
  const half = Math.floor(arr.length / 2);
  const p1 = arr.slice(0, half), p2 = arr.slice(half);
  const rsi1 = calcRSI(p1.slice(-14)), rsi2 = calcRSI(p2.slice(-14));
  const price1 = p1[p1.length - 1], price2 = p2[p2.length - 1];
  const bullDiv = price2 < price1 && rsi2 > rsi1;
  const bearDiv = price2 > price1 && rsi2 < rsi1;
  return { bullish: bullDiv, bearish: bearDiv, type: bullDiv ? "BULL DIV" : bearDiv ? "BEAR DIV" : "NONE", rsiFirst: parseFloat(rsi1.toFixed(1)), rsiLast: parseFloat(rsi2.toFixed(1)) };
};

export const calcSSL = (arr, p = 10) => {
  if (arr.length < p + 1) return null;
  const smaH = (a, n) => { const s = a.slice(-n); return s.reduce((x, y) => x + y, 0) / n; };
  const highs = arr.map((v, i) => i > 0 ? Math.max(v, arr[i - 1]) : v);
  const lows = arr.map((v, i) => i > 0 ? Math.min(v, arr[i - 1]) : v);
  const sslUp = smaH(highs, p), sslDn = smaH(lows, p);
  const price = arr[arr.length - 1];
  const trend = price > sslUp ? "BULL" : price < sslDn ? "BEAR" : "NEUTRAL";
  return { up: parseFloat(sslUp.toFixed(4)), down: parseFloat(sslDn.toFixed(4)), trend, signal: trend === "BULL" ? "BUY" : trend === "BEAR" ? "SELL" : "HOLD", channel: parseFloat((sslUp - sslDn).toFixed(4)) };
};

export const calcTDFI = (arr, p = 13) => {
  if (arr.length < p + 2) return null;
  const mf = [];
  for (let i = 1; i < arr.length; i++) mf.push(arr[i] * arr[i] - arr[i - 1] * arr[i - 1]);
  if (mf.length < p) return null;
  let smf = mf.slice(0, p).reduce((a, b) => a + b, 0) / p;
  for (let i = p; i < mf.length; i++) smf = (smf * (p - 1) + mf[i]) / p;
  const maxMF = Math.max(...mf.slice(-p).map(Math.abs)) || 1;
  const ntdfi = smf / maxMF;
  return { value: parseFloat(ntdfi.toFixed(4)), signal: ntdfi > 0.05 ? "BUY" : ntdfi < -0.05 ? "SELL" : "NEUTRAL", strength: Math.abs(ntdfi) > 0.5 ? "STRONG" : Math.abs(ntdfi) > 0.2 ? "MODERATE" : "WEAK" };
};

export const calcVolume = (vol, arr) => {
  if (!vol || arr.length < 5) return null;
  const price = arr[arr.length - 1], prev = arr[arr.length - 2];
  const priceChg = prev ? (price - prev) / prev * 100 : 0;
  return { vol, trend: priceChg > 0 && vol > 0 ? "BULL VOL" : priceChg < 0 && vol > 0 ? "BEAR VOL" : "LOW", priceChg: parseFloat(priceChg.toFixed(3)) };
};

export const calcFractals = arr => {
  if (arr.length < 5) return null;
  const ups = [], dns = [];
  for (let i = 2; i < arr.length - 2; i++) {
    if (arr[i] > arr[i - 1] && arr[i] > arr[i - 2] && arr[i] > arr[i + 1] && arr[i] > arr[i + 2]) ups.push({ idx: i, val: arr[i] });
    if (arr[i] < arr[i - 1] && arr[i] < arr[i - 2] && arr[i] < arr[i + 1] && arr[i] < arr[i + 2]) dns.push({ idx: i, val: arr[i] });
  }
  const lastUp = ups.length ? ups[ups.length - 1] : null;
  const lastDn = dns.length ? dns[dns.length - 1] : null;
  const price = arr[arr.length - 1];
  return {
    upFractal: lastUp?.val || null, dnFractal: lastDn?.val || null,
    upCount: ups.length, dnCount: dns.length,
    signal: lastUp && price > lastUp.val ? "BREAK UP" : lastDn && price < lastDn.val ? "BREAK DN" : "INSIDE"
  };
};

export const calcZigZag = (arr, pct = 1) => {
  if (arr.length < 5) return null;
  const pivots = [{ idx: 0, val: arr[0], type: "L" }];
  let lastPivot = pivots[0], dir = 1;
  for (let i = 1; i < arr.length; i++) {
    const chg = (arr[i] - lastPivot.val) / lastPivot.val * 100;
    if (dir === 1 && chg < -pct) { pivots.push({ idx: i, val: arr[i], type: "L" }); lastPivot = pivots[pivots.length - 1]; dir = -1; }
    else if (dir === -1 && chg > pct) { pivots.push({ idx: i, val: arr[i], type: "H" }); lastPivot = pivots[pivots.length - 1]; dir = 1; }
    else if (dir === 1 && arr[i] > lastPivot.val) { lastPivot.val = arr[i]; lastPivot.idx = i; }
    else if (dir === -1 && arr[i] < lastPivot.val) { lastPivot.val = arr[i]; lastPivot.idx = i; }
  }
  const last2 = pivots.slice(-2);
  const swing = last2.length === 2 ? Math.abs(last2[1].val - last2[0].val) / last2[0].val * 100 : 0;
  return { pivots: pivots.length, lastPivot: pivots[pivots.length - 1], swing: parseFloat(swing.toFixed(2)), trend: dir === 1 ? "UP" : "DOWN", depth: pivots.length };
};

export const calcScalp = arr => {
  if (arr.length < 20) return null;
  const rsi = calcRSI(arr.slice(-14));
  const e5 = ema(arr, 5), e13 = ema(arr, 13);
  if (!e5 || !e13) return null;
  const macdFast = e5 - e13;
  const price = arr[arr.length - 1];
  const momentum = (price - arr[arr.length - 5]) / arr[arr.length - 5] * 100;
  const score = (rsi < 30 ? 2 : rsi > 70 ? -2 : 0) + (macdFast > 0 ? 1 : -1) + (momentum > 0.3 ? 1 : momentum < -0.3 ? -1 : 0);
  return { signal: score >= 2 ? "SCALP BUY" : score <= -2 ? "SCALP SELL" : "NO SETUP", score, rsi: parseFloat(rsi.toFixed(1)), macdFast: parseFloat(macdFast.toFixed(4)), momentum: parseFloat(momentum.toFixed(3)) };
};

export const calcPhysicalLevels = price => {
  if (!price) return null;
  const mag = Math.pow(10, Math.floor(Math.log10(price)) - 1);
  const base = Math.floor(price / mag) * mag;
  const levels = [];
  for (let i = -3; i <= 3; i++) { if (i === 0) continue; levels.push(parseFloat((base + i * mag).toFixed(2))); }
  const nearest = levels.reduce((best, l) => Math.abs(l - price) < Math.abs(best - price) ? l : best, levels[0]);
  const dist = Math.abs(price - nearest) / price * 100;
  return { levels, nearest, dist: parseFloat(dist.toFixed(3)), support: levels.filter(l => l < price).pop() || null, resistance: levels.find(l => l > price) || null };
};

/* ================================================================
   COMMUNITY INDICATORS - Additional
   ================================================================ */

/* Chimera [theUltimator5] - Multi-indicator confluence system
   Combines RSI, MACD, BB, and Volume into a single composite score */
export const calcChimera = (arr, price, vol) => {
  if (!arr || arr.length < 26) return null;
  const rsi = calcRSI(arr.slice(-14));
  const macd = calcMACD(arr);
  const bb = calcBB(arr);
  if (!macd || !bb) return null;

  // Score components: RSI zone + MACD direction + BB position + Volume
  let score = 0;
  if (rsi < 30) score += 2; else if (rsi < 40) score += 1;
  else if (rsi > 70) score -= 2; else if (rsi > 60) score -= 1;
  if (macd.hist > 0) score += 1; else score -= 1;
  if (price < bb.lower) score += 2; else if (price > bb.upper) score -= 2;
  else if (price < bb.mid) score += 0.5; else score -= 0.5;

  const maxScore = 5;
  const normalized = score / maxScore; // -1 to 1
  const signal = normalized > 0.4 ? "STRONG BUY" : normalized > 0.15 ? "BUY" :
    normalized < -0.4 ? "STRONG SELL" : normalized < -0.15 ? "SELL" : "NEUTRAL";
  const trend = score > 0 ? "BULL" : score < 0 ? "BEAR" : "NEUTRAL";

  return { score: parseFloat(score.toFixed(2)), normalized: parseFloat(normalized.toFixed(3)), signal, trend, rsi: parseFloat(rsi.toFixed(1)), macdVal: macd.hist };
};

/* RSI HistoAlert Strategy - HPotter
   RSI displayed as histogram with color-coded alert zones */
export const calcRSIHistoAlert = arr => {
  if (!arr || arr.length < 21) return null;
  const r14 = calcRSI(arr.slice(-14));
  const r7 = calcRSI(arr.slice(-7));
  const r21 = calcRSI(arr.slice(-21));

  // Histogram value = RSI - 50 (centered)
  const histValue = r14 - 50;
  const momentum = r7 - r14; // Short-term momentum

  // Alert zones
  let zone = "NEUTRAL";
  if (r14 > 70 && momentum < 0) zone = "SELL ALERT";
  else if (r14 < 30 && momentum > 0) zone = "BUY ALERT";
  else if (r14 > 80) zone = "EXTREME HIGH";
  else if (r14 < 20) zone = "EXTREME LOW";

  const signal = zone.includes("BUY") ? "BUY" : zone.includes("SELL") ? "SELL" : "HOLD";
  const color = r14 > 70 ? "RED" : r14 > 50 ? "LIME" : r14 > 30 ? "ORANGE" : "RED";

  return { rsi: parseFloat(r14.toFixed(1)), histogram: parseFloat(histValue.toFixed(2)), momentum: parseFloat(momentum.toFixed(2)), zone, signal, color, r7: parseFloat(r7.toFixed(1)), r21: parseFloat(r21.toFixed(1)) };
};

/* ADX & DI Histogram - by scarf
   Displays ADX with +DI/-DI as histogram bars for visual trend strength */
export const calcADXDIHist = (arr, p = 14) => {
  const adx = calcADX(arr, p);
  if (!adx) return null;

  const diDiff = adx.pdi - adx.ndi;
  const diSum = adx.pdi + adx.ndi;
  const diRatio = diSum > 0 ? diDiff / diSum : 0;

  // Histogram: positive = bullish, negative = bearish, height = ADX strength
  const histValue = diRatio * adx.adx;
  const trendStrength = adx.adx > 25 ? "STRONG" : adx.adx > 20 ? "MODERATE" : "WEAK";
  const signal = adx.adx > 20 && diDiff > 5 ? "BUY" : adx.adx > 20 && diDiff < -5 ? "SELL" : "NEUTRAL";

  return {
    adx: adx.adx, pdi: adx.pdi, ndi: adx.ndi,
    histogram: parseFloat(histValue.toFixed(2)),
    diDiff: parseFloat(diDiff.toFixed(2)),
    trendStrength, signal, bull: adx.bull
  };
};

/* DBtrade - by tradedb56
   Double-bottom/top detection with EMA confirmation */
export const calcDBtrade = arr => {
  if (!arr || arr.length < 30) return null;
  const price = arr[arr.length - 1];
  const e20 = ema(arr, 20);
  if (!e20) return null;

  // Find recent lows and highs
  const recent = arr.slice(-20);
  const lows = [], highs = [];
  for (let i = 1; i < recent.length - 1; i++) {
    if (recent[i] < recent[i - 1] && recent[i] < recent[i + 1]) lows.push({ idx: i, val: recent[i] });
    if (recent[i] > recent[i - 1] && recent[i] > recent[i + 1]) highs.push({ idx: i, val: recent[i] });
  }

  // Double bottom: two similar lows with price now above EMA
  let dbBottom = false, dbTop = false;
  if (lows.length >= 2) {
    const l1 = lows[lows.length - 2], l2 = lows[lows.length - 1];
    if (Math.abs(l1.val - l2.val) / l1.val < 0.015 && price > e20) dbBottom = true;
  }
  // Double top: two similar highs with price now below EMA
  if (highs.length >= 2) {
    const h1 = highs[highs.length - 2], h2 = highs[highs.length - 1];
    if (Math.abs(h1.val - h2.val) / h1.val < 0.015 && price < e20) dbTop = true;
  }

  const aboveEMA = price > e20;
  const signal = dbBottom ? "DOUBLE BOTTOM" : dbTop ? "DOUBLE TOP" : aboveEMA ? "BULL" : "BEAR";
  const dir = dbBottom ? "BUY" : dbTop ? "SELL" : aboveEMA ? "BUY" : "SELL";

  return { signal, dir, dbBottom, dbTop, aboveEMA, ema20: parseFloat(e20.toFixed(4)), price, lows: lows.length, highs: highs.length };
};

/* [SS]_TrendAVGZone - by SatoShinobi
   Trend zone detection using multiple moving averages to define bull/bear/transition zones */
export const calcTrendAVGZone = arr => {
  if (!arr || arr.length < 50) return null;
  const price = arr[arr.length - 1];
  const e10 = ema(arr, 10), e20 = ema(arr, 20), e50 = ema(arr, 50);
  if (!e10 || !e20 || !e50) return null;

  // Zone classification
  let zone, signal;
  if (price > e10 && e10 > e20 && e20 > e50) { zone = "STRONG BULL"; signal = "BUY"; }
  else if (price > e20 && e20 > e50) { zone = "BULL"; signal = "BUY"; }
  else if (price < e10 && e10 < e20 && e20 < e50) { zone = "STRONG BEAR"; signal = "SELL"; }
  else if (price < e20 && e20 < e50) { zone = "BEAR"; signal = "SELL"; }
  else if (price > e20) { zone = "TRANSITION BULL"; signal = "HOLD"; }
  else { zone = "TRANSITION BEAR"; signal = "HOLD"; }

  const spread = Math.abs(e10 - e50) / price * 100;
  const expanding = Math.abs(e10 - e20) > Math.abs(e20 - e50);

  return { zone, signal, e10: parseFloat(e10.toFixed(4)), e20: parseFloat(e20.toFixed(4)), e50: parseFloat(e50.toFixed(4)), spread: parseFloat(spread.toFixed(3)), expanding };
};

/* Mars Signals SSL - by MarsSignals
   Enhanced SSL with additional filtering: SSL channel + EMA trend + RSI filter */
export const calcMarsSSL = (arr, p = 10) => {
  if (!arr || arr.length < p + 14) return null;
  const ssl = calcSSL(arr, p);
  if (!ssl) return null;

  const rsi = calcRSI(arr.slice(-14));
  const e20 = ema(arr, 20);
  const price = arr[arr.length - 1];

  // Mars enhancement: combine SSL with RSI and EMA filters
  let marsSignal = "NEUTRAL";
  let confidence = 0;

  if (ssl.trend === "BULL" && price > (e20 || 0) && rsi > 40 && rsi < 70) {
    marsSignal = "STRONG BUY"; confidence = 90;
  } else if (ssl.trend === "BULL" && rsi > 40) {
    marsSignal = "BUY"; confidence = 65;
  } else if (ssl.trend === "BEAR" && price < (e20 || Infinity) && rsi < 60 && rsi > 30) {
    marsSignal = "STRONG SELL"; confidence = 90;
  } else if (ssl.trend === "BEAR" && rsi < 60) {
    marsSignal = "SELL"; confidence = 65;
  }

  return { ...ssl, marsSignal, confidence, rsiFilter: parseFloat(rsi.toFixed(1)), ema20: e20 ? parseFloat(e20.toFixed(4)) : null };
};

/* POWER OF STOCK'S - by AmarsinghShi
   Comprehensive power indicator combining multiple technical factors into a single power score */
export const calcPowerOfStocks = arr => {
  if (!arr || arr.length < 30) return null;
  const price = arr[arr.length - 1];
  const rsi = calcRSI(arr.slice(-14));
  const e9 = ema(arr, 9), e21 = ema(arr, 21);
  const macd = calcMACD(arr);
  if (!e9 || !e21) return null;

  // Power components (each 0-20, total 0-100)
  const rsiPower = rsi < 30 ? 18 : rsi < 40 ? 14 : rsi > 70 ? 2 : rsi > 60 ? 6 : 10;
  const emaPower = price > e9 && e9 > e21 ? 20 : price > e21 ? 14 : price < e9 && e9 < e21 ? 0 : 6;
  const macdPower = macd ? (macd.hist > 0 ? Math.min(20, macd.hist * 200 + 10) : Math.max(0, 10 + macd.hist * 200)) : 10;

  // Momentum: rate of change over 5 periods
  const roc5 = arr.length >= 5 ? (price - arr[arr.length - 5]) / arr[arr.length - 5] * 100 : 0;
  const momPower = roc5 > 2 ? 20 : roc5 > 0.5 ? 14 : roc5 < -2 ? 0 : roc5 < -0.5 ? 6 : 10;

  // Volatility: current range vs average
  const recent10 = arr.slice(-10);
  const range = (Math.max(...recent10) - Math.min(...recent10)) / price * 100;
  const volPower = range > 3 ? 16 : range > 1.5 ? 12 : range < 0.5 ? 6 : 10;

  const totalPower = parseFloat((rsiPower + emaPower + macdPower + momPower + volPower).toFixed(0));
  const signal = totalPower >= 70 ? "STRONG BUY" : totalPower >= 55 ? "BUY" :
    totalPower <= 30 ? "STRONG SELL" : totalPower <= 45 ? "SELL" : "NEUTRAL";
  const grade = totalPower >= 80 ? "A+" : totalPower >= 70 ? "A" : totalPower >= 60 ? "B" :
    totalPower >= 50 ? "C" : totalPower >= 40 ? "D" : "F";

  return {
    power: totalPower, signal, grade,
    components: { rsi: rsiPower, ema: emaPower, macd: parseFloat(macdPower.toFixed(0)), momentum: momPower, volatility: volPower },
    roc5: parseFloat(roc5.toFixed(3)), range: parseFloat(range.toFixed(3))
  };
};

/* ================================================================
   VOLUME PROFILE - Distribution of volume across price levels
   Identifies Point of Control (POC), Value Area High/Low
   ================================================================ */
export const calcVolumeProfile = (arr, bins = 20) => {
  if (!arr || arr.length < 20) return null;
  const mn = Math.min(...arr), mx = Math.max(...arr);
  const range = mx - mn;
  if (range === 0) return null;
  const binSize = range / bins;
  const profile = new Array(bins).fill(0);
  const levels = [];

  // Count ticks at each price level (simulates volume distribution)
  arr.forEach((p) => {
    const idx = Math.min(bins - 1, Math.floor((p - mn) / binSize));
    profile[idx]++;
  });

  // Find POC (highest volume level)
  let pocIdx = 0, maxVol = 0;
  profile.forEach((v, i) => { if (v > maxVol) { maxVol = v; pocIdx = i; } });
  const poc = mn + (pocIdx + 0.5) * binSize;

  // Value Area: 70% of volume around POC
  const totalVol = profile.reduce((a, b) => a + b, 0);
  const vaTarget = totalVol * 0.7;
  let vaVol = profile[pocIdx], lo = pocIdx, hi = pocIdx;
  while (vaVol < vaTarget && (lo > 0 || hi < bins - 1)) {
    const below = lo > 0 ? profile[lo - 1] : 0;
    const above = hi < bins - 1 ? profile[hi + 1] : 0;
    if (below >= above && lo > 0) { lo--; vaVol += profile[lo]; }
    else if (hi < bins - 1) { hi++; vaVol += profile[hi]; }
    else if (lo > 0) { lo--; vaVol += profile[lo]; }
    else break;
  }
  const vah = mn + (hi + 1) * binSize;
  const val = mn + lo * binSize;
  const price = arr[arr.length - 1];

  // Generate levels for display
  for (let i = 0; i < bins; i++) {
    levels.push({ price: mn + (i + 0.5) * binSize, volume: profile[i], pct: profile[i] / maxVol });
  }

  // Signal: price near POC = consolidation, outside VA = potential reversal
  let signal = "NEUTRAL", zone = "VALUE AREA";
  if (price > vah) { signal = "ABOVE VA"; zone = "OVERBOUGHT ZONE"; }
  else if (price < val) { signal = "BELOW VA"; zone = "OVERSOLD ZONE"; }
  else if (Math.abs(price - poc) / price < 0.003) { signal = "AT POC"; zone = "CONSOLIDATION"; }

  return {
    poc: parseFloat(poc.toFixed(4)), vah: parseFloat(vah.toFixed(4)), val: parseFloat(val.toFixed(4)),
    levels, signal, zone,
    aboveVA: price > vah, belowVA: price < val,
    pocDist: parseFloat((Math.abs(price - poc) / price * 100).toFixed(3)),
  };
};

/* ================================================================
   SMART MONEY CONCEPT (SMC) - Institutional trading patterns
   Detects: Order Blocks, Fair Value Gaps, Break of Structure, 
   Change of Character
   ================================================================ */
export const calcSMC = (arr) => {
  if (!arr || arr.length < 30) return null;
  const price = arr[arr.length - 1];

  // --- Break of Structure (BOS) ---
  // Find recent swing highs and lows
  const swingH = [], swingL = [];
  for (let i = 2; i < arr.length - 2; i++) {
    if (arr[i] > arr[i - 1] && arr[i] > arr[i - 2] && arr[i] > arr[i + 1] && arr[i] > arr[i + 2]) swingH.push({ idx: i, val: arr[i] });
    if (arr[i] < arr[i - 1] && arr[i] < arr[i - 2] && arr[i] < arr[i + 1] && arr[i] < arr[i + 2]) swingL.push({ idx: i, val: arr[i] });
  }

  let bos = "NONE", bosDir = null;
  if (swingH.length >= 2) {
    const lastH = swingH[swingH.length - 1], prevH = swingH[swingH.length - 2];
    if (price > lastH.val && lastH.val > prevH.val) { bos = "BULLISH BOS"; bosDir = "LONG"; }
    if (price < swingL[swingL.length - 1]?.val && swingL.length >= 2) { bos = "BEARISH BOS"; bosDir = "SHORT"; }
  }

  // --- Change of Character (ChoCH) ---
  let choch = "NONE", chochDir = null;
  if (swingH.length >= 2 && swingL.length >= 2) {
    const lastH = swingH[swingH.length - 1], prevH = swingH[swingH.length - 2];
    const lastL = swingL[swingL.length - 1], prevL = swingL[swingL.length - 2];
    // Bullish ChoCH: lower lows then break above last swing high
    if (lastL.val < prevL.val && price > lastH.val) { choch = "BULLISH CHOCH"; chochDir = "LONG"; }
    // Bearish ChoCH: higher highs then break below last swing low
    if (lastH.val > prevH.val && price < lastL.val) { choch = "BEARISH CHOCH"; chochDir = "SHORT"; }
  }

  // --- Order Blocks (OB) ---
  // Bullish OB: last bearish candle before a strong bullish move
  // Bearish OB: last bullish candle before a strong bearish move
  let bullOB = null, bearOB = null;
  const recent = arr.slice(-20);
  for (let i = 1; i < recent.length - 3; i++) {
    const move = (recent[i + 3] - recent[i]) / recent[i] * 100;
    if (recent[i] < recent[i - 1] && move > 0.5) {
      bullOB = { price: recent[i], strength: Math.abs(move) };
    }
    if (recent[i] > recent[i - 1] && move < -0.5) {
      bearOB = { price: recent[i], strength: Math.abs(move) };
    }
  }

  // --- Fair Value Gaps (FVG) ---
  let bullFVG = null, bearFVG = null;
  for (let i = 2; i < recent.length; i++) {
    const gapUp = recent[i] - recent[i - 2];
    const gapDn = recent[i - 2] - recent[i];
    if (gapUp > 0 && recent[i - 1] < recent[i - 2]) {
      bullFVG = { top: recent[i], bottom: recent[i - 2], size: parseFloat((gapUp / recent[i] * 100).toFixed(3)) };
    }
    if (gapDn > 0 && recent[i - 1] > recent[i - 2]) {
      bearFVG = { top: recent[i - 2], bottom: recent[i], size: parseFloat((gapDn / recent[i] * 100).toFixed(3)) };
    }
  }

  // Composite signal
  let signal = "NEUTRAL", confidence = 0;
  const bullSignals = [bosDir === "LONG", chochDir === "LONG", bullOB != null, bullFVG != null].filter(Boolean).length;
  const bearSignals = [bosDir === "SHORT", chochDir === "SHORT", bearOB != null, bearFVG != null].filter(Boolean).length;

  if (bullSignals >= 3) { signal = "STRONG BUY"; confidence = 85; }
  else if (bullSignals >= 2) { signal = "BUY"; confidence = 65; }
  else if (bearSignals >= 3) { signal = "STRONG SELL"; confidence = 85; }
  else if (bearSignals >= 2) { signal = "SELL"; confidence = 65; }

  return {
    bos, bosDir, choch, chochDir,
    bullOB, bearOB, bullFVG, bearFVG,
    signal, confidence,
    bullScore: bullSignals, bearScore: bearSignals,
    swingHighs: swingH.length, swingLows: swingL.length,
  };
};

/* Master indicator runner - runs ALL 28 indicators */
export const runAllIndicators = (arr, price, vol) => {
  const h = arr || [];
  return {
    /* Core (1-8) */
    adx: calcADX(h),
    bb: calcBB(h),
    macd: calcMACD(h),
    ema12: ema(h, 12),
    ema13: ema(h, 13),
    ema26: ema(h, 26),
    maRibbon: calcMARibbon(h),
    rsi: h.length >= 14 ? calcRSI(h.slice(-14)) : null,
    volume: calcVolume(vol, h),
    fractals: calcFractals(h),
    /* Community (9-26) */
    alphaTrend: calcAlphaTrend(h),
    halfTrend: calcHalfTrend(h),
    ssl: calcSSL(h),
    chimera: calcChimera(h, price, vol),
    tdfi: calcTDFI(h),
    rsiHistoAlert: calcRSIHistoAlert(h),
    scalp: calcScalp(h),
    adxDIHist: calcADXDIHist(h),
    rsiDiv: calcRSIDivergence(h),
    zigzag: calcZigZag(h),
    physLevels: calcPhysicalLevels(price),
    bop: calcBOP(h),
    dbtrade: calcDBtrade(h),
    rsiMulti: calcRSIMulti(h),
    trendAVGZone: calcTrendAVGZone(h),
    ichimoku: calcIchimoku(h),
    marsSSL: calcMarsSSL(h),
    powerOfStocks: calcPowerOfStocks(h),
    stoch: calcStoch(h),
    /* New (27-28) */
    volumeProfile: calcVolumeProfile(h),
    smc: calcSMC(h),
  };
};

/* Gann Square of Nine - Accurate Implementation
   The Square of Nine arranges numbers in a spiral. Key levels are found by:
   1. Take sqrt of price
   2. Add/subtract increments of 0.25 (each = 45 degrees on the square)
   3. Square the result to get support/resistance levels
   Full rotation (360 degrees) = sqrt(price) +/- 2.0
   Cardinal cross (90 degrees) = sqrt(price) +/- 0.5
   The 0.25 increment represents a 45-degree angle on the Gann wheel */
export const gannLevels = (p, n = 12) => {
  if (!p || p <= 0) return [];
  const sqrtP = Math.sqrt(p);
  const out = [];
  // Generate levels at every 45 degrees (0.25 sqrt increments)
  for (let i = -n; i <= n; i++) {
    if (i === 0) continue;
    const level = Math.pow(sqrtP + i * 0.25, 2);
    if (level > 0) out.push(parseFloat(level.toFixed(2)));
  }
  return out.sort((a, b) => a - b);
};

/* Gann Signal Generator - Improved accuracy
   Checks multiple Gann principles:
   1. Price proximity to Square of Nine levels (< 0.3% = strong)
   2. Time cycles: Gann emphasized specific calendar intervals
      - 90, 180, 270, 360 calendar days from year start
      - Natural dates: equinoxes (Mar 21, Sep 23), solstices (Jun 21, Dec 21)
   3. Price-time squaring: price change matching time elapsed
   4. Trend confirmation via RSI divergence */
export const gannSignal = (price, hist, chg) => {
  if (!price || price <= 0) return { dir: "WAIT", score: 0, checks: [false, false, false, false], rsi: 50, nearest: null, distPct: 99 };

  const levels = gannLevels(price);
  const above = levels.find(l => l > price) || null;
  const below = [...levels].reverse().find(l => l < price) || null;
  const nearest = above && below
    ? (Math.abs(above - price) < Math.abs(below - price) ? above : below)
    : above || below;
  const distPct = nearest ? Math.abs(price - nearest) / price * 100 : 99;

  // RSI calculation
  const rsi = hist?.length >= 14 ? calcRSI(hist.slice(-14)) : 50;

  // Time cycle check - Gann's key calendar angles
  const now = new Date();
  const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  // Check proximity to Gann cardinal dates (90-degree calendar intervals)
  const gannDates = [1, 45, 90, 135, 180, 225, 270, 315, 360];
  const inTimeCycle = gannDates.some(c => Math.abs(doy - c) <= 3);

  // Price-time squaring: significant if sqrt(price) is near a whole or half number
  const sqrtP = Math.sqrt(price);
  const sqrtFrac = sqrtP - Math.floor(sqrtP);
  const isSquared = sqrtFrac < 0.05 || sqrtFrac > 0.95 || Math.abs(sqrtFrac - 0.5) < 0.05;

  // Momentum check
  const hasMomentum = Math.abs(chg || 0) > 0.8;

  const checks = [
    distPct <= 0.3,      // Price near Gann level
    inTimeCycle,          // Time cycle alignment
    rsi < 32 || rsi > 68, // RSI at extremes
    isSquared && hasMomentum // Price-time square with momentum
  ];
  const score = checks.filter(Boolean).length;

  // Direction: need at least 2 conditions met
  let dir = "WAIT";
  if (score >= 2) {
    if (rsi < 40 || (chg || 0) < -0.5) dir = "LONG";   // Oversold = buy signal
    else if (rsi > 60 || (chg || 0) > 0.5) dir = "SHORT"; // Overbought = sell signal
    else dir = score >= 3 ? (distPct <= 0.3 && price < nearest ? "LONG" : "SHORT") : "WAIT";
  }

  return { dir, score, checks, rsi: rsi.toFixed(1), nearest, distPct: distPct.toFixed(3), above, below, levels, doy, isSquared, inTimeCycle };
};

/* Best indicator picker for auto-trader */
/* Full indicator name registry - all 28 indicators */
export const INDICATOR_NAMES = [
  /* Core (1-8) */
  "ADX", "Bollinger", "MACD", "EMA Cross", "MA Ribbon", "RSI", "Volume", "Fractals",
  /* Community (9-26) */
  "AlphaTrend", "HalfTrend", "SSL Hybrid", "Chimera", "TDFI",
  "RSI HistoAlert", "Scalp 5min", "ADX DI Hist", "RSI Divergence",
  "ZigZag++", "Physical Levels", "Balance of Power", "DBtrade",
  "RSI Multi-TF", "TrendAVGZone", "Ichimoku", "Mars SSL",
  "Power of Stocks", "StochRSI", "Gann",
  /* New (27-28) */
  "Volume Profile", "Smart Money"
];

/* Best indicator picker for auto-trader - considers ALL 28 indicators */
export const getAllSignals = (ind, gann, price, sents, symbol) => {
  const signals = [];

  /* Core indicators */
  if (ind.rsi != null) {
    if (ind.rsi < 32) signals.push({ name: "RSI", dir: "LONG", strength: 70 - ind.rsi, score: 1.7 });
    if (ind.rsi > 68) signals.push({ name: "RSI", dir: "SHORT", strength: ind.rsi - 30, score: 1.7 });
  }
  if (ind.macd) signals.push({ name: "MACD", dir: ind.macd.hist > 0 ? "LONG" : "SHORT", strength: Math.abs(ind.macd.hist) * 100, score: 1.5 });
  if (ind.bb) {
    if (price < ind.bb.lower) signals.push({ name: "Bollinger", dir: "LONG", strength: (ind.bb.lower - price) / price * 1000, score: 1.5 });
    if (price > ind.bb.upper) signals.push({ name: "Bollinger", dir: "SHORT", strength: (price - ind.bb.upper) / price * 1000, score: 1.5 });
  }
  if (ind.stoch != null) {
    if (ind.stoch < 20) signals.push({ name: "StochRSI", dir: "LONG", strength: 20 - ind.stoch, score: 1.2 });
    if (ind.stoch > 80) signals.push({ name: "StochRSI", dir: "SHORT", strength: ind.stoch - 80, score: 1.2 });
  }
  if (ind.ema12 && ind.ema26) signals.push({ name: "EMA Cross", dir: ind.ema12 > ind.ema26 ? "LONG" : "SHORT", strength: Math.abs(ind.ema12 - ind.ema26) / price * 1000, score: 1.0 });
  if (ind.adx && ind.adx.trend !== "WEAK") signals.push({ name: "ADX", dir: ind.adx.bull ? "LONG" : "SHORT", strength: ind.adx.adx, score: 1.7 });
  if (ind.volume?.trend === "BULL VOL") signals.push({ name: "Volume", dir: "LONG", strength: Math.abs(ind.volume.priceChg) * 20, score: 0.8 });
  if (ind.volume?.trend === "BEAR VOL") signals.push({ name: "Volume", dir: "SHORT", strength: Math.abs(ind.volume.priceChg) * 20, score: 0.8 });
  if (ind.fractals?.signal === "BREAK UP") signals.push({ name: "Fractals", dir: "LONG", strength: 45, score: 1.3 });
  if (ind.fractals?.signal === "BREAK DN") signals.push({ name: "Fractals", dir: "SHORT", strength: 45, score: 1.3 });

  /* Community indicators */
  if (ind.alphaTrend?.signal === "BUY") signals.push({ name: "AlphaTrend", dir: "LONG", strength: ind.alphaTrend.rsi, score: 1.6 });
  if (ind.alphaTrend?.signal === "SELL") signals.push({ name: "AlphaTrend", dir: "SHORT", strength: 100 - ind.alphaTrend.rsi, score: 1.6 });
  if (ind.halfTrend?.signal === "BUY") signals.push({ name: "HalfTrend", dir: "LONG", strength: 50, score: 1.4 });
  if (ind.halfTrend?.signal === "SELL") signals.push({ name: "HalfTrend", dir: "SHORT", strength: 50, score: 1.4 });
  if (ind.ssl?.signal === "BUY") signals.push({ name: "SSL Hybrid", dir: "LONG", strength: ind.ssl.channel * 100, score: 1.8 });
  if (ind.ssl?.signal === "SELL") signals.push({ name: "SSL Hybrid", dir: "SHORT", strength: Math.abs(ind.ssl.channel) * 100, score: 1.8 });

  // Chimera
  if (ind.chimera?.signal?.includes("BUY")) signals.push({ name: "Chimera", dir: "LONG", strength: Math.abs(ind.chimera.score) * 20, score: ind.chimera.signal === "STRONG BUY" ? 2.0 : 1.5 });
  if (ind.chimera?.signal?.includes("SELL")) signals.push({ name: "Chimera", dir: "SHORT", strength: Math.abs(ind.chimera.score) * 20, score: ind.chimera.signal === "STRONG SELL" ? 2.0 : 1.5 });

  if (ind.tdfi?.signal === "BUY") signals.push({ name: "TDFI", dir: "LONG", strength: Math.abs(ind.tdfi.value) * 100, score: 1.6 });
  if (ind.tdfi?.signal === "SELL") signals.push({ name: "TDFI", dir: "SHORT", strength: Math.abs(ind.tdfi.value) * 100, score: 1.6 });

  // RSI HistoAlert
  if (ind.rsiHistoAlert?.signal === "BUY") signals.push({ name: "RSI HistoAlert", dir: "LONG", strength: Math.abs(ind.rsiHistoAlert.histogram) + 20, score: 1.6 });
  if (ind.rsiHistoAlert?.signal === "SELL") signals.push({ name: "RSI HistoAlert", dir: "SHORT", strength: Math.abs(ind.rsiHistoAlert.histogram) + 20, score: 1.6 });

  if (ind.scalp?.signal === "SCALP BUY") signals.push({ name: "Scalp 5min", dir: "LONG", strength: ind.scalp.score * 20, score: 1.9 });
  if (ind.scalp?.signal === "SCALP SELL") signals.push({ name: "Scalp 5min", dir: "SHORT", strength: Math.abs(ind.scalp.score) * 20, score: 1.9 });

  // ADX DI Histogram
  if (ind.adxDIHist?.signal === "BUY") signals.push({ name: "ADX DI Hist", dir: "LONG", strength: Math.abs(ind.adxDIHist.histogram), score: 1.5 });
  if (ind.adxDIHist?.signal === "SELL") signals.push({ name: "ADX DI Hist", dir: "SHORT", strength: Math.abs(ind.adxDIHist.histogram), score: 1.5 });

  // RSI Divergence
  if (ind.rsiDiv?.bullish) signals.push({ name: "RSI Divergence", dir: "LONG", strength: 55, score: 1.7 });
  if (ind.rsiDiv?.bearish) signals.push({ name: "RSI Divergence", dir: "SHORT", strength: 55, score: 1.7 });

  // ZigZag++
  if (ind.zigzag?.trend === "UP" && ind.zigzag.swing > 1) signals.push({ name: "ZigZag++", dir: "LONG", strength: ind.zigzag.swing * 10, score: 1.1 });
  if (ind.zigzag?.trend === "DOWN" && ind.zigzag.swing > 1) signals.push({ name: "ZigZag++", dir: "SHORT", strength: ind.zigzag.swing * 10, score: 1.1 });

  // Physical Levels
  if (ind.physLevels && ind.physLevels.dist < 0.5) {
    signals.push({ name: "Physical Levels", dir: price < ind.physLevels.nearest ? "LONG" : "SHORT", strength: (1 - ind.physLevels.dist / 0.5) * 40, score: 1.0 });
  }

  // Balance of Power
  if (ind.bop?.signal === "BULL") signals.push({ name: "Balance of Power", dir: "LONG", strength: Math.abs(ind.bop.value) * 80, score: 1.2 });
  if (ind.bop?.signal === "BEAR") signals.push({ name: "Balance of Power", dir: "SHORT", strength: Math.abs(ind.bop.value) * 80, score: 1.2 });

  // DBtrade
  if (ind.dbtrade?.signal === "DOUBLE BOTTOM") signals.push({ name: "DBtrade", dir: "LONG", strength: 70, score: 1.8 });
  else if (ind.dbtrade?.signal === "DOUBLE TOP") signals.push({ name: "DBtrade", dir: "SHORT", strength: 70, score: 1.8 });
  else if (ind.dbtrade?.dir === "BUY") signals.push({ name: "DBtrade", dir: "LONG", strength: 35, score: 1.0 });
  else if (ind.dbtrade?.dir === "SELL") signals.push({ name: "DBtrade", dir: "SHORT", strength: 35, score: 1.0 });

  // RSI Multi-TF
  if (ind.rsiMulti?.confluence && ind.rsiMulti?.signal === "OVERSOLD") signals.push({ name: "RSI Multi-TF", dir: "LONG", strength: 60, score: 1.8 });
  if (ind.rsiMulti?.confluence && ind.rsiMulti?.signal === "OVERBOUGHT") signals.push({ name: "RSI Multi-TF", dir: "SHORT", strength: 60, score: 1.8 });

  // TrendAVGZone
  if (ind.trendAVGZone?.signal === "BUY") signals.push({ name: "TrendAVGZone", dir: "LONG", strength: ind.trendAVGZone.zone.includes("STRONG") ? 75 : 45, score: ind.trendAVGZone.zone.includes("STRONG") ? 1.8 : 1.3 });
  if (ind.trendAVGZone?.signal === "SELL") signals.push({ name: "TrendAVGZone", dir: "SHORT", strength: ind.trendAVGZone.zone.includes("STRONG") ? 75 : 45, score: ind.trendAVGZone.zone.includes("STRONG") ? 1.8 : 1.3 });

  if (ind.ichimoku?.signal?.includes("BUY")) signals.push({ name: "Ichimoku", dir: "LONG", strength: 60, score: 1.4 });
  if (ind.ichimoku?.signal?.includes("SELL")) signals.push({ name: "Ichimoku", dir: "SHORT", strength: 60, score: 1.4 });

  // Mars SSL
  if (ind.marsSSL?.marsSignal?.includes("BUY")) signals.push({ name: "Mars SSL", dir: "LONG", strength: ind.marsSSL.confidence, score: ind.marsSSL.marsSignal === "STRONG BUY" ? 2.1 : 1.5 });
  if (ind.marsSSL?.marsSignal?.includes("SELL")) signals.push({ name: "Mars SSL", dir: "SHORT", strength: ind.marsSSL.confidence, score: ind.marsSSL.marsSignal === "STRONG SELL" ? 2.1 : 1.5 });

  // Power of Stocks
  if (ind.powerOfStocks?.signal?.includes("BUY")) signals.push({ name: "Power of Stocks", dir: "LONG", strength: ind.powerOfStocks.power, score: ind.powerOfStocks.signal === "STRONG BUY" ? 2.0 : 1.4 });
  if (ind.powerOfStocks?.signal?.includes("SELL")) signals.push({ name: "Power of Stocks", dir: "SHORT", strength: 100 - ind.powerOfStocks.power, score: ind.powerOfStocks.signal === "STRONG SELL" ? 2.0 : 1.4 });

  // MA Ribbon
  if (ind.maRibbon?.trend === "STRONG BULL" && ind.maRibbon.expanding) signals.push({ name: "MA Ribbon", dir: "LONG", strength: ind.maRibbon.spread * 20, score: 1.3 });
  if (ind.maRibbon?.trend === "STRONG BEAR" && ind.maRibbon.expanding) signals.push({ name: "MA Ribbon", dir: "SHORT", strength: ind.maRibbon.spread * 20, score: 1.3 });

  // Gann
  if (gann?.dir === "LONG") signals.push({ name: "Gann", dir: "LONG", strength: gann.score * 25, score: gann.score >= 3 ? 1.4 : 0.5 });
  if (gann?.dir === "SHORT") signals.push({ name: "Gann", dir: "SHORT", strength: gann.score * 25, score: gann.score >= 3 ? 1.4 : 0.5 });

  // Volume Profile
  if (ind.volumeProfile?.belowVA) signals.push({ name: "Volume Profile", dir: "LONG", strength: ind.volumeProfile.pocDist * 15, score: 1.4 });
  if (ind.volumeProfile?.aboveVA) signals.push({ name: "Volume Profile", dir: "SHORT", strength: ind.volumeProfile.pocDist * 15, score: 1.4 });

  // Smart Money Concept
  if (ind.smc?.signal?.includes("BUY")) signals.push({ name: "Smart Money", dir: "LONG", strength: ind.smc.confidence, score: ind.smc.signal === "STRONG BUY" ? 2.2 : 1.6 });
  if (ind.smc?.signal?.includes("SELL")) signals.push({ name: "Smart Money", dir: "SHORT", strength: ind.smc.confidence, score: ind.smc.signal === "STRONG SELL" ? 2.2 : 1.6 });

  if (signals.length === 0) return [];
  return signals;
};

export const pickBestIndicator = (ind, gann, price, sents, symbol) => {
  const signals = getAllSignals(ind, gann, price, sents, symbol);
  if (!signals || signals.length === 0) return null;
  signals.sort((a, b) => (b.score * b.strength) - (a.score * a.strength));
  return signals[0];
};

export const getMajoritySignal = (ind, gann, price, sents, symbol) => {
  const signals = getAllSignals(ind, gann, price, sents, symbol);
  if (!signals || signals.length < 5) return null;

  let longCount = 0;
  let shortCount = 0;
  signals.forEach(s => {
    if (s.dir === "LONG") longCount++;
    if (s.dir === "SHORT") shortCount++;
  });

  const total = signals.length;
  const longRatio = longCount / total;
  const shortRatio = shortCount / total;

  if (longRatio > 0.7) {
    return { name: "Majority", dir: "LONG", strength: longRatio * 100, score: 2.0, votes: { long: longCount, short: shortCount, total } };
  }
  if (shortRatio > 0.7) {
    return { name: "Majority", dir: "SHORT", strength: shortRatio * 100, score: 2.0, votes: { long: longCount, short: shortCount, total } };
  }
  return null;
};

/* ================================================================
   REGIME-AWARE AUTO TRADER SIGNAL
   Uses ADX to detect Trend vs Chop, separates oscillators from 
   trend-followers, and filters via Smart Money Concepts (SMC).
   ================================================================ */
export const getRegimeAwareSignal = (ind, gann, price, sents, symbol) => {
  const allSignals = getAllSignals(ind, gann, price, sents, symbol);
  if (!allSignals || allSignals.length < 5) return null;

  // 1. Detect Regime
  const adx = ind.adx?.adx || 0;
  const isTrending = adx >= 25;
  const isRanging = adx < 20;

  // 2. SMC Filter
  const smc = ind.smc;
  let blockLong = false;
  let blockShort = false;

  if (smc) {
    if (smc.bosDir === "SHORT" || smc.chochDir === "SHORT") blockLong = true;
    if (smc.bosDir === "LONG" || smc.chochDir === "LONG") blockShort = true;
    // Don't long right under a bear OB
    if (smc.bearOB && (smc.bearOB.price - price) / price < 0.005) blockLong = true;
    // Don't short right above a bull OB
    if (smc.bullOB && (price - smc.bullOB.price) / price < 0.005) blockShort = true;
  }

  // 3. Weighting
  let longWeight = 0;
  let shortWeight = 0;

  const trendNames = ["MACD", "EMA Cross", "AlphaTrend", "HalfTrend", "SSL Hybrid", "TrendAVGZone", "Ichimoku", "Mars SSL"];
  const oscNames = ["RSI", "Bollinger", "StochRSI", "RSI HistoAlert", "RSI Divergence", "RSI Multi-TF", "DBtrade", "Physical Levels"];

  allSignals.forEach(s => {
    let weight = s.score * (s.strength / 100);
    
    if (isTrending && oscNames.includes(s.name)) weight *= 0.2;
    if (isRanging && trendNames.includes(s.name)) weight *= 0.2;
    if (s.name === "Smart Money" || s.name === "Volume Profile") weight *= 1.5;

    if (s.dir === "LONG") longWeight += weight;
    if (s.dir === "SHORT") shortWeight += weight;
  });

  const totalWeight = longWeight + shortWeight + 0.0001;
  const longConfidence = longWeight / totalWeight;
  const shortConfidence = shortWeight / totalWeight;

  // 4. Execution Thresholds (stricter than blind majority)
  // Require very high confluence (85% agreement) and high total weight
  if (longConfidence > 0.85 && longWeight > 18 && !blockLong) {
    return { name: "Regime-Aware AI", dir: "LONG", strength: longConfidence * 100, score: longWeight, details: { trend: isTrending, adx } };
  }
  if (shortConfidence > 0.85 && shortWeight > 18 && !blockShort) {
    return { name: "Regime-Aware AI", dir: "SHORT", strength: shortConfidence * 100, score: shortWeight, details: { trend: isTrending, adx } };
  }

  return null;
};


/* ================================================================
   BEST EXIT INDICATOR PICKER
   Evaluates all indicators for exit signals OPPOSITE to trade direction.
   A LONG trade exits when indicators say SHORT (and vice versa).
   Can use a DIFFERENT indicator than entry.
   Returns null if no strong exit signal found (let SL/TP handle it).
   ================================================================ */
export const pickBestExitIndicator = (ind, gann, price, tradeDir, entryIndicator) => {
  // We want signals OPPOSITE to tradeDir
  const exitDir = tradeDir === "LONG" ? "SHORT" : "LONG";

  // Reuse pickBestIndicator to get all signals
  const allSignals = [];

  /* Evaluate same indicators but look for contrary signals */
  if (ind.rsi != null) {
    if (tradeDir === "LONG" && ind.rsi > 72) allSignals.push({ name: "RSI", dir: "SHORT", strength: ind.rsi - 30, score: 1.8, reason: `RSI overbought at ${ind.rsi.toFixed(1)}` });
    if (tradeDir === "SHORT" && ind.rsi < 28) allSignals.push({ name: "RSI", dir: "LONG", strength: 70 - ind.rsi, score: 1.8, reason: `RSI oversold at ${ind.rsi.toFixed(1)}` });
  }
  if (ind.macd) {
    if (tradeDir === "LONG" && ind.macd.hist < 0) allSignals.push({ name: "MACD", dir: "SHORT", strength: Math.abs(ind.macd.hist) * 120, score: 1.5, reason: `MACD crossed bearish (${ind.macd.hist.toFixed(4)})` });
    if (tradeDir === "SHORT" && ind.macd.hist > 0) allSignals.push({ name: "MACD", dir: "LONG", strength: Math.abs(ind.macd.hist) * 120, score: 1.5, reason: `MACD crossed bullish (${ind.macd.hist.toFixed(4)})` });
  }
  if (ind.bb) {
    if (tradeDir === "LONG" && price > ind.bb.upper) allSignals.push({ name: "Bollinger", dir: "SHORT", strength: (price - ind.bb.upper) / price * 1200, score: 1.6, reason: "Price broke above upper band" });
    if (tradeDir === "SHORT" && price < ind.bb.lower) allSignals.push({ name: "Bollinger", dir: "LONG", strength: (ind.bb.lower - price) / price * 1200, score: 1.6, reason: "Price broke below lower band" });
  }
  if (ind.alphaTrend) {
    if (tradeDir === "LONG" && ind.alphaTrend.signal === "SELL") allSignals.push({ name: "AlphaTrend", dir: "SHORT", strength: 100 - ind.alphaTrend.rsi, score: 1.7, reason: "AlphaTrend flipped SELL" });
    if (tradeDir === "SHORT" && ind.alphaTrend.signal === "BUY") allSignals.push({ name: "AlphaTrend", dir: "LONG", strength: ind.alphaTrend.rsi, score: 1.7, reason: "AlphaTrend flipped BUY" });
  }
  if (ind.ssl) {
    if (tradeDir === "LONG" && ind.ssl.signal === "SELL") allSignals.push({ name: "SSL Hybrid", dir: "SHORT", strength: Math.abs(ind.ssl.channel) * 120, score: 1.9, reason: "SSL crossed bearish" });
    if (tradeDir === "SHORT" && ind.ssl.signal === "BUY") allSignals.push({ name: "SSL Hybrid", dir: "LONG", strength: ind.ssl.channel * 120, score: 1.9, reason: "SSL crossed bullish" });
  }
  if (ind.chimera) {
    if (tradeDir === "LONG" && ind.chimera.signal?.includes("SELL")) allSignals.push({ name: "Chimera", dir: "SHORT", strength: Math.abs(ind.chimera.score) * 25, score: 1.8, reason: `Chimera confluence SELL (${ind.chimera.score.toFixed(1)})` });
    if (tradeDir === "SHORT" && ind.chimera.signal?.includes("BUY")) allSignals.push({ name: "Chimera", dir: "LONG", strength: Math.abs(ind.chimera.score) * 25, score: 1.8, reason: `Chimera confluence BUY (${ind.chimera.score.toFixed(1)})` });
  }
  if (ind.ichimoku) {
    if (tradeDir === "LONG" && ind.ichimoku.signal?.includes("SELL")) allSignals.push({ name: "Ichimoku", dir: "SHORT", strength: 65, score: 1.5, reason: "Ichimoku bearish signal" });
    if (tradeDir === "SHORT" && ind.ichimoku.signal?.includes("BUY")) allSignals.push({ name: "Ichimoku", dir: "LONG", strength: 65, score: 1.5, reason: "Ichimoku bullish signal" });
  }
  if (ind.marsSSL) {
    if (tradeDir === "LONG" && ind.marsSSL.marsSignal?.includes("SELL")) allSignals.push({ name: "Mars SSL", dir: "SHORT", strength: ind.marsSSL.confidence, score: 2.0, reason: `Mars SSL SELL (${ind.marsSSL.confidence}% conf)` });
    if (tradeDir === "SHORT" && ind.marsSSL.marsSignal?.includes("BUY")) allSignals.push({ name: "Mars SSL", dir: "LONG", strength: ind.marsSSL.confidence, score: 2.0, reason: `Mars SSL BUY (${ind.marsSSL.confidence}% conf)` });
  }
  if (ind.smc) {
    if (tradeDir === "LONG" && ind.smc.signal?.includes("SELL")) allSignals.push({ name: "Smart Money", dir: "SHORT", strength: ind.smc.confidence, score: 2.1, reason: `SMC bearish (BOS: ${ind.smc.bos})` });
    if (tradeDir === "SHORT" && ind.smc.signal?.includes("BUY")) allSignals.push({ name: "Smart Money", dir: "LONG", strength: ind.smc.confidence, score: 2.1, reason: `SMC bullish (BOS: ${ind.smc.bos})` });
  }
  if (ind.tdfi) {
    if (tradeDir === "LONG" && ind.tdfi.signal === "SELL") allSignals.push({ name: "TDFI", dir: "SHORT", strength: Math.abs(ind.tdfi.value) * 120, score: 1.6, reason: `TDFI bearish force (${ind.tdfi.value.toFixed(4)})` });
    if (tradeDir === "SHORT" && ind.tdfi.signal === "BUY") allSignals.push({ name: "TDFI", dir: "LONG", strength: Math.abs(ind.tdfi.value) * 120, score: 1.6, reason: `TDFI bullish force (${ind.tdfi.value.toFixed(4)})` });
  }
  if (ind.powerOfStocks) {
    if (tradeDir === "LONG" && ind.powerOfStocks.signal?.includes("SELL")) allSignals.push({ name: "Power of Stocks", dir: "SHORT", strength: 100 - ind.powerOfStocks.power, score: 1.7, reason: `Power dropped to ${ind.powerOfStocks.power}/100` });
    if (tradeDir === "SHORT" && ind.powerOfStocks.signal?.includes("BUY")) allSignals.push({ name: "Power of Stocks", dir: "LONG", strength: ind.powerOfStocks.power, score: 1.7, reason: `Power surged to ${ind.powerOfStocks.power}/100` });
  }

  if (allSignals.length === 0) return null;
  // Filter only opposite-direction signals with strong enough score
  const exitSignals = allSignals.filter(s => s.dir === exitDir && (s.score * s.strength) > 75);
  if (exitSignals.length === 0) return null;

  exitSignals.sort((a, b) => (b.score * b.strength) - (a.score * a.strength));
  return exitSignals[0];
};

export const getMajorityExitSignal = (ind, gann, price, tradeDir) => {
  const signals = getAllSignals(ind, gann, price, null, null);
  if (!signals || signals.length < 5) return null;

  let contraryCount = 0;
  signals.forEach(s => {
    if (tradeDir === "LONG" && s.dir === "SHORT") contraryCount++;
    if (tradeDir === "SHORT" && s.dir === "LONG") contraryCount++;
  });

  const total = signals.length;
  const contraryRatio = contraryCount / total;

  return { contraryRatio, contraryCount, total };
};

export const getRegimeAwareExitSignal = (ind, gann, price, tradeDir) => {
  const allSignals = getAllSignals(ind, gann, price, null, null);
  if (!allSignals || allSignals.length < 5) return null;

  const adx = ind.adx?.adx || 0;
  const isTrending = adx >= 25;
  const isRanging = adx < 20;

  let contraryWeight = 0;
  let totalWeight = 0;

  const trendNames = ["MACD", "EMA Cross", "AlphaTrend", "HalfTrend", "SSL Hybrid", "TrendAVGZone", "Ichimoku", "Mars SSL"];
  const oscNames = ["RSI", "Bollinger", "StochRSI", "RSI HistoAlert", "RSI Divergence", "RSI Multi-TF"];

  allSignals.forEach(s => {
    let weight = s.score * (s.strength / 100);
    
    if (isTrending && oscNames.includes(s.name)) weight *= 0.2;
    if (isRanging && trendNames.includes(s.name)) weight *= 0.2;
    if (s.name === "Smart Money" || s.name === "Volume Profile") weight *= 1.5;

    totalWeight += weight;
    if (tradeDir === "LONG" && s.dir === "SHORT") contraryWeight += weight;
    if (tradeDir === "SHORT" && s.dir === "LONG") contraryWeight += weight;
  });

  const contraryRatio = contraryWeight / (totalWeight + 0.0001);
  return { contraryRatio, contraryCount: Math.round(contraryWeight), total: Math.round(totalWeight) };
};

/* ── TP Confidence Estimator ──
   Returns a 0-1 score estimating probability that price will reach TP
   before hitting SL, based on market structure and volatility.
   Factors: ATR distance, resistance proximity, Bollinger Band room, trend strength, RSI runway. */
export const calcTPConfidence = (ind, price, dir, tp, sl, hist) => {
  if (!ind || !price || !tp || !sl) return 0.5;

  const tpDist = Math.abs(tp - price);
  const slDist = Math.abs(sl - price);
  if (tpDist <= 0) return 1;

  // 1. ATR distance factor
  const adxData = ind.adx;
  let atr = 0;
  if (adxData) {
    // Derive ATR from ADX's DI values: ATR ≈ (PDI + NDI) / ADX * price * 0.01
    const pdi = adxData.pdi || 0;
    const ndi = adxData.ndi || 0;
    const adx = adxData.adx || 14;
    if (adx > 0) atr = ((pdi + ndi) / adx) * price * 0.01;
  }
  // Fallback: simple estimate from hist if available
  if (atr < 0.001 && hist && hist.length >= 14) {
    const changes = [];
    for (let i = hist.length - 14; i < hist.length; i++) {
      changes.push(Math.abs(hist[i] - (hist[i - 1] || hist[i])));
    }
    atr = changes.reduce((a, b) => a + b, 0) / changes.length;
  }
  if (atr < 0.001) atr = price * 0.005; // default 0.5% of price

  const tpAtrRatio = tpDist / atr;
  // At 1 ATR → 0.7, at 2 ATR → 0.4, at 3 ATR → 0.1, at 4+ ATR → 0
  const atrFactor = Math.max(0, Math.min(1, 1 - (tpAtrRatio - 0.3) / 2.7));

  // 2. Resistance proximity
  let resFactor = 1;
  const levels = [];
  if (ind.fractals) levels.push(...ind.fractals);
  if (ind.physLevels) levels.push(...ind.physLevels);
  if (levels.length > 0) {
    const blocking = levels.filter((l) =>
      dir === "LONG" ? (l > price && l < tp) : (l < price && l > tp)
    );
    // Each blocking level reduces confidence by 15%
    resFactor = Math.max(0.2, 1 - blocking.length * 0.2);
  }

  // 3. Bollinger Band room
  let bbFactor = 1;
  const bb = ind.bb;
  if (bb && bb.upper && bb.lower) {
    if (dir === "LONG" && tp > bb.upper) {
      // TP beyond upper band — probability drops proportionally
      bbFactor = Math.max(0.3, (bb.upper - price) / (tp - price));
    } else if (dir === "SHORT" && tp < bb.lower) {
      bbFactor = Math.max(0.3, (price - bb.lower) / (price - tp));
    }
  }

  // 4. Trend conviction
  let trendFactor = 0.5;
  if (adxData) {
    const adx = adxData.adx || 0;
    const trendAligned = dir === "LONG" ? adxData.bull : !adxData.bull;
    trendFactor = (adx / 50) * (trendAligned ? 1 : 0.4);
  }
  trendFactor = Math.min(1, trendFactor);

  // 5. RSI runway
  let rsiFactor = 0.5;
  const rsi = ind.rsi;
  if (rsi != null) {
    if (dir === "LONG") {
      // Room to run: RSI below 70. Less room as RSI climbs.
      rsiFactor = Math.max(0.1, (70 - rsi) / 40);
    } else {
      rsiFactor = Math.max(0.1, (rsi - 30) / 40);
    }
  }

  // Weighted average
  const weights = { atr: 0.35, res: 0.2, bb: 0.15, trend: 0.2, rsi: 0.1 };
  const confidence =
    atrFactor * weights.atr +
    resFactor * weights.res +
    bbFactor * weights.bb +
    trendFactor * weights.trend +
    rsiFactor * weights.rsi;

  return Math.max(0, Math.min(1, parseFloat(confidence.toFixed(3))));
};
