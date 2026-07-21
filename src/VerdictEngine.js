// Helper Functions

export const ema = (arr, p) => {
  if (!arr || arr.length === 0) return [];
  const k = 2 / (p + 1);
  const result = [arr[0]];
  for (let i = 1; i < arr.length; i++) result.push(arr[i] * k + result[i - 1] * (1 - k));
  return result;
};

export const sma = (arr, p) => {
  if (!arr || arr.length === 0) return [];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < p - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - p + 1; j <= i; j++) sum += arr[j];
    result.push(sum / p);
  }
  return result;
};

export const wma = (arr, p) => {
  if (!arr || arr.length === 0) return [];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < p - 1) { result.push(null); continue; }
    let num = 0, den = 0;
    for (let j = 0; j < p; j++) { num += arr[i - p + 1 + j] * (j + 1); den += (j + 1); }
    result.push(num / den);
  }
  return result;
};

export const stdDev = (arr) => {
  if (!arr || arr.length === 0) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
};

export const trueRanges = (arr) => {
  if (!arr || arr.length === 0) return [];
  const result = [];
  for (let i = 1; i < arr.length; i++) result.push(Math.abs(arr[i] - arr[i - 1]));
  return result;
};

export const trueRangesOHLC = (candles) => {
  if (!candles || candles.length === 0) return [];
  const result = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], pc = candles[i-1];
    result.push(Math.max(c.high - c.low, Math.abs(c.high - pc.close), Math.abs(c.low - pc.close)));
  }
  return result;
};

export const calcATR = (candles, period = 14) => {
  if (!candles || candles.length === 0) return 0;
  const trs = trueRangesOHLC(candles);
  if (trs.length < period) return trs.length > 0 ? trs.reduce((s,v) => s+v, 0) / trs.length : 0;
  return trs.slice(-period).reduce((s, v) => s + v, 0) / period;
};

export const findSwings = (arr, lookback = 5) => {
  if (!arr || arr.length === 0) return { highs: [], lows: [] };
  const highs = [], lows = [];
  for (let i = lookback; i < arr.length - lookback; i++) {
    let isHigh = true, isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (arr[i] <= arr[i - j] || arr[i] <= arr[i + j]) isHigh = false;
      if (arr[i] >= arr[i - j] || arr[i] >= arr[i + j]) isLow = false;
    }
    if (isHigh) highs.push({ index: i, price: arr[i] });
    if (isLow) lows.push({ index: i, price: arr[i] });
  }
  return { highs, lows };
};

export const findSwingsOHLC = (candles, lookback = 5) => {
  if (!candles || candles.length === 0) return { highs: [], lows: [] };
  const highs = [], lows = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true, isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) isHigh = false;
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) isLow = false;
    }
    if (isHigh) highs.push({ index: i, price: candles[i].high });
    if (isLow) lows.push({ index: i, price: candles[i].low });
  }
  return { highs, lows };
};

export const last = (arr) => arr && arr.length > 0 ? arr[arr.length - 1] : null;
export const pctDiff = (a, b) => ((a === 0 && b === 0) ? 0 : Math.abs(a - b) / ((a + b) / 2) * 100);

export const calcRSI = (arr, period = 14) => {
  if (!arr || arr.length < period + 1) return 50;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = arr[i] - arr[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period + 1; i < arr.length; i++) {
    const d = arr[i] - arr[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
};

function calcStochRSI(arr, period = 14) {
  if (!arr || arr.length < period + 1) return { k: 50, d: 50 };
  const rsiVals = [];
  for (let i = period; i < arr.length; i++) {
    rsiVals.push(calcRSI(arr.slice(0, i + 1), period));
  }
  if (rsiVals.length < 3) return { k: 50, d: 50 };
  const lastVals = rsiVals.slice(-14);
  const mn = Math.min(...lastVals), mx = Math.max(...lastVals);
  const k = mx !== mn ? (rsiVals[rsiVals.length - 1] - mn) / (mx - mn) * 100 : 50;
  const d = last(rsiVals.slice(-3).length >= 3 ? sma(lastVals.slice(-3), 3) : [50]);
  return { k, d };
}

function calcCCI(arr, period = 20) {
  if (!arr || arr.length < period) return 0;
  const slice = arr.slice(-period);
  const m = slice.reduce((s, v) => s + v, 0) / period;
  let md = 0;
  for (const v of slice) md += Math.abs(v - m);
  md /= period;
  return md !== 0 ? (last(arr) - m) / (0.015 * md) : 0;
}

function calcWilliamsR(candles, period = 14) {
  if (!candles || candles.length < period) return -50;
  const slice = candles.slice(-period);
  const hh = Math.max(...slice.map(c => c.high));
  const ll = Math.min(...slice.map(c => c.low));
  const close = last(candles).close;
  return hh !== ll ? (hh - close) / (hh - ll) * -100 : -50;
}

function calcUltimateOsc(candles) {
  if (!candles || candles.length < 28) return 50;
  const bp = (i) => candles[i].close - Math.min(candles[i].low, candles[i-1].close);
  const tr = (i) => Math.max(candles[i].high, candles[i-1].close) - Math.min(candles[i].low, candles[i-1].close);
  const avg = (p) => {
    let sbp = 0, str = 0;
    for (let i = candles.length - p + 1; i < candles.length; i++) { sbp += bp(i); str += tr(i); }
    return str !== 0 ? sbp / str : 0.5;
  };
  return 100 * (4 * avg(7) + 2 * avg(14) + avg(28)) / 7;
}

function calcCMF(candles, period = 20) {
  if (!candles || candles.length < period) return 0;
  const slice = candles.slice(-period);
  let mfvSum = 0, volSum = 0;
  for (const c of slice) {
    const mfv = c.volume * ((c.close - c.low) - (c.high - c.close)) / (c.high - c.low || 1);
    mfvSum += mfv;
    volSum += c.volume;
  }
  return volSum !== 0 ? mfvSum / volSum : 0;
}

function calcADL(candles) {
  if (!candles || candles.length < 2) return 0;
  let adl = 0;
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const mfm = ((c.close - c.low) - (c.high - c.close)) / (c.high - c.low || 1);
    adl += mfm * c.volume;
  }
  return adl;
}

function calcMFI(candles, period = 14) {
  if (!candles || candles.length < period + 1) return 50;
  let pos = 0, neg = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    const prevTp = (candles[i-1].high + candles[i-1].low + candles[i-1].close) / 3;
    const flow = tp * (candles[i].volume || 0);
    if (tp > prevTp) pos += flow; else neg += flow;
  }
  const ratio = neg > 0 ? pos / neg : 100;
  return 100 - 100 / (1 + ratio);
}

function checkDoji(c) {
  const range = c.high - c.low;
  return range > 0 && Math.abs(c.open - c.close) / range < 0.1;
}

function checkHammer(c) {
  const body = Math.abs(c.close - c.open);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const upperWick = c.high - Math.max(c.open, c.close);
  return body > 0 && lowerWick >= 2 * body && upperWick <= body * 0.3;
}

function checkShootingStar(c) {
  const body = Math.abs(c.close - c.open);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const upperWick = c.high - Math.max(c.open, c.close);
  return body > 0 && upperWick >= 2 * body && lowerWick <= body * 0.3;
}

function checkEngulfing(p, c) {
  return (c.close > c.open && p.close < p.open && c.close > p.open && c.open < p.close) ||
         (c.close < c.open && p.close > p.open && c.close < p.open && c.open > p.close);
}

function checkMarubozu(c) {
  const body = Math.abs(c.close - c.open);
  const range = c.high - c.low;
  return range > 0 && body / range > 0.95;
}

function calcHMA(arr, p) {
  if (!arr || arr.length < p) return null;
  const half = Math.floor(p / 2);
  const sqrt = Math.floor(Math.sqrt(p));
  const wma1 = wma(arr, half);
  const wma2 = wma(arr, p);
  const raw = [];
  for (let i = 0; i < arr.length; i++) {
    if (wma1[i] == null || wma2[i] == null) continue;
    raw.push(2 * wma1[i] - wma2[i]);
  }
  if (raw.length < sqrt) return null;
  return last(wma(raw, sqrt));
}

function calcVWAP(candles) {
  if (!candles || candles.length < 2) return { value: 0, distancePercent: 0 };
  const slice = candles.slice(-24);
  let cumTPV = 0, cumVol = 0;
  for (const c of slice) {
    const tp = (c.high + c.low + c.close) / 3;
    cumTPV += tp * (c.volume || 0);
    cumVol += (c.volume || 0);
  }
  const vwap = cumVol > 0 ? cumTPV / cumVol : last(slice).close;
  const latest = last(candles).close;
  const distPct = vwap > 0 ? ((latest - vwap) / vwap) * 100 : 0;
  return { value: vwap, distancePercent: distPct };
}

function calcPSAR(candles, accel = 0.02, maxAccel = 0.2) {
  if (!candles || candles.length < 3) return { value: null, direction: 'Neutral' };
  let sar = candles[0].low;
  let af = accel;
  let isLong = candles[1].close > candles[0].close;
  let ep = isLong ? candles[1].high : candles[1].low;
  for (let i = 2; i < candles.length; i++) {
    sar = sar + af * (ep - sar);
    if (isLong) {
      if (candles[i].low < sar) { isLong = false; sar = ep; af = accel; ep = candles[i].low; }
      else {
        if (candles[i].high > ep) { ep = candles[i].high; af = Math.min(af + accel, maxAccel); }
        sar = Math.min(sar, candles[i-1].low, candles[i].low);
      }
    } else {
      if (candles[i].high > sar) { isLong = true; sar = ep; af = accel; ep = candles[i].high; }
      else {
        if (candles[i].low < ep) { ep = candles[i].low; af = Math.min(af + accel, maxAccel); }
        sar = Math.max(sar, candles[i-1].high, candles[i].high);
      }
    }
  }
  return { value: sar, direction: isLong ? 'Bullish' : 'Bearish' };
}

function calcIchimoku(candles) {
  if (!candles || candles.length < 52) return { tenkan: null, kijun: null, spanA: null, spanB: null, chikou: null, signal: 'N/A' };
  const tenkan = (Math.max(...candles.slice(-9).map(c => c.high)) + Math.min(...candles.slice(-9).map(c => c.low))) / 2;
  const kijun = (Math.max(...candles.slice(-26).map(c => c.high)) + Math.min(...candles.slice(-26).map(c => c.low))) / 2;
  const spanA = (tenkan + kijun) / 2;
  const spanB = (Math.max(...candles.slice(-52).map(c => c.high)) + Math.min(...candles.slice(-52).map(c => c.low))) / 2;
  const chikou = last(candles).close;
  const price = last(candles).close;
  let signal = 'Neutral';
  if (price > spanA && price > spanB) signal = 'Bullish';
  else if (price < spanA && price < spanB) signal = 'Bearish';
  return { tenkan, kijun, spanA, spanB, chikou, signal };
}

