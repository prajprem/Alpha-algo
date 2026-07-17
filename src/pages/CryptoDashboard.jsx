import { useState, useMemo, useEffect } from "react";

const mono = { fontFamily: "'JetBrains Mono', monospace" };
const fmt = (v, d = 2) => (v == null ? "--" : v > 9999 ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : Number(v).toFixed(d));
const pct = (v) => (v == null ? "--" : (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%");

const SectionHead = ({ title, S }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${S.border}` }}>
    <div style={{ width: 3, height: 16, borderRadius: 2, background: S.blue }} />
    <span style={{ fontSize: 14, fontWeight: 700, color: S.bright }}>{title}</span>
  </div>
);

const Spark = ({ arr, w = 180, h = 40, S }) => {
  if (!arr || arr.length < 2) return null;
  const mn = Math.min(...arr), mx = Math.max(...arr), rng = mx - mn || 1;
  const pts = arr.map((v, i) => `${(i / (arr.length - 1)) * w},${h - ((v - mn) / rng) * (h - 4) - 2}`).join(" ");
  const isUp = arr[arr.length - 1] >= arr[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs><linearGradient id={`cs-${isUp}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={isUp ? S.green : S.red} stopOpacity="0.2" /><stop offset="100%" stopColor={isUp ? S.green : S.red} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#cs-${isUp})`} />
      <polyline points={pts} fill="none" stroke={isUp ? S.green : S.red} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

/* ================================================================
   CRYPTO DASHBOARD
   ================================================================ */
export default function CryptoDashboard({ ALL, prices, hist, indicators, S, toast_ }) {
  const [fgi, setFgi] = useState(55);
  const [globalData, setGlobalData] = useState({ marketCap: 2.41, btcDom: 52.3, vol24h: 95.2, mcChange: 1.2 });
  const [fgiData, setFgiData] = useState({ value: 55, classification: "Neutral" });
  const [fgiHist, setFgiHist] = useState([{l:"1W",v:55}, {l:"1M",v:55}, {l:"1Y",v:55}]);
  const [defiData, setDefiData] = useState([]);

  // Filter crypto-only assets (those with cgId)
  const cryptoAssets = useMemo(() => ALL.filter(a => a.cgId), [ALL]);

  useEffect(() => {
    let cancelled = false;
    const fetchFGI = async () => {
      try {
        const res = await fetch("https://api.alternative.me/fng/?limit=365");
        const data = await res.json();
        if (!cancelled && data?.data?.length > 0) {
          const d = data.data;
          const current = parseInt(d[0].value);
          setFgiData({ value: current, classification: d[0].value_classification });
          setFgi(current);
          
          setFgiHist([
            { l: "1W", v: parseInt(d[Math.min(7, d.length-1)]?.value || current) },
            { l: "1M", v: parseInt(d[Math.min(30, d.length-1)]?.value || current) },
            { l: "1Y", v: parseInt(d[Math.min(364, d.length-1)]?.value || current) }
          ]);
        }
      } catch (e) { console.warn("FGI fetch failed:", e); }
    };
    fetchFGI();
    const iv = setInterval(fetchFGI, 300000); // refresh every 5 min
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchGlobal = async () => {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/global");
        const json = await res.json();
        if (!cancelled && json?.data) {
          const d = json.data;
          setGlobalData({
            marketCap: (d.total_market_cap?.usd || 0) / 1e12,
            btcDom: d.market_cap_percentage?.btc || 52.3,
            vol24h: (d.total_volume?.usd || 0) / 1e9,
            mcChange: d.market_cap_change_percentage_24h_usd || 0,
          });
        }
      } catch (e) { console.warn("Global data fetch failed:", e); }
    };
    fetchGlobal();
    const iv = setInterval(fetchGlobal, 120000); // refresh every 2 min
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchDefi = async () => {
      try {
        const res = await fetch("https://api.llama.fi/protocols");
        const protocols = await res.json();
        if (!cancelled && Array.isArray(protocols)) {
          const top5 = protocols
            .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
            .slice(0, 5)
            .map(p => ({
              name: p.name,
              chain: p.chain || p.chains?.[0] || "Multi",
              tvl: (p.tvl || 0) / 1e9,
              chg: (p.change_1d || 0).toFixed(2),
            }));
          setDefiData(top5);
        }
      } catch (e) { console.warn("DefiLlama fetch failed:", e); }
    };
    fetchDefi();
    const iv = setInterval(fetchDefi, 300000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  // Top movers
  const movers = useMemo(() => {
    const sorted = cryptoAssets.map(a => ({
      ...a,
      price: prices[a.symbol]?.usd || a.demo || 0,
      chg: prices[a.symbol]?.usd_24h_change || a.demoChg || 0,
    })).sort((a, b) => b.chg - a.chg);
    return { gainers: sorted.filter(a => a.chg > 0).slice(0, 5), losers: sorted.filter(a => a.chg < 0).slice(-5).reverse() };
  }, [cryptoAssets, prices]);

  // Demo DeFi data
  const defi = useMemo(() => {
    if (defiData.length > 0) return defiData;
    // Fallback demo data if API hasn't loaded yet
    return [
      { name: "Lido", chain: "Ethereum", tvl: 33.1, chg: "0.50" },
      { name: "Aave", chain: "Multi", tvl: 12.8, chg: "1.20" },
      { name: "MakerDAO", chain: "Ethereum", tvl: 8.4, chg: "-0.30" },
      { name: "Uniswap", chain: "Ethereum", tvl: 5.2, chg: "0.80" },
      { name: "Compound", chain: "Ethereum", tvl: 2.9, chg: "-0.50" },
    ];
  }, [defiData]);

  const stables = [
    { name: "USDT", cap: "112.4B", peg: (0.999 + Math.random() * 0.002).toFixed(4) },
    { name: "USDC", cap: "32.8B", peg: (0.999 + Math.random() * 0.002).toFixed(4) },
    { name: "DAI", cap: "5.3B", peg: (0.998 + Math.random() * 0.003).toFixed(4) },
  ];

  const flows = useMemo(() => cryptoAssets.slice(0, 3).map(a => ({
    symbol: a.symbol, color: a.color,
    inflow: (Math.random() * 500 + 100).toFixed(0),
    outflow: (Math.random() * 600 + 80).toFixed(0),
  })), [cryptoAssets]);

  const cardS = { background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: 16 };

  const fgiColor = fgi >= 70 ? S.green : fgi >= 50 ? S.amber : fgi >= 30 ? "#f97316" : S.red;
  const fgiLabel = fgi >= 75 ? "Extreme Greed" : fgi >= 55 ? "Greed" : fgi >= 45 ? "Neutral" : fgi >= 25 ? "Fear" : "Extreme Fear";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Market Overview Bar */}
      <div style={{ ...cardS, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        {cryptoAssets.slice(0, 4).map(a => {
          const p = prices[a.symbol]?.usd || a.demo || 0;
          const c = prices[a.symbol]?.usd_24h_change || a.demoChg || 0;
          return (
            <div key={a.symbol} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, boxShadow: `0 0 6px ${a.color}66` }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: a.color }}>{a.symbol}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: S.bright, ...mono }}>${fmt(p, a.dec)}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: c >= 0 ? S.green : S.red, ...mono }}>{pct(c)}</span>
            </div>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: S.dim }}>Market Cap</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.bright, ...mono }}>${globalData.marketCap.toFixed(2)}T</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: S.dim }}>BTC Dom</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#F7931A", ...mono }}>{globalData.btcDom.toFixed(1)}%</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: S.dim }}>Fear/Greed</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: fgiColor, ...mono }}>{fgi}</div>
            <div style={{ fontSize: 8, color: fgiColor }}>{fgiLabel}</div>
          </div>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: S.green, boxShadow: `0 0 8px ${S.green}` }} />
          <span style={{ fontSize: 10, color: S.green }}>24/7 Open</span>
        </div>
      </div>

      {/* Fear & Greed Gauge */}
      <div style={cardS}>
        <SectionHead title="Fear and Greed Index" S={S} />
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ position: "relative", width: 120, height: 60 }}>
            <svg width="120" height="60" viewBox="0 0 120 60">
              <path d="M 10 55 A 50 50 0 0 1 110 55" fill="none" stroke={S.border} strokeWidth="8" strokeLinecap="round" />
              <path d="M 10 55 A 50 50 0 0 1 110 55" fill="none" stroke={`url(#fgi-grad)`} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(fgi / 100) * 157} 157`} />
              <defs><linearGradient id="fgi-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={S.red} /><stop offset="50%" stopColor={S.amber} /><stop offset="100%" stopColor={S.green} /></linearGradient></defs>
              <circle cx={10 + (fgi / 100) * 100} cy={55 - Math.sin((fgi / 100) * Math.PI) * 50} r="4" fill={fgiColor} stroke={S.bright} strokeWidth="1.5" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: fgiColor, ...mono }}>{fgi}</div>
            <div style={{ fontSize: 12, color: fgiColor, fontWeight: 600 }}>{fgiLabel}</div>
          </div>
          <div style={{ flex: 1, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {fgiHist.map(t => (
              <div key={t.l} style={{ textAlign: "center", padding: "4px 10px", background: S.bg, borderRadius: 4 }}>
                <div style={{ fontSize: 8, color: S.dim }}>{t.l} Ago</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.v >= 50 ? S.green : S.red, ...mono }}>{Math.max(0, Math.min(100, t.v))}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Top Gainers */}
        <div style={cardS}>
          <SectionHead title="Top Gainers" S={S} />
          {movers.gainers.length === 0 ? <div style={{ color: S.dim, fontSize: 12, textAlign: "center", padding: 16 }}>No gainers</div> : movers.gainers.map(a => (
            <div key={a.symbol} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${S.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.color }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: a.color }}>{a.symbol}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: S.bright, ...mono }}>${fmt(a.price, a.dec)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: S.green, ...mono }}>{pct(a.chg)}</span>
            </div>
          ))}
        </div>
        {/* Top Losers */}
        <div style={cardS}>
          <SectionHead title="Top Losers" S={S} />
          {movers.losers.length === 0 ? <div style={{ color: S.dim, fontSize: 12, textAlign: "center", padding: 16 }}>No losers</div> : movers.losers.map(a => (
            <div key={a.symbol} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${S.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.color }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: a.color }}>{a.symbol}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: S.bright, ...mono }}>${fmt(a.price, a.dec)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: S.red, ...mono }}>{pct(a.chg)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Asset Detail Cards */}
      <div style={cardS}>
        <SectionHead title="Crypto Assets" S={S} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {cryptoAssets.map(a => {
            const p = prices[a.symbol]?.usd || a.demo || 0;
            const c = prices[a.symbol]?.usd_24h_change || a.demoChg || 0;
            const hArr = hist[a.symbol];
            const h24hi = hArr?.length > 0 ? Math.max(...hArr) : p * (1 + Math.abs(c) / 100 + 0.01);
            const h24lo = hArr?.length > 0 ? Math.min(...hArr) : p * (1 - Math.abs(c) / 100 - 0.01);
            const ind = indicators[a.symbol];
            const rsi = ind?.rsi;
            return (
              <div key={a.symbol} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: a.color, boxShadow: `0 0 8px ${a.color}66` }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: a.color }}>{a.symbol}</span>
                    <span style={{ fontSize: 10, color: S.dim }}>{a.name}</span>
                  </div>
                  {rsi != null && (
                    <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: rsi > 70 ? S.red + "18" : rsi < 30 ? S.green + "18" : S.bg, color: rsi > 70 ? S.red : rsi < 30 ? S.green : S.dim }}>
                      RSI {rsi.toFixed(0)}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: S.bright, ...mono }}>${fmt(p, a.dec)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c >= 0 ? S.green : S.red, ...mono }}>{pct(c)}</span>
                </div>
                <Spark arr={hArr} S={S} />
                <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10, color: S.dim }}>
                  <span>H: <span style={{ color: S.green, ...mono }}>${fmt(h24hi, a.dec)}</span></span>
                  <span>L: <span style={{ color: S.red, ...mono }}>${fmt(h24lo, a.dec)}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DeFi Overview */}
      <div style={cardS}>
        <SectionHead title="DeFi Overview" S={S} />
        <div style={{ display: "flex", gap: 20, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center", padding: "8px 16px", background: S.bg, borderRadius: 6 }}>
            <div style={{ fontSize: 9, color: S.dim }}>Total TVL</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: S.bright, ...mono }}>${defi.reduce((s, d) => s + d.tvl, 0).toFixed(1)}B</div>
          </div>
          {stables.map(s => (
            <div key={s.name} style={{ textAlign: "center", padding: "8px 12px", background: S.bg, borderRadius: 6 }}>
              <div style={{ fontSize: 9, color: S.dim }}>{s.name}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: S.bright, ...mono }}>{s.cap}</div>
              <div style={{ fontSize: 9, color: Math.abs(parseFloat(s.peg) - 1) < 0.001 ? S.green : S.amber, ...mono }}>${s.peg}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "grid", gridTemplateColumns: "100px 80px 80px 60px", gap: 8, fontSize: 9, color: S.dim, padding: "4px 0", borderBottom: `1px solid ${S.border}` }}>
            <span>Protocol</span><span>Chain</span><span>TVL</span><span>24h</span>
          </div>
          {defi.map(d => (
            <div key={d.name} style={{ display: "grid", gridTemplateColumns: "100px 80px 80px 60px", gap: 8, fontSize: 11, padding: "6px 0", borderBottom: `1px solid ${S.border}`, alignItems: "center" }}>
              <span style={{ color: S.bright, fontWeight: 600 }}>{d.name}</span>
              <span style={{ color: S.dim, fontSize: 10 }}>{d.chain}</span>
              <span style={{ color: S.text, ...mono }}>${d.tvl.toFixed(1)}B</span>
              <span style={{ color: parseFloat(d.chg) >= 0 ? S.green : S.red, ...mono, fontSize: 10 }}>{parseFloat(d.chg) >= 0 ? "+" : ""}{d.chg}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Exchange Flows */}
      <div style={cardS}>
        <SectionHead title="Exchange Flows (Demo)" S={S} />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {flows.map(f => {
            const net = parseFloat(f.inflow) - parseFloat(f.outflow);
            const isNetIn = net > 0;
            return (
              <div key={f.symbol} style={{ flex: 1, minWidth: 180, background: S.bg, borderRadius: 6, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: f.color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: f.color }}>{f.symbol}</span>
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: isNetIn ? S.red + "18" : S.green + "18", color: isNetIn ? S.red : S.green, fontWeight: 600 }}>
                    {isNetIn ? "Net Inflow" : "Net Outflow"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ color: S.red }}>In</span>
                      <span style={{ color: S.red, ...mono }}>{f.inflow} BTC</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: S.bg, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(parseFloat(f.inflow) / (parseFloat(f.inflow) + parseFloat(f.outflow))) * 100}%`, background: S.red, borderRadius: 2 }} />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ color: S.green }}>Out</span>
                      <span style={{ color: S.green, ...mono }}>{f.outflow} BTC</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: S.bg, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(parseFloat(f.outflow) / (parseFloat(f.inflow) + parseFloat(f.outflow))) * 100}%`, background: S.green, borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "center", marginTop: 6, fontSize: 12, fontWeight: 700, color: isNetIn ? S.red : S.green, ...mono }}>
                  {isNetIn ? "+" : ""}{net.toFixed(0)} {f.symbol}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: 9, color: S.dim, textAlign: "center" }}>
          Positive net flow = coins moving to exchanges (bearish) | Negative = coins leaving (bullish)
        </div>
      </div>

      {/* Liquidation Heatmap */}
      <div style={cardS}>
        <SectionHead title="Liquidation Heatmap (Simulated)" S={S} />
        {cryptoAssets.slice(0, 3).map(a => {
          const p = prices[a.symbol]?.usd || a.demo || 0;
          const range = p * 0.1;
          const shortLiq = p - range * (0.3 + Math.random() * 0.3);
          const longLiq = p + range * (0.3 + Math.random() * 0.3);
          const pos = ((p - (p - range)) / (2 * range)) * 100;
          return (
            <div key={a.symbol} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: a.color }}>{a.symbol}</span>
                <span style={{ fontSize: 10, color: S.dim, ...mono }}>${fmt(p, a.dec)}</span>
              </div>
              <div style={{ position: "relative", height: 16, borderRadius: 4, overflow: "hidden", background: S.bg }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: "50%", background: `linear-gradient(90deg, ${S.red}44, transparent)` }} />
                <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: "50%", background: `linear-gradient(90deg, transparent, ${S.green}44)` }} />
                <div style={{ position: "absolute", left: `${pos}%`, top: 0, width: 2, height: "100%", background: S.bright, boxShadow: `0 0 4px ${S.bright}` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 9, color: S.dim }}>
                <span style={{ color: S.red, ...mono }}>Short Liq ${fmt(shortLiq, 0)}</span>
                <span style={{ color: S.green, ...mono }}>Long Liq ${fmt(longLiq, 0)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
