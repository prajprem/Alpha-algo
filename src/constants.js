/* ================================================================
   CONSTANTS MODULE - Alpha Algo Trading Terminal
   ================================================================ */

export const DEFAULT_CRYPTO = [
  { symbol: "BTC", name: "Bitcoin", cgId: "bitcoin", bnSym: "BTCUSDT", color: "#F7931A", dec: 2, demo: 67200, demoChg: 1.2 },
  { symbol: "ETH", name: "Ethereum", cgId: "ethereum", bnSym: "ETHUSDT", color: "#627EEA", dec: 2, demo: 3450, demoChg: -0.5 },
  { symbol: "SOL", name: "Solana", cgId: "solana", bnSym: "SOLUSDT", color: "#9945FF", dec: 2, demo: 145.2, demoChg: 2.1 },
  { symbol: "ADA", name: "Cardano", cgId: "cardano", bnSym: "ADAUSDT", color: "#0D99FF", dec: 4, demo: 0.45, demoChg: -1.0 },
  { symbol: "AVAX", name: "Avalanche", cgId: "avalanche-2", bnSym: "AVAXUSDT", color: "#E84142", dec: 2, demo: 35.6, demoChg: 0.8 },
];

export const DEFAULT_TRAD = [
  { symbol: "XAU/USD", name: "Gold", yfId: "GC=F", color: "#FFD700", dec: 2, demo: 2342.5, demoChg: 0.45, currency: "USD", lotSize: 1 },
  { symbol: "XAG/USD", name: "Silver", yfId: "SI=F", color: "#C0C0C0", dec: 2, demo: 30.5, demoChg: 0.2, currency: "USD", lotSize: 1 },
  { symbol: "OIL", name: "WTI Oil", yfId: "CL=F", color: "#E8883A", dec: 2, demo: 78.34, demoChg: -0.82, currency: "USD", lotSize: 1 },
  { symbol: "NIF", name: "Nifty 50", yfId: "%5ENSEI", color: "#FF9933", dec: 0, demo: 22485, demoChg: 0.63, currency: "INR", lotSize: 50, exchange: "NSE" },
  { symbol: "BNK", name: "Bank Nifty", yfId: "%5ENSEBANK", color: "#00B4D8", dec: 0, demo: 48520, demoChg: 0.82, currency: "INR", lotSize: 15, exchange: "NSE" },
  { symbol: "REL", name: "Reliance", yfId: "RELIANCE.NS", color: "#0077B6", dec: 2, demo: 2892, demoChg: 1.2, currency: "INR", lotSize: 250, exchange: "NSE" },
];

export const PRESET_COLORS = [
  "#F7931A", "#627EEA", "#9945FF", "#0D99FF", "#E84142",
  "#FFD700", "#E8883A", "#FF9933", "#00B4D8", "#0077B6",
  "#e91e63", "#00bcd4", "#8bc34a", "#ff5722", "#795548"
];

/* Dark theme color system */
export const S = {
  bg: "#0a0e17",
  card: "#111827",
  cardHover: "#1a1f2e",
  surface: "#0d1321",
  border: "#1e293b",
  borderLight: "#334155",
  dim: "#6b7280",
  mid: "#9ca3af",
  text: "#e5e7eb",
  bright: "#f9fafb",
  green: "#10b981",
  greenDim: "#064e3b",
  red: "#ef4444",
  redDim: "#450a0a",
  amber: "#f59e0b",
  amberDim: "#451a03",
  blue: "#3b82f6",
  blueDim: "#1e3a5f",
  purple: "#8b5cf6",
  purpleDim: "#2e1065",
};

export const getCurrency = a => (a.currency || "USD") === "INR" ? "\u20B9" : "$";

export const isOpen = a => {
  const d = new Date(), u = d.getUTCDay(), m = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (!a.exchange && !a.yfId) return true;
  if (a.exchange === "NSE" || a.exchange === "BSE") return u >= 1 && u <= 5 && m >= 225 && m < 600;
  if (a.currency === "USD") {
    if (u === 6 || (u === 0 && m < 22 * 60) || (u === 5 && m >= 21 * 60)) return false;
    if (m >= 21 * 60 && m < 22 * 60) return false;
    return true;
  }
  return true;
};

export const isClosingSoon = (a, minutesBefore = 15) => {
  if (!a.exchange && !a.yfId) return false; // Crypto doesn't close
  const d = new Date(), u = d.getUTCDay(), m = d.getUTCHours() * 60 + d.getUTCMinutes();
  // NSE/BSE closes at 600 mins (10:00 UTC / 15:30 IST)
  if (a.exchange === "NSE" || a.exchange === "BSE") {
    return u >= 1 && u <= 5 && m >= (600 - minutesBefore) && m < 600;
  }
  return false;
};

export const mkBracket = (asset, rawPrice, dir, cfg) => {
  const isINR = asset.currency === "INR";
  const cap = isINR ? cfg.fnoCap : cfg.cryptoCap;
  const lev = isINR ? 50 : cfg.lev; // F&O options implicit leverage (50x)
  const price = parseFloat(rawPrice);
  
  // Allocate fractional sizes directly without restricting to lot multiples
  const qty = parseFloat(((cap * lev) / price).toFixed(6));
  
  const fee = isINR ? 70 : cap * lev * cfg.feeRate * 2;

  // Calculate deltas based on invested amount (margin) by adjusting for leverage
  const slPct = cfg.stopLossPercent || 2;
  const tpPct = cfg.takeProfitPercent || 5;
  const slDelta = price * (slPct / 100) / lev;
  const tpDelta = price * (tpPct / 100) / lev;

  const tp = dir === "LONG" ? price + tpDelta : price - tpDelta;
  const sl = dir === "LONG" ? price - slDelta : price + slDelta;

  return {
    qty,
    tp: tp.toFixed(asset.dec || 2),
    sl: sl.toFixed(asset.dec || 2),
    fee: isINR ? fee : fee.toFixed(3),
    cost: isINR ? cap.toFixed(0) : cap.toFixed(3)
  };
};



/* Default config */
export const DEFAULT_CFG = {
  cryptoCap: 100,
  lev: 20,
  feeRate: .001,
  fnoCap: 10000,
  minTradeUSD: 10,
  minTradeINR: 500,
  autoTrade: false,
  fnoAutoTrade: false,
  coolMins: 10,
  tgToken: "",
  tgChatId: "",
  email: "",
  stopLossPercent: 40,
  takeProfitPercent: 75,
  trailingEnabled: false,
  trailSlPct: 1.5,
  trailTpPct: 0.5,
  trailingStop: false,
  hedgeLossPct: -30,
};

/* Tab definitions */
export const TABS = [
  { id: "watchlist", label: "Watchlist" },
  { id: "trades", label: "Trades" },
  { id: "portfolio", label: "Portfolio" },
  { id: "fno", label: "F&O" },
  { id: "fno-verdict", label: "F&O Verdict" },
  { id: "charts", label: "Charts" },
  { id: "indicators", label: "Indicators" },
  { id: "verdict", label: "Verdict" },
  { id: "connections", label: "Connections" },
  { id: "settings", label: "Settings" },
  { id: "logs", label: "Logs" },
];

/* Multi-user support */
export const DEFAULT_USER = {
  id: "default",
  name: "Trader 1",
  avatar: "T1",
  color: "#3b82f6",
  createdAt: Date.now(),
};