function calcADX(candles, period = 14) {
  if (!candles || candles.length < period + 1) return { adx: 20, plusDI: 25, minusDI: 15, signal: 'Neutral' };
  const trArr = [], plusArr = [], minusArr = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], pc = candles[i-1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - pc.close), Math.abs(c.low - pc.close));
    const upMove = c.high - pc.high;
    const downMove = pc.low - c.low;
    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;
    trArr.push(tr); plusArr.push(plusDM); minusArr.push(minusDM);
  }
  const wilderSmooth = (arr) => {
    const smoothed = [arr.slice(0, period).reduce((s, v) => s + v, 0) / period];
    for (let i = period; i < arr.length; i++)
      smoothed.push(smoothed[smoothed.length - 1] - smoothed[smoothed.length - 1] / period + arr[i]);
    return last(smoothed);
  };
  const atr = wilderSmooth(trArr);
  const plusDI = atr > 0 ? (wilderSmooth(plusArr) / atr) * 100 : 0;
  const minusDI = atr > 0 ? (wilderSmooth(minusArr) / atr) * 100 : 0;
  const dx = (plusDI + minusDI) > 0 ? Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100 : 0;
  let signal = 'Neutral';
  if (plusDI > minusDI && dx > 20) signal = 'Bullish';
  else if (minusDI > plusDI && dx > 20) signal = 'Bearish';
  return { adx: dx, plusDI, minusDI, signal };
}

function calcLogReturns(arr) {
  if (!arr || arr.length < 2) return [];
  const lr = [];
  for (let i = 1; i < arr.length; i++) lr.push(Math.log(arr[i] / arr[i-1]));
  return lr;
}

function calcHV(arr, period = 20) {
  if (!arr || arr.length < period + 1) return 0;
  const lr = calcLogReturns(arr.slice(-period - 1));
  if (lr.length < 2) return 0;
  const mean = lr.reduce((s, v) => s + v, 0) / lr.length;
  const variance = lr.reduce((s, v) => s + (v - mean) ** 2, 0) / (lr.length - 1);
  return Math.sqrt(variance) * Math.sqrt(365) * 100;
}

function calcChoppiness(candles, period = 14) {
  if (!candles || candles.length < period) return { value: 50, label: 'Neutral' };
  const slice = candles.slice(-period);
  const trs = trueRangesOHLC(slice);
  const sumTR = trs.reduce((s, v) => s + v, 0);
  const hh = Math.max(...slice.map(c => c.high));
  const ll = Math.min(...slice.map(c => c.low));
  if (sumTR === 0 || hh === ll) return { value: 50, label: 'Neutral' };
  const ci = 100 * Math.log10(sumTR / (hh - ll)) / Math.log10(period);
  const val = Math.max(0, Math.min(100, ci));
  let label = 'Neutral';
  if (val > 61.8) label = 'Choppy';
  else if (val < 38.2) label = 'Trending';
  return { value: val, label };
}

function calcLinearRegressionSlope(arr, period = 20) {
  if (!arr || arr.length < period) return 0;
  const slice = arr.slice(-period);
  const n = slice.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += slice[i]; sumXY += i * slice[i]; sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}

function calcCorrelation(arr1, arr2) {
  if (!arr1 || !arr2 || arr1.length < 3 || arr2.length < 3) return 0;
  const n = Math.min(arr1.length, arr2.length);
  const a1 = arr1.slice(-n), a2 = arr2.slice(-n);
  const m1 = a1.reduce((s, v) => s + v, 0) / n;
  const m2 = a2.reduce((s, v) => s + v, 0) / n;
  let num = 0, d1 = 0, d2 = 0;
  for (let i = 0; i < n; i++) {
    num += (a1[i] - m1) * (a2[i] - m2);
    d1 += (a1[i] - m1) ** 2;
    d2 += (a2[i] - m2) ** 2;
  }
  return d1 * d2 > 0 ? num / Math.sqrt(d1 * d2) : 0;
}

// Section 1
export const computePriceData = (ohlc, priceObj, hist) => {
  if (ohlc && ohlc.length > 0) {
    const l = last(ohlc);
    return { open: l.open, high: l.high, low: l.low, close: l.close, volume: l.volume || priceObj?.vol || 'N/A', timeframe: '1H OHLC from Yahoo Finance', available: true };
  } else if (hist && hist.length > 0) {
    const l = last(hist);
    return { open: l, high: l, low: l, close: l, volume: priceObj?.vol || 'N/A', timeframe: 'Estimated from hist ticks (no OHLCV available)', available: true };
  }
  return { open: 'N/A', high: 'N/A', low: 'N/A', close: 'N/A', volume: 'N/A', timeframe: 'N/A', available: false };
};

// Section 2
export const computeMarketStructure = (ohlc, hist, price) => {
  const swings = (ohlc && ohlc.length > 0) ? findSwingsOHLC(ohlc, 5) : findSwings(hist || [], 5);
  const { highs, lows } = swings;

  const recentSwings = [...highs.map(h => ({ ...h, type: 'high' })), ...lows.map(l => ({ ...l, type: 'low' }))].sort((a, b) => a.index - b.index).slice(-6);
  const labels = [];
  let lastHigh = null, lastLow = null;
  let hasHH = false, hasHL = false, hasLH = false, hasLL = false;
  let consecBull = 0, consecBear = 0;

  for (const s of recentSwings) {
    if (s.type === 'high') {
      if (lastHigh !== null) {
        if (s.price > lastHigh) { labels.push('HH'); hasHH = true; consecBull++; consecBear = 0; }
        else { labels.push('LH'); hasLH = true; consecBear++; consecBull = 0; }
      } else labels.push('H');
      lastHigh = s.price;
    } else {
      if (lastLow !== null) {
        if (s.price > lastLow) { labels.push('HL'); hasHL = true; consecBull++; consecBear = 0; }
        else { labels.push('LL'); hasLL = true; consecBear++; consecBull = 0; }
      } else labels.push('L');
      lastLow = s.price;
    }
  }

  let trend = 'Neutral';
  if (consecBull > 0) trend = 'Bullish';
  else if (consecBear > 0) trend = 'Bearish';

  const bos = hasHH ? { type: 'Bullish BOS', price: lastHigh || 0 } : hasLL ? { type: 'Bearish BOS', price: lastLow || 0 } : { type: 'None', price: 0 };
  let choch = { type: 'None', price: 0 };
  const sLabels = labels.join(',');
  if (sLabels.includes('HH') && sLabels.includes('LL')) choch = { type: 'Bearish CHOCH', price: lastLow || 0 };
  else if (sLabels.includes('LH') && sLabels.includes('HL')) choch = { type: 'Bullish CHOCH', price: lastHigh || 0 };

  const phase = consecBull >= 2 ? 'Impulsive Up' : consecBear >= 2 ? 'Impulsive Down' : 'Neutral/Ranging';

  return {
    trend,
    higherHighs: hasHH,
    lowerLows: hasLL,
    phase,
    swingLabels: labels,
    bos,
    choch,
    trendStrength: Math.max(consecBull, consecBear),
    swingHighs: highs,
    swingLows: lows
  };
};

// Section 3
export const computeTrendDirection = (ohlc, hist, price, marketStructure) => {
  const data = (ohlc && ohlc.length > 0) ? ohlc.map(c => c.close) : (hist || []);
  const methods = [];
  let bull = 0, bear = 0;

  const ema9 = last(ema(data, 9));
  const ema20 = last(ema(data, 20));
  const ema50 = last(ema(data, 50));
  const sma20 = last(sma(data, 20));
  const sma50 = last(sma(data, 50));

  if (ema9 > ema20 && ema20 > ema50) { methods.push({ name: 'EMA Alignment', signal: 'Bullish' }); bull++; }
  else if (ema9 < ema20 && ema20 < ema50) { methods.push({ name: 'EMA Alignment', signal: 'Bearish' }); bear++; }
  else methods.push({ name: 'EMA Alignment', signal: 'Neutral' });

  if (sma20 > sma50) { methods.push({ name: 'SMA Alignment', signal: 'Bullish' }); bull++; }
  else if (sma20 < sma50) { methods.push({ name: 'SMA Alignment', signal: 'Bearish' }); bear++; }
  else methods.push({ name: 'SMA Alignment', signal: 'Neutral' });

  const adxResult = (ohlc && ohlc.length > 14) ? calcADX(ohlc, 14) : { adx: 20, plusDI: 25, minusDI: 15, signal: 'Neutral' };
  methods.push({ name: 'ADX', signal: adxResult.signal, value: adxResult.adx });
  if (adxResult.signal === 'Bullish') bull++;
  else if (adxResult.signal === 'Bearish') bear++;

  const atr = calcATR(ohlc || [], 14);
  const stBand = sma20 - atr * 3;
  if (price > stBand) { methods.push({ name: 'SuperTrend', signal: 'Bullish' }); bull++; }
  else { methods.push({ name: 'SuperTrend', signal: 'Bearish' }); bear++; }

  methods.push({ name: 'Market Structure', signal: marketStructure.trend || 'Neutral' });
  if (marketStructure.trend === 'Bullish') bull++;
  else if (marketStructure.trend === 'Bearish') bear++;

  if (data.length >= 20) {
    const slope = calcLinearRegressionSlope(data, 20);
    methods.push({ name: 'Lin Regression', signal: slope > 0 ? 'Bullish' : 'Bearish', value: slope });
    if (slope > 0) bull++; else bear++;
  } else methods.push({ name: 'Lin Regression', signal: 'Neutral', value: 0 });

  const vwap = last(sma(data, Math.min(data.length, 24))) || price;
  if (price > vwap) { methods.push({ name: 'VWAP Proxy', signal: 'Bullish' }); bull++; }
  else { methods.push({ name: 'VWAP Proxy', signal: 'Bearish' }); bear++; }

  const trend5 = data.length >= 5 ? (last(data) > data[data.length - 5] ? 'Bullish' : 'Bearish') : 'Neutral';
  const trend20 = data.length >= 20 ? (last(data) > data[data.length - 20] ? 'Bullish' : 'Bearish') : 'Neutral';
  const trendFull = data.length >= 50 ? (last(data) > data[0] ? 'Bullish' : 'Bearish') : 'Neutral';
  const tfAgree = [trendFull, trend20, trend5].filter(t => t === 'Bullish' || t === 'Bearish');
  const tfSignal = tfAgree.length === 3 ? (trendFull === 'Bullish' ? 'Bullish' : 'Bearish') : (tfAgree.length === 2 ? (trendFull === 'Bullish' ? 'Bullish' : 'Bearish') : 'Neutral');
  methods.push({ name: 'Multi-TF', signal: tfSignal, detail: `Full: ${trendFull}, 20-bar: ${trend20}, 5-bar: ${trend5}` });
  if (tfSignal === 'Bullish') bull++;
  else if (tfSignal === 'Bearish') bear++;

  let verdict = 'Sideways';
  if (bull >= 6) verdict = 'Strong Bullish';
  else if (bull >= 4) verdict = 'Bullish';
  else if (bear >= 6) verdict = 'Strong Bearish';
  else if (bear >= 4) verdict = 'Bearish';

  return { methods, bullishVotes: bull, bearishVotes: bear, verdict };
};

// Section 4 — Support & Resistance
export const computeSupportResistance = (ohlc, hist, price, marketStructure) => {
  const data = (ohlc && ohlc.length > 0) ? ohlc.map(c => c.close) : (hist || []);
  const levels = [];
  const fibLevels = {};
  let nearest = 'N/A';

  if (ohlc && ohlc.length > 0) {
    const l = last(ohlc);
    levels.push({ type: 'Resistance', price: l.high, label: 'Prev High' });
    levels.push({ type: 'Support', price: l.low, label: 'Prev Low' });

    if (ohlc.length >= 2) {
      const p = ohlc[ohlc.length - 2];
      levels.push({ type: 'Resistance', price: p.high, label: 'Prev Day High' });
      levels.push({ type: 'Support', price: p.low, label: 'Prev Day Low' });
    }

    const weeklyHigh = Math.max(...ohlc.slice(-7).map(c => c.high));
    const weeklyLow = Math.min(...ohlc.slice(-7).map(c => c.low));
    levels.push({ type: 'Resistance', price: weeklyHigh, label: 'Weekly High' });
    levels.push({ type: 'Support', price: weeklyLow, label: 'Weekly Low' });

    const allHigh = Math.max(...ohlc.map(c => c.high));
    const allLow = Math.min(...ohlc.map(c => c.low));
    levels.push({ type: 'Resistance', price: allHigh, label: 'All-Time High' });
    levels.push({ type: 'Support', price: allLow, label: 'All-Time Low' });

    // Pivot Points
    const p = (l.high + l.low + l.close) / 3;
    const r1 = 2 * p - l.low, s1 = 2 * p - l.high;
    const r2 = p + (l.high - l.low), s2 = p - (l.high - l.low);
    levels.push({ type: 'Resistance', price: r1, label: 'R1' });
    levels.push({ type: 'Resistance', price: r2, label: 'R2' });
    levels.push({ type: 'Pivot', price: p, label: 'PP' });
    levels.push({ type: 'Support', price: s1, label: 'S1' });
    levels.push({ type: 'Support', price: s2, label: 'S2' });

    // Camarilla
    const range = l.high - l.low;
    levels.push({ type: 'Resistance', price: l.close + range * 1.1 / 2, label: 'Camarilla H4' });
    levels.push({ type: 'Support', price: l.close - range * 1.1 / 2, label: 'Camarilla L4' });

    // CPR (Central Pivot Range)
    const bc = (l.high + l.low) / 2;
    const tc = (p - bc) + p;
    const cprWidth = Math.abs(tc - bc);
    levels.push({ type: 'Pivot', price: tc, label: 'CPR TC' });
    levels.push({ type: 'Pivot', price: bc, label: 'CPR BC' });
  }

  const ema20v = last(ema(data, 20)) || 0;
  const ema50v = last(ema(data, 50)) || 0;
  levels.push({ type: 'Dynamic', price: ema20v, label: 'EMA 20' });
  levels.push({ type: 'Dynamic', price: ema50v, label: 'EMA 50' });
  levels.push({ type: 'Dynamic', price: last(sma(data, Math.min(data.length, 24))) || price, label: 'VWAP Proxy' });
  const atr = calcATR(ohlc || [], 14);
  const supTrend = ema20v - atr * 3;
  levels.push({ type: 'Dynamic', price: supTrend, label: 'SuperTrend Band' });

  if (marketStructure.swingHighs.length > 0 && marketStructure.swingLows.length > 0) {
    const sh = marketStructure.swingHighs[marketStructure.swingHighs.length - 1]?.price || 0;
    const sl = marketStructure.swingLows[marketStructure.swingLows.length - 1]?.price || 0;
    const diff = sh - sl;
    if (diff !== 0) {
      [0.236, 0.382, 0.5, 0.618, 0.786].forEach(r => {
        const v = sh - diff * r;
        levels.push({ type: 'Dynamic', price: v, label: `Fib ${(r*100).toFixed(1)}%` });
        fibLevels[(r*100).toFixed(1) + '%'] = v;
      });
    }
  }

  let minDist = Infinity;
  for (const lvl of levels) {
    const dist = Math.abs(price - lvl.price);
    if (dist < minDist) { minDist = dist; nearest = `${lvl.label} @ ${lvl.price.toFixed(2)}`; }
  }

  return { levels: levels.filter(l => l.price > 0 && l.price < Infinity), fibLevels, nearest };
};

// Section 5 — Volume Analysis
export const computeVolumeAnalysis = (ohlc, priceObj) => {
  if (!ohlc || ohlc.length === 0) {
    return {
      relativeVolume: 0, isSpike: false, avgVolume: 0, obv: 0, mfi: 0, cmf: 0, adLine: 0,
      volumeDelta: 'Requires tick data — N/A', cvd: 'Requires tick data — N/A', poc: 0, vah: 0, val: 0, trend: 'Insufficient data'
    };
  }
  const vols = ohlc.map(c => c.volume || 0);
  const avgVolume = vols.reduce((s, v) => s + v, 0) / vols.length;
  const lVol = last(vols) || 0;
  const relativeVolume = avgVolume > 0 ? lVol / avgVolume : 0;
  const isSpike = relativeVolume > 2.0;

  let obv = 0;
  for (let i = 1; i < ohlc.length; i++) {
    if (ohlc[i].close > ohlc[i-1].close) obv += ohlc[i].volume;
    else if (ohlc[i].close < ohlc[i-1].close) obv -= ohlc[i].volume;
  }

  const cmf = calcCMF(ohlc, 20);
  const adLine = calcADL(ohlc);

  // Volume Profile: bin closes into 10 buckets
  const closes = ohlc.map(c => c.close);
  const mn = Math.min(...closes), mx = Math.max(...closes);
  const binSize = (mx - mn) / 10 || 1;
  const bins = new Array(10).fill(0);
  for (const c of closes) {
    const idx = Math.min(9, Math.floor((c - mn) / binSize));
    bins[idx]++;
  }
  const pocIdx = bins.indexOf(Math.max(...bins));
  const poc = mn + (pocIdx + 0.5) * binSize;
  const sorted = bins.map((v, i) => ({ v, price: mn + (i + 0.5) * binSize })).sort((a, b) => b.v - a.v);
  const hvn = sorted.slice(0, 3).map(s => s.price);
  const lvn = sorted.slice(-3).map(s => s.price);

  let trend = 'Neutral';
  if (obv > 0 && cmf > 0) trend = 'Accumulating';
  else if (obv < 0 && cmf < 0) trend = 'Distributing';

  const mfi = calcMFI(ohlc, 14);

  return {
    relativeVolume, isSpike, avgVolume, obv, mfi, cmf, adLine, volumeDelta: 'Requires tick data — N/A', cvd: 'Requires tick data — N/A', poc, vah: hvn[0] || 0, val: lvn[0] || 0, trend
  };
};

// Section 6 — Momentum
export const computeMomentum = (ohlc, hist, price) => {
  const data = (ohlc && ohlc.length > 0) ? ohlc.map(c => c.close) : (hist || []);
  const rsiVal = data.length > 14 ? calcRSI(data, 14) : 50;
  const rsiLabel = rsiVal > 70 ? 'Overbought' : rsiVal < 30 ? 'Oversold' : 'Neutral';

  const ema12 = last(ema(data, 12)) || 0;
  const ema26 = last(ema(data, 26)) || 0;
  const macdVal = ema12 - ema26;
  const macdSignalArr = ema(data, 9);
  const macdSig = last(macdSignalArr) || 0;
  const macdHist = macdVal - macdSig;

  const stochRsi = calcStochRSI(data, 14);
  const momVal = data.length >= 11 ? data[data.length - 1] - data[data.length - 11] : 0;
  const rocVal = data.length >= 11 && data[data.length - 11] !== 0 ? ((data[data.length - 1] - data[data.length - 11]) / data[data.length - 11]) * 100 : 0;
  const cciVal = calcCCI(data, 20);
  const willR = ohlc && ohlc.length >= 14 ? calcWilliamsR(ohlc, 14) : -50;
  const uoVal = ohlc && ohlc.length >= 28 ? calcUltimateOsc(ohlc) : 50;

  const momentumLabel = momVal > 0 ? 'Bullish' : momVal < 0 ? 'Bearish' : 'Neutral';
  const rocLabel = rocVal > 0 ? 'Bullish' : rocVal < 0 ? 'Bearish' : 'Neutral';
  const cciLabel = cciVal > 100 ? 'Overbought' : cciVal < -100 ? 'Oversold' : 'Neutral';
  const willRLabel = willR > -20 ? 'Overbought' : willR < -80 ? 'Oversold' : 'Neutral';
  const uoLabel = uoVal > 70 ? 'Overbought' : uoVal < 30 ? 'Oversold' : 'Neutral';

  return {
    rsi: rsiVal,
    rsiLabel,
    macd: macdVal,
    macdSignal: macdSig,
    macdHist,
    stochK: stochRsi.k,
    stochD: stochRsi.d,
    stochRsi,
    momentum: { value: momVal, label: momentumLabel },
    roc: { value: rocVal, label: rocLabel },
    cci: { value: cciVal, label: cciLabel },
    williamsR: { value: willR, label: willRLabel },
    ultimateOsc: { value: uoVal, label: uoLabel },
    // Detailed versions for Signal Scoring
    rsiDetail: { value: rsiVal, label: rsiLabel },
    macdDetail: { value: macdVal, signal: macdSig, histogram: macdHist, label: macdVal > macdSig ? 'Bullish' : 'Bearish' }
  };
};

// Section 7 — Volatility
export const computeVolatility = (ohlc, hist, price) => {
  const data = (ohlc && ohlc.length > 0) ? ohlc.map(c => c.close) : (hist || []);
  const atrVal = (ohlc && ohlc.length > 14) ? calcATR(ohlc, 14) : (data.length > 14 ? trueRanges(data).slice(-14).reduce((s, v) => s + v, 0) / 14 : 0);
  const sma20Val = last(sma(data, 20)) || price;
  const sd = stdDev(data.slice(-20));

  const bbUpper = sma20Val + sd * 2;
  const bbLower = sma20Val - sd * 2;
  const pctB = bbUpper !== bbLower ? (price - bbLower) / (bbUpper - bbLower) : 0.5;
  const bandwidth = sma20Val > 0 ? (bbUpper - bbLower) / sma20Val : 0;

  const keltnerUpper = sma20Val + atrVal * 2;
  const keltnerLower = sma20Val - atrVal * 2;

  const donchianUpper = Math.max(...data.slice(-20));
  const donchianLower = Math.min(...data.slice(-20));

  const histVol = calcHV(data, 20);
  const choppiness = calcChoppiness(ohlc || [], 14);

  return {
    bbUpper, bbMiddle: sma20Val, bbLower, pctB, bandwidth,
    atr: atrVal,
    atrPct: price > 0 ? atrVal / price * 100 : 0,
    keltner: { upper: keltnerUpper, middle: sma20Val, lower: keltnerLower },
    donchian: { upper: donchianUpper, lower: donchianLower },
    stdDev: sd,
    histVol,
    choppiness
  };
};

// Section 8 — Trend Indicators
export const computeTrendIndicators = (ohlc, hist, price) => {
  const data = (ohlc && ohlc.length > 0) ? ohlc.map(c => c.close) : (hist || []);

  const emas = [9, 20, 50, 100, 200].map(p => {
    const v = last(ema(data, p)) || 0;
    return { period: p, value: v, signal: price > v ? 'Bullish' : price < v - 0.01 ? 'Bearish' : 'Neutral' };
  });

  const smas = [20, 50, 200].map(p => {
    const v = last(sma(data, p)) || 0;
    return { period: p, value: v, signal: price > v ? 'Bullish' : price < v - 0.01 ? 'Bearish' : 'Neutral' };
  });

  const hmaVal = calcHMA(data, 20);
  const psar = calcPSAR(ohlc || [{ low: price, high: price, close: price }]);
  const ichimoku = calcIchimoku(ohlc || [{ high: price, low: price, close: price, open: price, volume: 0 }]);
  const adxResult = calcADX(ohlc || [], 14);

  const ema9v = emas.find(e => e.period === 9)?.value || 0;
  const ema21v = last(ema(data, 21)) || 0;

  const trend = emas.filter(e => e.signal === 'Bullish').length >= 3 ? 'Bullish' :
                emas.filter(e => e.signal === 'Bearish').length >= 3 ? 'Bearish' : 'Neutral';

  return {
    sma20: smas.find(s => s.period === 20)?.value || 0,
    sma50: smas.find(s => s.period === 50)?.value || 0,
    sma200: smas.find(s => s.period === 200)?.value || 0,
    ema9: ema9v,
    ema21: ema21v,
    trend,
    emas, smas,
    hma: { value: hmaVal, signal: hmaVal != null ? (price > hmaVal ? 'Bullish' : 'Bearish') : 'Neutral' },
    vwma: ohlc && ohlc.length >= 20 ? (() => {
      const slice = ohlc.slice(-20);
      let tpvSum = 0, volSum = 0;
      for (const c of slice) {
        const tpv = ((c.high + c.low + c.close) / 3) * (c.volume || 1);
        tpvSum += tpv;
        volSum += (c.volume || 1);
      }
      const vwmaVal = volSum > 0 ? tpvSum / volSum : price;
      return { value: vwmaVal, signal: price > vwmaVal ? 'Bullish' : 'Bearish' };
    })() : { value: price, signal: 'Neutral' },
    superTrend: { value: smas[0]?.value * 0.95 || price * 0.95, direction: trend === 'Bullish' ? 'Bullish' : 'Bearish' },
    ichimoku,
    psar: { value: psar.value, direction: psar.direction },
    adx: { value: adxResult.adx, plusDI: adxResult.plusDI, minusDI: adxResult.minusDI, signal: adxResult.signal }
  };
};

// Section 9 — Price Action
export const computePriceAction = (ohlc) => {
  if (!ohlc || ohlc.length < 3) return { patterns: [], hasPattern: false };
  const patterns = [];
  const c3 = ohlc[ohlc.length - 1];
  const c2 = ohlc[ohlc.length - 2];
  const c1 = ohlc[ohlc.length - 3];

  if (c3.high <= c2.high && c3.low >= c2.low)
    patterns.push({ name: 'Inside Bar', type: 'neutral', description: 'Consolidation within previous range' });
  if (c3.high > c2.high && c3.low < c2.low)
    patterns.push({ name: 'Outside Bar', type: 'neutral', description: 'Volatility expansion beyond previous range' });
  if (checkDoji(c3))
    patterns.push({ name: 'Doji', type: 'neutral', description: 'Open and close nearly equal — indecision' });
  if (checkHammer(c3))
    patterns.push({ name: 'Hammer', type: 'bullish', description: 'Long lower wick — potential reversal up' });
  if (checkShootingStar(c3))
    patterns.push({ name: 'Shooting Star', type: 'bearish', description: 'Long upper wick — potential reversal down' });
  if (checkEngulfing(c2, c3))
    patterns.push({ name: c3.close > c3.open ? 'Bullish Engulfing' : 'Bearish Engulfing', type: c3.close > c3.open ? 'bullish' : 'bearish', description: 'Body fully engulfs previous body' });
  if (checkMarubozu(c3))
    patterns.push({ name: 'Marubozu', type: c3.close > c3.open ? 'bullish' : 'bearish', description: 'No meaningful wicks — strong momentum' });

  // Pin Bar: wick > 2x body, small body at one end
  const body = Math.abs(c3.close - c3.open);
  const upperWick = c3.high - Math.max(c3.open, c3.close);
  const lowerWick = Math.min(c3.open, c3.close) - c3.low;
  if (body > 0 && upperWick >= 2 * body && lowerWick <= body * 0.3)
    patterns.push({ name: 'Pin Bar', type: 'bearish', description: 'Long upper wick — rejection at high' });
  else if (body > 0 && lowerWick >= 2 * body && upperWick <= body * 0.3)
    patterns.push({ name: 'Pin Bar', type: 'bullish', description: 'Long lower wick — rejection at low' });

  // Three Soldiers / Crows
  if (ohlc.length >= 3) {
    const last3 = ohlc.slice(-3);
    if (last3.every(c => c.close > c.open && c.close > c.open * 1.005))
      patterns.push({ name: 'Three White Soldiers', type: 'bullish', description: '3 consecutive strong bullish candles' });
    if (last3.every(c => c.close < c.open && c.close < c.open * 0.995))
      patterns.push({ name: 'Three Black Crows', type: 'bearish', description: '3 consecutive strong bearish candles' });
  }

  // Morning/Evening Star
  if (ohlc.length >= 3) {
    if (c1.close < c1.open && checkDoji(c2) && c3.close > c3.open && c3.close > c2.high)
      patterns.push({ name: 'Morning Star', type: 'bullish', description: 'Bearish → Doji → Bullish beyond midpoint' });
    if (c1.close > c1.open && checkDoji(c2) && c3.close < c3.open && c3.close < c2.low)
      patterns.push({ name: 'Evening Star', type: 'bearish', description: 'Bullish → Doji → Bearish beyond midpoint' });
  }

  // Piercing Pattern / Dark Cloud Cover
  if (ohlc.length >= 2) {
    if (c2.close < c2.open && c3.close > c3.open && c3.open < c2.close && c3.close > (c2.open + c2.close) / 2)
      patterns.push({ name: 'Piercing Pattern', type: 'bullish', description: 'Bullish candle closes above midpoint of prior bearish candle' });
    if (c2.close > c2.open && c3.close < c3.open && c3.open > c2.close && c3.close < (c2.open + c2.close) / 2)
      patterns.push({ name: 'Dark Cloud Cover', type: 'bearish', description: 'Bearish candle closes below midpoint of prior bullish candle' });
  }

  // Spinning Top: small body with long wicks on both sides
  if (body > 0 && upperWick > body && lowerWick > body && body / (c3.high - c3.low) < 0.4)
    patterns.push({ name: 'Spinning Top', type: 'neutral', description: 'Small body with long upper and lower wicks — indecision' });

  if (patterns.length === 0)
    patterns.push({ name: 'No significant price action pattern', type: 'neutral', description: 'No significant pattern in last 3 candles' });

  return { patterns, hasPattern: patterns.length > 0 };
};

// Section 10 — Candlestick Patterns
export const computeCandlestickPatterns = (ohlc) => {
  const pa = computePriceAction(ohlc);
  const patterns = pa.patterns.map(p => ({
    name: p.name,
    significance: p.description || 'Detected',
    sentiment: p.type === 'bullish' ? 'Bullish' : p.type === 'bearish' ? 'Bearish' : 'Neutral'
  }));
  return { patterns, bullish: patterns.filter(p => p.sentiment === 'Bullish'), bearish: patterns.filter(p => p.sentiment === 'Bearish'), neutral: patterns.filter(p => p.sentiment === 'Neutral') };
};

// Section 11 — Chart Patterns
export const computeChartPatterns = (ohlc, hist) => {
  const data = (ohlc && ohlc.length > 0) ? ohlc.map(c => c.close) : (hist || []);
  const patterns = [];

  if (data.length < 30) return { patterns, hasPattern: false };

  const swings = findSwings(data, 5);
  const { highs, lows } = swings;

  // Double Top: two peaks within 1%
  for (let i = 0; i < highs.length - 1; i++) {
    const dist = Math.abs(highs[i].price - highs[i+1].price) / ((highs[i].price + highs[i+1].price) / 2);
    if (dist < 0.01) {
      patterns.push({ name: 'Double Top', dir: 'bearish', price: highs[i].price, description: `Two peaks within ${(dist*100).toFixed(2)}%` });
      break;
    }
  }
  // Double Bottom
  for (let i = 0; i < lows.length - 1; i++) {
    const dist = Math.abs(lows[i].price - lows[i+1].price) / ((lows[i].price + lows[i+1].price) / 2);
    if (dist < 0.01) {
      patterns.push({ name: 'Double Bottom', dir: 'bullish', price: lows[i].price, description: `Two troughs within ${(dist*100).toFixed(2)}%` });
      break;
    }
  }

  const mixed = [];
  let hIdx = 0, lIdx = 0, lastWasHigh = false;
  while (hIdx < highs.length || lIdx < lows.length) {
    const nextHigh = hIdx < highs.length ? highs[hIdx] : null;
    const nextLow = lIdx < lows.length ? lows[lIdx] : null;
    if (nextHigh && (!nextLow || nextHigh.index < nextLow.index)) {
      mixed.push({ type: 'high', price: nextHigh.price }); lastWasHigh = true; hIdx++;
    } else if (nextLow) {
      mixed.push({ type: 'low', price: nextLow.price }); lastWasHigh = false; lIdx++;
    } else break;
  }

  // Triple Top/Bottom
  if (highs.length >= 3) {
    const t3 = highs.slice(-3);
    const t3Dist = Math.max(...t3.map(h => h.price)) - Math.min(...t3.map(h => h.price));
    if (t3Dist / ((Math.max(...t3.map(h => h.price)) + Math.min(...t3.map(h => h.price))) / 2) < 0.01)
      patterns.push({ name: 'Triple Top', dir: 'bearish', price: t3[0].price, description: 'Three peaks within 1% — resistance cluster' });
  }
  if (lows.length >= 3) {
    const b3 = lows.slice(-3);
    const b3Dist = Math.max(...b3.map(l => l.price)) - Math.min(...b3.map(l => l.price));
    if (b3Dist / ((Math.max(...b3.map(l => l.price)) + Math.min(...b3.map(l => l.price))) / 2) < 0.01)
      patterns.push({ name: 'Triple Bottom', dir: 'bullish', price: b3[0].price, description: 'Three troughs within 1% — support cluster' });
  }

  // Head and Shoulders / Inverse H&S (simplified: 5-swing pattern L-H-L-H-L or H-L-H-L-H)
  if (mixed.length >= 5) {
    const last5 = mixed.slice(-5);
    const allEqual = last5.every((s, i, a) => i === 0 || s.type === a[i-1].type);
    if (!allEqual) {
      const isHS = last5[0].type === 'high' && last5[1].type === 'low' && last5[2].type === 'high' && last5[3].type === 'low' && last5[4].type === 'high' &&
        last5[2].price > last5[0].price && last5[2].price > last5[4].price && Math.abs(last5[0].price - last5[4].price) / last5[0].price < 0.03;
      const isIHS = last5[0].type === 'low' && last5[1].type === 'high' && last5[2].type === 'low' && last5[3].type === 'high' && last5[4].type === 'low' &&
        last5[2].price < last5[0].price && last5[2].price < last5[4].price && Math.abs(last5[0].price - last5[4].price) / last5[0].price < 0.03;
      if (isHS) patterns.push({ name: 'Head and Shoulders', dir: 'bearish', price: last5[4].price, description: 'Higher middle peak with equal outer peaks — reversal down' });
      if (isIHS) patterns.push({ name: 'Inverse Head and Shoulders', dir: 'bullish', price: last5[4].price, description: 'Lower middle trough with equal outer troughs — reversal up' });
    }
  }

  if (patterns.length === 0)
    patterns.push({ name: 'No chart pattern detected', dir: 'neutral', price: 0, description: 'Current data window shows no clear pattern formation' });

  return { patterns, hasPattern: patterns.length > 0 };
};

// Section 12 — Smart Money Concepts
export const computeSmartMoney = (ohlc, hist, price, marketStructure) => {
  const candles = (ohlc && ohlc.length > 0) ? ohlc : null;
  const result = { zones: [], orderBlock: { found: false, price: 0, type: 'None' }, bos: marketStructure.bos, choch: marketStructure.choch };

  if (!candles || candles.length < 5) return result;

  // Order Block: last significant candle before BOS
  const bosIdx = marketStructure.swingHighs.length > 0 ? marketStructure.swingHighs[marketStructure.swingHighs.length - 1]?.index : -1;
  if (bosIdx > 0 && bosIdx < candles.length) {
    const ob = candles[bosIdx - 1];
    if (marketStructure.bos.type === 'Bullish BOS' && ob.close < ob.open) {
      result.orderBlock = { found: true, price: ob.high, type: 'Bullish', low: ob.low, high: ob.high };
      result.zones.push({ type: 'Bullish OB', low: ob.low, high: ob.high });
    } else if (marketStructure.bos.type === 'Bearish BOS' && ob.close > ob.open) {
      result.orderBlock = { found: true, price: ob.low, type: 'Bearish', low: ob.low, high: ob.high };
      result.zones.push({ type: 'Bearish OB', low: ob.low, high: ob.high });
    }
  }

  // FVG (Fair Value Gap)
  for (let i = 2; i < candles.length; i++) {
    const prev = candles[i - 2], curr = candles[i];
    if (curr.low > prev.high) {
      result.zones.push({ type: 'Bullish FVG', low: prev.high, high: curr.low });
    } else if (curr.high < prev.low) {
      result.zones.push({ type: 'Bearish FVG', low: curr.high, high: prev.low });
    }
  }

  // Equal Highs/Lows
  const closePrices = candles.map(c => c.close);
  const swings = findSwings(closePrices, 3);
  const eqHighs = [], eqLows = [];
  for (let i = 0; i < swings.highs.length - 1; i++) {
    if (Math.abs(swings.highs[i].price - swings.highs[i+1].price) / swings.highs[i+1].price < 0.001) {
      result.zones.push({ type: 'Equal Highs', low: swings.highs[i].price, high: swings.highs[i+1].price });
      eqHighs.push(swings.highs[i].price);
    }
  }
  for (let i = 0; i < swings.lows.length - 1; i++) {
    if (Math.abs(swings.lows[i].price - swings.lows[i+1].price) / swings.lows[i+1].price < 0.001) {
      result.zones.push({ type: 'Equal Lows', low: swings.lows[i].price, high: swings.lows[i+1].price });
      eqLows.push(swings.lows[i].price);
    }
  }

  // Liquidity Grab: price briefly exceeds swing high/low then reverses
  const last3 = candles.slice(-3);
  if (last3.length === 3) {
    const prevSwingHigh = Math.max(...candles.slice(-10, -3).map(c => c.high));
    const prevSwingLow = Math.min(...candles.slice(-10, -3).map(c => c.low));
    if (last3[0].high > prevSwingHigh && last3[2].close < last3[0].close)
      result.zones.push({ type: 'Bearish Liquidity Grab', low: prevSwingHigh, high: last3[0].high });
    if (last3[0].low < prevSwingLow && last3[2].close > last3[0].close)
      result.zones.push({ type: 'Bullish Liquidity Grab', low: last3[0].low, high: prevSwingLow });
  }

  // Premium/Discount Zones: above 61.8% = premium, below 38.2% = discount
  const swingHigh = Math.max(...candles.slice(-20).map(c => c.high));
  const swingLow = Math.min(...candles.slice(-20).map(c => c.low));
  const swingRng = swingHigh - swingLow;
  if (swingRng > 0) {
    const premiumZone = swingLow + swingRng * 0.618;
    const discountZone = swingLow + swingRng * 0.382;
    result.premiumZone = { level: premiumZone, active: last(candles).close > premiumZone };
    result.discountZone = { level: discountZone, active: last(candles).close < discountZone };
  }

  // Liquidity Pools: clusters of equal highs/lows
  result.liquidityPools = {
    highs: eqHighs.length > 0 ? eqHighs : [],
    lows: eqLows.length > 0 ? eqLows : []
  };

  return result;
};

// Section 13 — ICT Concepts
export const computeICTConcepts = (ohlc, hist, price, marketStructure, smartMoney) => {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const totalMin = utcH * 60 + utcM;

  const killZones = [];
  let activeZone = 'Off-hours';
  if (totalMin >= 0 && totalMin < 180) { killZones.push({ name: 'Asian', active: true }); activeZone = 'Asian'; }
  else if (totalMin >= 420 && totalMin < 540) { killZones.push({ name: 'London Open', active: true }); activeZone = 'London'; }
  else if (totalMin >= 780 && totalMin < 960) { killZones.push({ name: 'NY Open', active: true }); activeZone = 'NY'; }
  if (totalMin >= 900 && totalMin < 960) killZones.push({ name: 'London Close', active: true });

  const data = (ohlc && ohlc.length > 0) ? ohlc.map(c => c.close) : (hist || []);
  const swingHigh = Math.max(...data.slice(-20));
  const swingLow = Math.min(...data.slice(-20));
  const swingRange = swingHigh - swingLow;
  const oteHigh = swingLow + swingRange * 0.79;
  const oteLow = swingLow + swingRange * 0.618;
  const inOTE = price >= oteLow && price <= oteHigh;

  // Liquidity Sweep: check if last 3 candles swept a swing high/low
  let liqSweep = { found: false, price: 0, type: 'None' };
  if (data.length >= 10) {
    const recentHigh = Math.max(...data.slice(-3));
    const prevHigh = Math.max(...data.slice(-10, -3));
    const recentLow = Math.min(...data.slice(-3));
    const prevLow = Math.min(...data.slice(-10, -3));
    if (recentHigh > prevHigh && last(data) < recentHigh)
      liqSweep = { found: true, price: recentHigh, type: 'Bearish Sweep' };
    else if (recentLow < prevLow && last(data) > recentLow)
      liqSweep = { found: true, price: recentLow, type: 'Bullish Sweep' };
  }

  // Judas Swing: early session move opposite to final trend (approx from first vs last 20% of data)
  let judas = { detected: false, direction: 'None' };
  if (data.length >= 10) {
    const first20 = data.slice(0, Math.floor(data.length * 0.2));
    const last20 = data.slice(-Math.floor(data.length * 0.2));
    if (first20.length > 1 && last20.length > 1) {
      const earlyDir = last(first20) > first20[0] ? 'Up' : 'Down';
      const finalDir = last(last20) > last20[0] ? 'Up' : 'Down';
      if (earlyDir !== finalDir) judas = { detected: true, direction: `${earlyDir} early then ${finalDir}` };
    }
  }

  return {
    killZone: { name: activeZone, active: activeZone !== 'Off-hours' },
    ote: { high: oteHigh, low: oteLow, inZone: inOTE },
    fvg: smartMoney.zones?.filter(z => z.type.includes('FVG')) || [],
    liquiditySweep: liqSweep,
    orderBlocks: [smartMoney.orderBlock],
    mss: { detected: marketStructure.choch?.type !== 'None', type: marketStructure.choch?.type === 'Bearish CHOCH' ? 'Bearish MSS' : marketStructure.choch?.type === 'Bullish CHOCH' ? 'Bullish MSS' : 'None' },
    powerOfThree: { phase: inOTE ? 'Manipulation' : 'Distribution' },
    judasSwing: judas
  };
};

// Section 9b — Gann Analysis (from existing gannData)
export const computeGann = (gann, price) => {
  if (!gann) return { sq9: price || 0, angle: 'No data', target: null, reversal: null };
  return {
    sq9: gann.sq9 || gann.target || price || 0,
    angle: gann.angle || 'Neutral',
    target: gann.target || null,
    reversal: gann.reversal || null
  };
};

// Section 14 — Wyckoff
export const computeWyckoff = (ohlc, hist, price) => {
  const data = (ohlc && ohlc.length > 0) ? ohlc.map(c => c.close) : (hist || []);
  if (data.length < 20) return { phase: 'Insufficient data', events: [], confidence: 'Low', conditionsMet: 0, totalConditions: 5 };

  const slice = data.slice(-30);
  const mn = Math.min(...slice), mx = Math.max(...slice);
  const range = mx - mn || 1;
  const recent = slice.slice(-5);
  const lastP = last(slice);

  const events = [];
  let conditionsMet = 0;

  const nearBottom = lastP < mn + range * 0.2;
  const nearTop = lastP > mx - range * 0.2;
  const volUp = recent.length > 1 && recent[recent.length - 1] > recent[0];
  const volDown = recent.length > 1 && recent[recent.length - 1] < recent[0];

  if (nearBottom && volDown) { events.push('Spring'); conditionsMet++; }
  if (nearBottom && volUp) { events.push('SOS'); conditionsMet++; }
  if (nearTop && volUp) { events.push('Upthrust'); conditionsMet++; }
  if (nearTop && volDown) { events.push('Distribution'); conditionsMet++; }

  // Selling Climax (SC): high volume down candle near bottom
  if (data.length >= 2) {
    const last2Vol = data.slice(-2);
    if (last2Vol[1] < last2Vol[0] && data[data.length - 2] < data[data.length - 3]) {
      events.push('SC (Selling Climax)'); conditionsMet++;
    }
  }
  // Automatic Rally (AR): sharp recovery after SC
  if (events.includes('SC (Selling Climax)') && volUp) {
    events.push('AR (Automatic Rally)'); conditionsMet++;
  }
  // Secondary Test (ST): retest of SC low on lower volume
  if (events.includes('SC (Selling Climax)') && nearBottom && !volDown) {
    events.push('ST (Secondary Test)'); conditionsMet++;
  }
  // LPS (Last Point of Support): retest of broken resistance as support
  if (events.includes('SOS') && nearBottom && !volDown && !volUp) {
    events.push('LPS'); conditionsMet++;
  }

  let phase = 'Unknown';
  if (events.some(e => e.includes('SC') || e.includes('AR')) && !events.includes('Upthrust')) phase = 'Accumulation';
  else if (events.includes('Upthrust') || events.includes('Distribution')) phase = 'Distribution';
  else if (events.includes('Spring')) phase = 'Spring / LPS forming';

  const confidence = conditionsMet >= 4 ? 'High' : conditionsMet >= 2 ? 'Medium' : 'Low';

  return { phase, events, confidence, conditionsMet, totalConditions: 8 };
};

// Section 15 — Elliott Wave
export const computeElliottWave = (ohlc, hist) => {
  const data = (ohlc && ohlc.length > 0) ? ohlc.map(c => c.close) : (hist || []);
  if (data.length < 30) return { waveCount: [], type: 'Inconclusive', currentWave: 'Insufficient data', target: null, valid: false, validationNotes: [] };

  const swings = findSwings(data, 8);
  const { highs, lows } = swings;
  const notes = [];

  const mixed = [];
  let lastWasHigh = false;
  let hIdx = 0, lIdx = 0;
  while (hIdx < highs.length || lIdx < lows.length) {
    const nextHigh = hIdx < highs.length ? highs[hIdx] : null;
    const nextLow = lIdx < lows.length ? lows[lIdx] : null;
    if (nextHigh && (!nextLow || nextHigh.index < nextLow.index)) {
      if (!lastWasHigh) { mixed.push({ type: 'high', price: nextHigh.price, index: nextHigh.index }); lastWasHigh = true; }
      hIdx++;
    } else if (nextLow) {
      if (lastWasHigh) { mixed.push({ type: 'low', price: nextLow.price, index: nextLow.index }); lastWasHigh = false; }
      lIdx++;
    } else break;
  }

  if (mixed.length < 4) {
    return { waveCount: [], type: 'Inconclusive', currentWave: 'Insufficient swings', target: null, valid: false, validationNotes: ['Not enough alternating swing points detected'] };
  }

  const last5 = mixed.slice(-5);
  let waveCount = [];
  let valid = true;

  if (last5.length >= 5) {
    const w1 = last5[0], w2 = last5[1], w3 = last5[2], w4 = last5[3], w5 = last5[4];
    if (w1.type === 'low' && w2.type === 'high' && w3.type === 'low' && w4.type === 'high' && w5.type === 'low') {
      waveCount = ['Wave 1', 'Wave 2', 'Wave 3', 'Wave 4', 'Wave 5'];
      const w1Ret = Math.abs(w2.price - w1.price);
      const w3Len = Math.abs(w4.price - w3.price);
      const w2Retract = Math.abs(w3.price - w2.price) / (w1Ret || 1);
      if (w2Retract < 0.382 || w2Retract > 0.618) { notes.push('Wave 2 retracement outside 38.2-61.8% range'); valid = false; }
      if (w3Len < w1Ret) { notes.push('Wave 3 shorter than Wave 1'); valid = false; }
      const w3Ratio = w1Ret > 0 ? w3Len / w1Ret : 0;
      if (Math.abs(w3Ratio - 1.618) > 0.5) notes.push(`Wave 3 = ${w3Ratio.toFixed(2)}× Wave 1 (expected 1.618×)`);
      const w4Retrace = Math.abs(w5.price - w4.price) / (w3Len || 1);
      if (w4Retrace < 0.1 || w4Retrace > 0.5) notes.push(`Wave 4 retrace = ${(w4Retrace*100).toFixed(0)}% of Wave 3 (expected 38.2%)`);
      const w5Len = Math.abs(w5.price - w4.price);
      const w5Ratio = w1Ret > 0 ? w5Len / w1Ret : 0;
      if (Math.abs(w5Ratio - 1.0) > 0.5 && Math.abs(w5Ratio - 0.618) > 0.3)
        notes.push(`Wave 5 = ${w5Ratio.toFixed(2)}× Wave 1 (expected 1.0× or 0.618×)`);
    } else if (w1.type === 'high' && w2.type === 'low' && w3.type === 'high' && w4.type === 'low' && w5.type === 'high') {
      waveCount = ['A', 'B', 'C'];
      valid = false;
      notes.push('Corrective ABC structure detected');
    } else {
      notes.push('Alternation pattern does not fit standard wave structure');
      valid = false;
    }
  }

  return {
    waveCount,
    type: valid ? 'Impulse' : 'Corrective / Inconclusive',
    currentWave: waveCount.length > 0 ? waveCount[waveCount.length - 1] : 'Unknown',
    target: mixed.length >= 5 ? mixed[mixed.length - 1].price : null,
    valid,
    validationNotes: notes.length > 0 ? notes : ['Wave structure appears valid']
  };
};

// Section 16 — Harmonic Patterns
export const computeHarmonicPatterns = (ohlc, hist) => {
  const data = (ohlc && ohlc.length > 0) ? ohlc.map(c => c.close) : (hist || []);
  if (data.length < 30) return { patterns: [], hasPattern: false };

  const swings = findSwings(data, 3);
  const { highs, lows } = swings;
  const patterns = [];

  const mixed = [];
  let hIdx = 0, lIdx = 0, lastWasHigh = false;
  while (hIdx < highs.length || lIdx < lows.length) {
    const nextHigh = hIdx < highs.length ? highs[hIdx] : null;
    const nextLow = lIdx < lows.length ? lows[lIdx] : null;
    if (nextHigh && (!nextLow || nextHigh.index < nextLow.index)) {
      mixed.push({ type: 'high', price: nextHigh.price }); lastWasHigh = true; hIdx++;
    } else if (nextLow) {
      mixed.push({ type: 'low', price: nextLow.price }); lastWasHigh = false; lIdx++;
    } else break;
  }

  if (mixed.length < 5) return { patterns: [], hasPattern: false };

  const checkRatio = (a, b, target, tol = 0.05) => {
    if (b === 0) return false;
    const ratio = Math.abs(a - b) / Math.abs(b);
    return Math.abs(ratio - target) < tol;
  };

  for (let i = 0; i < mixed.length - 4; i++) {
    const X = mixed[i], A = mixed[i+1], B = mixed[i+2], C = mixed[i+3], D = mixed[i+4];
    if (A.type === X.type || B.type === A.type || C.type === B.type || D.type === C.type) continue;

    const AB = Math.abs(B.price - A.price);
    const XA = Math.abs(A.price - X.price);
    if (XA === 0) continue;

    if (checkRatio(AB, XA, 0.618) && checkRatio(C.price - B.price, AB, 0.382, 0.3)) {
      const CD = Math.abs(D.price - C.price);
      const cdTarget = Math.abs(X.price - A.price) * 0.786;
      if (Math.abs(CD - cdTarget) / cdTarget < 0.05) {
        patterns.push({ name: 'Gartley', type: A.type === 'low' ? 'bullish' : 'bearish', prz: D.price });
      }
    }

    if (checkRatio(AB, XA, 0.382, 0.15) || checkRatio(AB, XA, 0.5, 0.1)) {
      const cdTarget = Math.abs(X.price - A.price) * 0.886;
      const CD = Math.abs(D.price - C.price);
      if (Math.abs(CD - cdTarget) / cdTarget < 0.05) {
        patterns.push({ name: 'Bat', type: A.type === 'low' ? 'bullish' : 'bearish', prz: D.price });
      }
    }

    // Butterfly: AB = 78.6% XA, CD = 127-161.8% XA
    if (checkRatio(AB, XA, 0.786, 0.1)) {
      const CD = Math.abs(D.price - C.price);
      const cdTarget1 = Math.abs(X.price - A.price) * 1.27;
      const cdTarget2 = Math.abs(X.price - A.price) * 1.618;
      if (Math.abs(CD - cdTarget1) / cdTarget1 < 0.15 || Math.abs(CD - cdTarget2) / cdTarget2 < 0.15)
        patterns.push({ name: 'Butterfly', type: A.type === 'low' ? 'bullish' : 'bearish', prz: D.price });
    }

    // Crab: AB = 38.2-61.8% XA, CD = 161.8% XA
    if ((checkRatio(AB, XA, 0.382, 0.1) || checkRatio(AB, XA, 0.618, 0.1)) && checkRatio(Math.abs(C.price - B.price), AB, 0.382, 0.3)) {
      const CD = Math.abs(D.price - C.price);
      const cdTarget = Math.abs(X.price - A.price) * 1.618;
      if (Math.abs(CD - cdTarget) / cdTarget < 0.15)
        patterns.push({ name: 'Crab', type: A.type === 'low' ? 'bullish' : 'bearish', prz: D.price });
    }

    // Cypher: BC = 113-141.4% XA, CD = 78.6% XC
    if (checkRatio(Math.abs(C.price - B.price), XA, 1.272, 0.2)) {
      const CD = Math.abs(D.price - C.price);
      const xc = Math.abs(C.price - X.price);
      const cdTarget = xc * 0.786;
      if (xc > 0 && Math.abs(CD - cdTarget) / cdTarget < 0.15)
        patterns.push({ name: 'Cypher', type: A.type === 'low' ? 'bullish' : 'bearish', prz: D.price });
    }
  }

  if (patterns.length === 0) patterns.push({ name: 'No harmonic pattern detected', type: 'neutral', prz: 0 });

  return { patterns, hasPattern: patterns.length > 0 && patterns[0].name !== 'No harmonic pattern detected' };
};

// Section 17 — Fibonacci
export const computeFibonacci = (ohlc, hist, price) => {
  const data = (ohlc && ohlc.length > 0) ? ohlc.map(c => c.close) : (hist || []);
  const swingHigh = Math.max(...data);
  const swingLow = Math.min(...data);
  const diff = swingHigh - swingLow;
  const levels = {};

  if (diff > 0) {
    [0.236, 0.382, 0.5, 0.618, 0.786].forEach(r => {
      levels[((1-r)*100).toFixed(1) + '%'] = swingLow + diff * (1 - r);
    });
    [1.27, 1.618, 2.618].forEach(r => {
      levels[(r*100).toFixed(0) + '%'] = swingHigh + diff * (r - 1);
    });
    // Expansion levels projected from retracement low
    [0.618, 1.0, 1.618].forEach(r => {
      levels['Exp ' + (r*100).toFixed(0) + '%'] = swingLow - diff * r;
    });
  } else {
    levels['100%'] = swingHigh;
  }

  let nearest = 'N/A';
  let minDist = Infinity;
  for (const [k, v] of Object.entries(levels)) {
    const d = Math.abs(price - v);
    if (d < minDist) { minDist = d; nearest = `${k} @ ${v.toFixed(2)}`; }
  }

  return { swingHigh, swingLow, levels, nearest };
};

// Section 18 — Session Analysis
export const computeSessionAnalysis = (ohlc) => {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const totalMin = utcH * 60 + utcM;

  const sessions = [];
  let currentSession = 'Off-hours';
  let overlap = null;

  if (totalMin >= 0 && totalMin < 480) { currentSession = 'Asian'; sessions.push('Asian'); }
  if (totalMin >= 420 && totalMin < 960) {
    if (currentSession === 'Asian') overlap = 'Asian-London';
    currentSession = 'London'; sessions.push('London');
  }
  if (totalMin >= 720 && totalMin < 1260) {
    if (currentSession === 'London') overlap = 'London-NY';
    currentSession = 'NY'; sessions.push('NY');
  }

  // Opening Range (30 min) and Initial Balance (60 min) approximated from OHLC
  let openingRange = { high: 0, low: 0 };
  let initialBalance = { high: 0, low: 0 };
  if (ohlc && ohlc.length >= 2) {
    const firstCandle = ohlc[0];
    openingRange = { high: firstCandle.high, low: firstCandle.low };
    const first2 = ohlc.slice(0, Math.min(2, ohlc.length));
    initialBalance = {
      high: Math.max(...first2.map(c => c.high)),
      low: Math.min(...first2.map(c => c.low))
    };
  }

  return {
    currentSession,
    overlap,
    killZones: sessions,
    openingRange,
    initialBalance
  };
};

// Section 19 — Gap Analysis
export const computeGapAnalysis = (ohlc, hist, price) => {
  const data = (ohlc && ohlc.length > 0) ? ohlc : null;
  if (!data || data.length < 3) return { hasGap: false, direction: 'None', sizePct: 0, type: 'No significant gap' };

  // Find the most recent gap by scanning adjacent candle pairs from newest to oldest
  let gapSize = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    const prevClose = data[i - 1].close;
    const currOpen = data[i].open;
    const g = ((currOpen - prevClose) / prevClose) * 100;
    if (Math.abs(g) >= 0.1) { gapSize = g; break; }
  }

  if (Math.abs(gapSize) < 0.1) return { hasGap: false, direction: 'None', sizePct: 0, type: 'No significant gap' };

  let type = 'Common';
  const absGap = Math.abs(gapSize);
  if (absGap > 1) type = 'Breakaway';
  else if (absGap > 0.5) type = 'Runaway';
  else type = 'Common';
  // Exhaustion gap — approximated as gap near a trend extreme in the last 5% of data
  const dataCloses = data.map(c => c.close);
  const recentMax = Math.max(...dataCloses.slice(-Math.ceil(data.length * 0.05)));
  const recentMin = Math.min(...dataCloses.slice(-Math.ceil(data.length * 0.05)));
  const overallMax = Math.max(...dataCloses);
  const overallMin = Math.min(...dataCloses);
  if (absGap > 0.5 && (recentMax >= overallMax * 0.99 || recentMin <= overallMin * 1.01))
    type = 'Exhaustion';

  return {
    hasGap: Math.abs(gapSize) >= 0.1,
    direction: gapSize > 0 ? 'Up' : 'Down',
    sizePct: gapSize,
    type
  };
};

// Section 20 — Options Data
export const computeOptionsData = (asset, optionChain) => {
  if (optionChain && optionChain.records) {
    const data = optionChain.records;
    return {
      available: true,
      maxPain: data.maxPain || 0,
      pcr: data.pcr || 0,
      highCall: data.highestCallOI || 0,
      highPut: data.highestPutOI || 0,
      iv: data.iv || 0,
      message: `Live NSE options data — ${data.expiry || 'current expiry'}`,
      fields: ['OI', 'Change in OI', 'Max Pain', 'PCR', 'IV', 'Delta', 'Gamma', 'Theta', 'Vega']
    };
  }
  if (asset?.type === 'crypto') {
    return { available: false, message: 'Options data available via Deribit API — not connected', maxPain: 0, pcr: 0, highCall: 0, highPut: 0, iv: 0, fields: [] };
  }
  if (asset?.exchange === 'NSE' || asset?.exchange === 'BSE') {
    return { available: false, message: 'Live options feed required — connect NSE options API', maxPain: 0, pcr: 0, highCall: 0, highPut: 0, iv: 0, fields: [] };
  }
  return { available: false, message: 'Options data not applicable', maxPain: 0, pcr: 0, highCall: 0, highPut: 0, iv: 0, fields: [] };
};

// Section 21 — Market Breadth
export const computeMarketBreadth = (asset, priceObj, ALL, prices) => {
  const result = { correlations: {} };

  // Relative Strength vs group mean
  const assetChg = priceObj?.usd_24h_change || 0;
  const allChgs = ALL.map(a => prices[a.symbol]?.usd_24h_change || 0).filter(c => c !== 0);
  const meanChg = allChgs.length > 0 ? allChgs.reduce((s, v) => s + v, 0) / allChgs.length : 0;
  const rs = meanChg !== 0 ? assetChg / meanChg : 1;
  result.relativeStrength = { value: rs, label: rs > 1.2 ? 'Strong' : rs > 0.8 ? 'Neutral' : 'Weak' };

  // Correlations with other assets
  if (ALL.length > 1 && prices) {
    for (const other of ALL) {
      if (other.symbol !== asset?.symbol && prices[other.symbol]?.usd) {
        result.correlations[other.symbol] = 0.5; // proxy: real correlation needs paired history
      }
    }
  }

  // Per-type messages
  if (asset?.exchange === 'NSE' || asset?.exchange === 'BSE') {
    result.message = 'Requires index constituent feed for A/D, TRIN, Tick Index';
  } else if (asset?.type === 'crypto') {
    result.message = 'Crypto Fear & Greed Index — connect alternative.me API';
  } else {
    result.message = 'Market breadth feed required for A/D, TRIN, Tick Index';
  }
  result.advanceDecline = null;
  result.trin = null;
  result.tickIndex = null;

  return result;
};

// Section 22 — Risk Management
export const computeRiskManagement = (price, atrVal, cfg, asset) => {
  const capital = cfg?.cryptoCap || cfg?.fnoCap || 10000;
  const riskPct = (cfg?.stopLossPercent || 2) / 100;
  const leverage = cfg?.lev || 1;
  const atr = atrVal || price * 0.02;

  const stopLoss = price - 2 * atr;
  const tp1 = price + 3 * atr;
  const tp2 = price + 5 * atr;
  const slDist = Math.abs(price - stopLoss);
  const tpDist = Math.abs(tp1 - price);
  const riskReward = slDist > 0 ? tpDist / slDist : 0;
  const positionSize = slDist > 0 ? (capital * riskPct) / slDist : 0;
  const maxDailyLoss = capital * 0.02;
  const maxDrawdown = capital * 0.1;
  const marginUsage = positionSize * price / (leverage || 1);
  const exposure = positionSize * price;

  return { riskPct: riskPct * 100, stopLoss, tp1, tp2, riskReward, positionSize, maxDailyLoss, maxDrawdown, marginUsage, leverage, exposure };
};

// Section 23 — Signal Scoring
export const computeSignalScoring = (sections) => {
  const factors = {};
  let total = 0;

  // Trend (20 pts)
  const trendVerdict = sections.s3?.verdict || 'Sideways';
  const trendScores = { 'Strong Bullish': 20, 'Bullish': 15, 'Sideways': 10, 'Bearish': 5, 'Strong Bearish': 0 };
  const trendPts = trendScores[trendVerdict] ?? 10;
  factors['Trend'] = trendPts;
  total += trendPts;

  // Momentum (15 pts)
  const rsiVal = (typeof sections.s6?.rsi === 'object' ? sections.s6?.rsi?.value : sections.s6?.rsi) ?? 50;
  let momPts = 7;
  if (rsiVal > 70) momPts = 15;
  else if (rsiVal < 30) momPts = 15;
  else if (rsiVal > 60 || rsiVal < 40) momPts = 10;
  factors['Momentum (RSI)'] = momPts;
  total += momPts;

  // Volume (10 pts)
  const relVol = sections.s5?.relativeVolume ?? 0;
  let volPts = 3;
  if (relVol > 1.5) volPts = 10;
  else if (relVol > 1.0) volPts = 7;
  factors['Volume'] = volPts;
  total += volPts;

  // S/R (15 pts) — proximity to nearest SR
  const levels = sections.s4?.levels || [];
  let srPts = 7;
  const price = sections.s1?.close || 0;
  if (price > 0 && levels.length > 0) {
    for (const l of levels) {
      const dist = Math.abs(price - l.price) / price;
      if (dist < 0.005 && l.type === 'Support') { srPts = 15; break; }
      if (dist < 0.005 && l.type === 'Resistance') { srPts = 15; break; }
      if (dist < 0.01) srPts = 10;
    }
  }
  factors['S/R Proximity'] = srPts;
  total += srPts;

  // Pattern (10 pts)
  const hasPA = sections.s9?.hasPattern || false;
  const hasCP = sections.s11?.hasPattern || false;
  let patPts = 0;
  if (hasPA && hasCP) patPts = 10;
  else if (hasPA || hasCP) patPts = 5;
  factors['Patterns'] = patPts;
  total += patPts;

  // Smart Money (15 pts)
  const hasOB = sections.s12?.orderBlock?.found || false;
  const hasFVG = (sections.s12?.zones || []).some(z => z.type.includes('FVG'));
  let smPts = 0;
  if (hasOB && hasFVG) smPts = 15;
  else if (hasOB || hasFVG) smPts = 8;
  factors['Smart Money'] = smPts;
  total += smPts;

  // Multi-TF (10 pts)
  const tfMethods = sections.s3?.methods || [];
  const tfBull = tfMethods.filter(m => m.name === 'Multi-TF' && m.signal === 'Bullish').length;
  const tfBear = tfMethods.filter(m => m.name === 'Multi-TF' && m.signal === 'Bearish').length;
  let tfPts = 2;
  if (tfBull > 0) tfPts = 6;
  if (tfBull > 0 && sections.s3?.verdict?.includes('Bullish')) tfPts = 10;
  factors['Multi-TF'] = tfPts;
  total += tfPts;

  // Risk (5 pts)
  const rr = sections.s22?.riskReward || 0;
  let riskPts = 1;
  if (rr >= 3) riskPts = 5;
  else if (rr >= 2) riskPts = 3;
  factors['Risk/Reward'] = riskPts;
  total += riskPts;

  let signal = 'Hold';
  if (total >= 80) signal = 'Strong Buy';
  else if (total >= 65) signal = 'Buy';
  else if (total >= 45) signal = 'Hold';
  else if (total >= 30) signal = 'Sell';
  else signal = 'Strong Sell';

  return { total, factors, signal, confidence: total };
};

// Section 24 — Dashboard Summary
export const computeDashboardSummary = (sections, price, priceObj, asset, trades) => {
  const s3 = sections.s3 || {};
  const s4 = sections.s4 || {};
  const s5 = sections.s5 || {};
  const s6 = sections.s6 || {};
  const s7 = sections.s7 || {};
  const s18 = sections.s18 || {};
  const s22 = sections.s22 || {};
  const s23 = sections.s23 || {};

  const trend = s3.verdict || 'N/A';
  const signal = s23.signal || 'Hold';
  const confidence = s23.confidence || 0;
  const atr = s7.atr || 0;
  const rsi = typeof s6.rsi === 'object' ? (s6.rsi?.value ?? 50) : (s6.rsi ?? 50);
  const macd = typeof s6.macd === 'object' ? (s6.macd?.value ?? 0) : (s6.macd ?? 0);

  // Nearest S/R
  const levels = s4.levels || [];
  let nearestSupport = price, nearestResistance = price;
  let minSupDist = Infinity, minResDist = Infinity;
  for (const l of levels) {
    const d = Math.abs(price - l.price);
    if (l.type === 'Support' && l.price < price && d < minSupDist) { minSupDist = d; nearestSupport = l.price; }
    if (l.type === 'Resistance' && l.price > price && d < minResDist) { minResDist = d; nearestResistance = l.price; }
  }

  // Open trade
  const openTrade = (trades || []).find(t => t.symbol === asset?.symbol && t.status === 'OPEN');
  const tradeStatus = openTrade ? 'Open' : 'No Position';

  return {
    price,
    trend,
    signal,
    confidence,
    atr,
    rsi,
    macd,
    emaAlign: s3.methods?.find(m => m.name === 'EMA Alignment')?.signal || 'Neutral',
    nearestSupport,
    nearestResistance,
    stopLoss: s22.stopLoss || 0,
    tp1: s22.tp1 || 0,
    tp2: s22.tp2 || 0,
    riskReward: s22.riskReward || 0,
    volume: s5?.avgVolume || 0,
    volatility: s7.atrPct || 0,
    session: s18.currentSession || 'N/A',
    multiTF: s3.methods?.find(m => m.name === 'Multi-TF')?.signal || 'N/A',
    tradeStatus,
    winRate: 'N/A',
    pnl: openTrade ? (openTrade.pnl || 0) : 0,
    drawdown: s22.maxDrawdown || 0
  };
};

// Master Function
export const runFullVerdict = (asset, priceObj, hist, ohlc, gann, sentiments, cfg, ALL, prices, trades, optionChain) => {
  const price = priceObj?.usd || (Array.isArray(hist) && hist.length > 0 ? last(hist) : 0);

  const eng_s1 = computePriceData(ohlc, priceObj, hist);
  const eng_s2 = computeMarketStructure(ohlc, hist, price);
  const eng_s3 = computeTrendDirection(ohlc, hist, price, eng_s2);
  const eng_s4 = computeSupportResistance(ohlc, hist, price, eng_s2);
  const eng_s5 = computeVolumeAnalysis(ohlc, priceObj);
  const eng_s6 = computeMomentum(ohlc, hist, price);
  const eng_s7 = computeVolatility(ohlc, hist, price);
  const eng_s8 = computeTrendIndicators(ohlc, hist, price);
  const eng_s9 = computePriceAction(ohlc);
  const eng_s10 = computeCandlestickPatterns(ohlc);
  const eng_s11 = computeChartPatterns(ohlc, hist);
  const eng_s12 = computeSmartMoney(ohlc, hist, price, eng_s2);
  const eng_s13 = computeICTConcepts(ohlc, hist, price, eng_s2, eng_s12);
  const eng_s14 = computeWyckoff(ohlc, hist, price);
  const eng_s15 = computeElliottWave(ohlc, hist);
  const eng_s16 = computeHarmonicPatterns(ohlc, hist);
  const eng_s17 = computeFibonacci(ohlc, hist, price);
  const eng_s18 = computeSessionAnalysis(ohlc);
  const eng_s19 = computeGapAnalysis(ohlc, hist, price);
  const eng_s20 = computeOptionsData(asset, optionChain);
  const eng_s21 = computeMarketBreadth(asset, priceObj, ALL, prices);
  const eng_s22 = computeRiskManagement(price, eng_s7.atr || 0, cfg, asset);
  const eng_s23_scoring = computeSignalScoring({
    s1: eng_s1, s2: eng_s2, s3: eng_s3, s4: eng_s4, s5: eng_s5,
    s6: eng_s6, s7: eng_s7, s8: eng_s8, s9: eng_s9, s10: eng_s10,
    s11: eng_s11, s12: eng_s12, s13: eng_s13, s14: eng_s14, s15: eng_s15,
    s16: eng_s16, s17: eng_s17, s18: eng_s18, s19: eng_s19, s20: eng_s20,
    s21: eng_s21, s22: eng_s22
  });
  const eng_s24 = computeDashboardSummary({
    s1: eng_s1, s3: eng_s3, s4: eng_s4, s5: eng_s5, s6: eng_s6, s7: eng_s7,
    s22: eng_s22, s23: eng_s23_scoring, s18: eng_s18
  }, price, priceObj, asset, trades);

  // Map engine sections to renderer slot numbers (sN = eng_sN, matching spec section numbering)
  const sections = {
    s1: eng_s1,   // Price Data (OHLCV)
    s2: eng_s2,   // Market Structure
    s3: eng_s3,   // Trend Direction
    s4: eng_s4,   // Support & Resistance
    s5: eng_s5,   // Volume Analysis
    s6: eng_s6,   // Momentum
    s7: eng_s7,   // Volatility
    s8: eng_s8,   // Trend Indicators
    s9: eng_s9,   // Price Action
    s10: eng_s10, // Candlestick Patterns
    s11: eng_s11, // Chart Patterns
    s12: eng_s12, // Smart Money Concepts
    s13: eng_s13, // ICT Concepts
    s14: eng_s14, // Wyckoff Analysis
    s15: eng_s15, // Elliott Wave
    s16: eng_s16, // Harmonic Patterns
    s17: eng_s17, // Fibonacci
    s18: eng_s18, // Session Analysis
    s19: eng_s19, // Gap Analysis
    s20: eng_s20, // Options Data
    s21: eng_s21, // Market Breadth
    s22: eng_s22, // Risk Management
    s23: eng_s23_scoring,
    s24: eng_s24
  };

  return { sections, timestamp: Date.now() };
};
