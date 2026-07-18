import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import yahooFinance from 'yahoo-finance2';

const yf = new yahooFinance();
const require = createRequire(import.meta.url);
const { KiteConnect } = require('kiteconnect');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATUS_FILE = path.join(os.homedir(), 'fno-agent', 'status.json');
const FNO_AGENT_DIR = path.join(os.homedir(), 'fno-agent');
const KITE_SESSION_FILE = path.join(os.homedir(), '.alpha-algo', 'kite-session.json');
const KITE_INSTR_CACHE_FILE = path.join(os.homedir(), '.alpha-algo', 'kite-instruments.json');
const KITE_INSTR_CACHE_TTL = 3600000; // 1 hour
const CONFIG_FILE = path.join(os.homedir(), '.alpha-algo', 'config.json');

const app = express();
app.use(cors());
app.use(express.json());

let agentProcess = null;

// ── Kite Connect State ──────────────────────────────────────────
let kiteClient = null;
let kiteApiKey = null;
let kiteApiSecret = null;
let kiteAccessToken = null;
let kiteUserId = null;
let kiteInstruments = null;
let kiteInstrumentsLastFetch = 0;

function loadKiteSession() {
    try {
        if (fs.existsSync(KITE_SESSION_FILE)) {
            const data = JSON.parse(fs.readFileSync(KITE_SESSION_FILE, 'utf-8'));
            kiteApiKey = data.apiKey;
            kiteApiSecret = data.apiSecret;
            kiteAccessToken = data.accessToken;
            kiteUserId = data.userId;
            if (kiteApiKey && kiteAccessToken) {
                kiteClient = new KiteConnect({ api_key: kiteApiKey });
                kiteClient.setAccessToken(kiteAccessToken);
                console.log(`[Kite] Session loaded for user ${kiteUserId}`);
                return true;
            }
        }
    } catch (e) {
        console.error('[Kite] Failed to load session:', e.message);
    }
    return false;
}

function saveKiteSession() {
    try {
        const dir = path.dirname(KITE_SESSION_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(KITE_SESSION_FILE, JSON.stringify({
            apiKey: kiteApiKey,
            apiSecret: kiteApiSecret,
            accessToken: kiteAccessToken,
            userId: kiteUserId,
            timestamp: new Date().toISOString()
        }));
    } catch (e) {
        console.error('[Kite] Failed to save session:', e.message);
    }
}

function clearKiteSession() {
    kiteClient = null;
    kiteApiKey = null;
    kiteApiSecret = null;
    kiteAccessToken = null;
    kiteUserId = null;
    kiteInstruments = null;
    kiteInstrumentsLastFetch = 0;
    try {
        if (fs.existsSync(KITE_SESSION_FILE)) fs.unlinkSync(KITE_SESSION_FILE);
    } catch (e) { /* ignore */ }
}

// Load session at startup
loadKiteSession();

// Map our instrument keys to Kite / Google Finance symbols
const INSTRUMENT_MAP = {
    'NIFTY': 'NIFTY_50:INDEXNSE',
    'BANKNIFTY': 'NIFTY_BANK:INDEXNSE',
    'FINNIFTY': 'NIFTY_FIN_SERVICE:INDEXNSE'
};

const KITE_UNDERLYING_MAP = {
    'NIFTY': 'NIFTY',
    'BANKNIFTY': 'BANKNIFTY',
    'FINNIFTY': 'NIFTY_FIN_SERVICE'
};

// Instrument parameters
const YF_SPOT_SYMBOL_MAP = {
    'NIFTY': '^NSEI',
    'BANKNIFTY': '^NSEBANK',
    'FINNIFTY': 'NIFTY_FIN_SERVICE.NS'
};

const INST_PARAMS = {
    'NIFTY': { step: 50 },
    'BANKNIFTY': { step: 100 },
    'FINNIFTY': { step: 50 }
};

// ── Kite Connect Instrument Helpers ─────────────────────────────
async function ensureKiteInstruments() {
    if (!kiteClient || !kiteAccessToken) return null;
    const now = Date.now();
    if (kiteInstruments && (now - kiteInstrumentsLastFetch) < KITE_INSTR_CACHE_TTL) {
        return kiteInstruments;
    }
    try {
        // Try loading from file cache first
        if (fs.existsSync(KITE_INSTR_CACHE_FILE)) {
            const age = now - fs.statSync(KITE_INSTR_CACHE_FILE).mtimeMs;
            if (age < KITE_INSTR_CACHE_TTL) {
                const data = JSON.parse(fs.readFileSync(KITE_INSTR_CACHE_FILE, 'utf-8'));
                kiteInstruments = data;
                kiteInstrumentsLastFetch = now;
                return kiteInstruments;
            }
        }
        console.log('[Kite] Downloading NFO instrument master...');
        kiteInstruments = await kiteClient.getInstruments('NFO');
        kiteInstrumentsLastFetch = now;
        // Cache to disk
        const dir = path.dirname(KITE_INSTR_CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(KITE_INSTR_CACHE_FILE, JSON.stringify(kiteInstruments));
        console.log(`[Kite] Loaded ${kiteInstruments.length} instruments`);
        return kiteInstruments;
    } catch (e) {
        console.error('[Kite] Failed to fetch instruments:', e.message);
        return kiteInstruments; // return stale cache if available
    }
}

function getNearestExpiry(instruments, underlying, minDays = 1) {
    const now = new Date();
    const expiries = [...new Set(
        instruments
            .filter(i => i.name === underlying && i.expiry)
            .map(i => i.expiry.split(' ')[0])
    )].sort();
    for (const expiry of expiries) {
        const d = new Date(expiry);
        const diff = (d - now) / (1000 * 60 * 60 * 24);
        if (diff >= minDays) return expiry;
    }
    return expiries[0];
}

async function getKiteSpotPrice(symbolKey) {
    if (!kiteClient || !kiteAccessToken) return null;
    const underlying = KITE_UNDERLYING_MAP[symbolKey];
    if (!underlying) return null;
    try {
        const quote = await kiteClient.getQuote([`NSE:${underlying}`]);
        const data = quote[`NSE:${underlying}`];
        if (data && data.last_price) {
            return {
                spot: data.last_price,
                change: data.change || ((data.last_price - (data.last_price / (1 + (data.change_percentage || 0) / 100))) || 0)
            };
        }
    } catch (e) {
        console.error(`[Kite] Spot price error for ${symbolKey}:`, e.message);
    }
    return null;
}

async function getKiteOptionChain(symbolKey, expiryDays) {
    if (!kiteClient || !kiteAccessToken) return null;
    const underlying = KITE_UNDERLYING_MAP[symbolKey];
    const inst = INST_PARAMS[symbolKey];
    if (!underlying || !inst) return null;

    const spotData = await getKiteSpotPrice(symbolKey);
    if (!spotData) return null;
    const spot = spotData.spot;
    const change = spotData.change;

    const instruments = await ensureKiteInstruments();
    if (!instruments) return null;

    const expiry = getNearestExpiry(instruments, underlying, Math.max(1, expiryDays));
    if (!expiry) return null;

    // Find relevant contracts
    const atmStrike = Math.round(spot / inst.step) * inst.step;
    const minStrike = atmStrike - 10 * inst.step;
    const maxStrike = atmStrike + 10 * inst.step;

    const options = instruments.filter(i =>
        i.name === underlying &&
        i.expiry && i.expiry.startsWith(expiry) &&
        i.instrument_type &&
        i.strike >= minStrike &&
        i.strike <= maxStrike
    );

    if (options.length === 0) return null;

    // Get live quotes
    const tokens = options.map(i => `${i.exchange}:${i.tradingsymbol}`);
    let quotes = {};
    try {
        quotes = await kiteClient.getQuote(tokens);
    } catch (e) {
        console.error('[Kite] Quote fetch error:', e.message);
        return null;
    }

    // Build strike map
    const strikeMap = {};
    for (const opt of options) {
        const key = `${opt.exchange}:${opt.tradingsymbol}`;
        const q = quotes[key] || {};
        if (!strikeMap[opt.strike]) {
            strikeMap[opt.strike] = { strike: opt.strike, ce: null, pe: null };
        }
        const optionData = {
            oi: q.oi || 0,
            oiChg: q.change_oi || 0,
            vol: q.volume || 0,
            iv: q.implied_volatility || 0,
            ltp: q.last_price || 0,
            chg: q.change || 0,
        };
        if (opt.instrument_type === 'CE') {
            strikeMap[opt.strike].ce = optionData;
            strikeMap[opt.strike].ceITM = opt.strike < spot;
        } else {
            strikeMap[opt.strike].pe = optionData;
            strikeMap[opt.strike].peITM = opt.strike > spot;
        }
    }

    const strikes = Object.values(strikeMap)
        .filter(s => s.ce || s.pe)
        .sort((a, b) => a.strike - b.strike);

    if (strikes.length === 0) return null;

    return {
        spot: parseFloat(spot.toFixed(2)),
        change: parseFloat(change.toFixed(2)) || 0,
        atmStrike,
        source: 'zerodha',
        strikes
    };
}

function seededRnd(seedStr, min, max) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = Math.imul(31, hash) + seedStr.charCodeAt(i) | 0;
    }
    const s = Math.sin(Math.abs(hash) + 1) * 10000;
    const rnd = s - Math.floor(s);
    return min + rnd * (max - min);
}

// Fetch live spot price from Yahoo Finance
async function getSpotPrice(symbolKey) {
    const yfSymbol = YF_SPOT_SYMBOL_MAP[symbolKey];
    if (!yfSymbol) return null;
    try {
        const q = await yf.quote(yfSymbol);
        if (q && q.regularMarketPrice) {
            return {
                spot: q.regularMarketPrice,
                change: q.regularMarketChangePercent || 0
            };
        }
        return null;
    } catch (e) {
        console.error(`[YF] Spot price error for ${symbolKey}:`, e.message);
        return null;
    }
}

app.get('/api/nse/option-chain/:symbol', async (req, res) => {
    const symbolKey = req.params.symbol.toUpperCase();
    const expiryDays = parseInt(req.query.expiryDays || '7');

    if (!INSTRUMENT_MAP[symbolKey]) {
        return res.status(400).json({ error: "Unsupported instrument" });
    }

    try {
        // Try Kite Connect first for real data
        if (kiteClient && kiteAccessToken) {
            const kiteData = await getKiteOptionChain(symbolKey, expiryDays);
            if (kiteData) {
                return res.json(kiteData);
            }
            console.log(`[Kite] Option chain failed for ${symbolKey}, falling back to synthetic`);
        }

        // Fall back to Google Finance scraping + synthetic data
        const priceData = await getSpotPrice(symbolKey);
        
        let spot = priceData?.spot || 24500;
        let change = priceData?.change || 0;

        const inst = INST_PARAMS[symbolKey];
        const atmStrike = Math.round(spot / inst.step) * inst.step;
        
        const strikes = [];
        for (let i = -10; i <= 10; i++) {
            const strike = atmStrike + i * inst.step;
            const isATM = i === 0;
            const distPct = Math.abs(strike - spot) / spot;

            const ceITM = strike < spot;
            const ceIntrinsic = ceITM ? Math.max(0, spot - strike) : 0;
            const ceTimeVal = seededRnd(`${spot}-${strike}-cetime`, 15, 200) * Math.exp(-distPct * 8) * Math.sqrt(expiryDays / 7);
            const ceLTP = parseFloat((ceIntrinsic + ceTimeVal).toFixed(2));
            const ceIV = parseFloat((seededRnd(`${spot}-${strike}-ceiv`, 11, 18) + distPct * 30 + (isATM ? 0 : seededRnd(`${spot}-${strike}-ceiv2`, 0, 4))).toFixed(2));
            const ceOI = Math.round(seededRnd(`${spot}-${strike}-ceoi`, 200000, 8000000) * (isATM ? 2.5 : Math.exp(-distPct * 6)));
            
            const peITM = strike > spot;
            const peIntrinsic = peITM ? Math.max(0, strike - spot) : 0;
            const peTimeVal = seededRnd(`${spot}-${strike}-petime`, 15, 200) * Math.exp(-distPct * 8) * Math.sqrt(expiryDays / 7);
            const peLTP = parseFloat((peIntrinsic + peTimeVal).toFixed(2));
            const peIV = parseFloat((seededRnd(`${spot}-${strike}-peiv`, 11, 18) + distPct * 30 + (isATM ? 0 : seededRnd(`${spot}-${strike}-peiv2`, 0, 4))).toFixed(2));
            const peOI = Math.round(seededRnd(`${spot}-${strike}-peoi`, 200000, 8000000) * (isATM ? 2.5 : Math.exp(-distPct * 6)));

            strikes.push({
                strike, isATM, ceITM, peITM,
                ce: { 
                    oi: ceOI, 
                    oiChg: Math.round(seededRnd(`${spot}-${strike}-ceoichg`, -ceOI * 0.15, ceOI * 0.25)), 
                    vol: Math.round(seededRnd(`${spot}-${strike}-cevol`, 50000, 2000000)), 
                    iv: ceIV, 
                    ltp: ceLTP, 
                    chg: parseFloat((seededRnd(`${spot}-${strike}-cechg`, -ceLTP * 0.12, ceLTP * 0.12)).toFixed(2)) 
                },
                pe: { 
                    oi: peOI, 
                    oiChg: Math.round(seededRnd(`${spot}-${strike}-peoichg`, -peOI * 0.15, peOI * 0.25)), 
                    vol: Math.round(seededRnd(`${spot}-${strike}-pevol`, 50000, 2000000)), 
                    iv: peIV, 
                    ltp: peLTP, 
                    chg: parseFloat((seededRnd(`${spot}-${strike}-pechg`, -peLTP * 0.12, peLTP * 0.12)).toFixed(2)) 
                },
            });
        }
        
        res.json({
            spot: parseFloat(spot.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            atmStrike,
            strikes
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Zerodha Kite Connect Broker API ────────────────────────────
app.post('/api/broker/zerodha/login', (req, res) => {
    const { apiKey, apiSecret } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'API Key is required' });
    if (!apiSecret) return res.status(400).json({ error: 'API Secret is required' });

    try {
        const kc = new KiteConnect({ api_key: apiKey });
        const loginUrl = kc.getLoginURL();
        return res.json({ loginUrl });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

app.post('/api/broker/zerodha/connect', async (req, res) => {
    const { apiKey, apiSecret, requestToken } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'API Key is required' });
    if (!apiSecret) return res.status(400).json({ error: 'API Secret is required' });
    if (!requestToken) return res.status(400).json({ error: 'Request token is required' });

    try {
        const kc = new KiteConnect({ api_key: apiKey });
        const session = await kc.generateSession(requestToken, apiSecret);
        kiteApiKey = apiKey;
        kiteApiSecret = apiSecret;
        kiteAccessToken = session.access_token;
        kiteUserId = session.user_id;
        kiteClient = kc;
        kiteClient.setAccessToken(kiteAccessToken);
        saveKiteSession();
        console.log(`[Kite] Connected as user ${kiteUserId}`);
        return res.json({ status: 'connected', userId: kiteUserId });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

app.get('/api/broker/zerodha/callback', async (req, res) => {
    const { request_token, action } = req.query;
    if (action === 'stop') {
        clearKiteSession();
        return res.redirect('http://localhost:5173/?zerodha=disconnected');
    }
    if (!request_token) {
        return res.status(400).send('<h2>Missing request token</h2><p>Please try connecting again.</p>');
    }
    try {
        const kc = new KiteConnect({ api_key: kiteApiKey });
        const session = await kc.generateSession(request_token, kiteApiSecret);
        kiteAccessToken = session.access_token;
        kiteUserId = session.user_id;
        kiteClient = kc;
        kiteClient.setAccessToken(kiteAccessToken);
        saveKiteSession();
        console.log(`[Kite] Connected as user ${kiteUserId}`);
        return res.redirect('http://localhost:5173/?zerodha=connected');
    } catch (e) {
        console.error('[Kite] Callback error:', e.message);
        return res.redirect(`http://localhost:5173/?zerodha=error&msg=${encodeURIComponent(e.message)}`);
    }
});

app.post('/api/broker/zerodha/disconnect', (req, res) => {
    clearKiteSession();
    return res.json({ status: 'disconnected' });
});

app.get('/api/broker/zerodha/status', async (req, res) => {
    if (!kiteClient || !kiteAccessToken) {
        return res.json({ connected: false });
    }
    try {
        const profile = await kiteClient.getProfile();
        return res.json({
            connected: true,
            userId: kiteUserId,
            userName: profile.user_name || profile.user_id,
            email: profile.email,
            broker: 'Zerodha'
        });
    } catch (e) {
        // Session expired or invalid
        console.error('[Kite] Status check failed:', e.message);
        return res.json({ connected: false, error: e.message });
    }
});

app.get('/api/broker/zerodha/quote/:symbol', async (req, res) => {
    if (!kiteClient || !kiteAccessToken) {
        return res.status(401).json({ error: 'Not connected to Zerodha' });
    }
    const symbol = req.params.symbol.toUpperCase();
    try {
        const { KITE_UNDERLYING_MAP } = require.cache;
        const underlying = KITE_UNDERLYING_MAP[symbol] || symbol;
        const quote = await kiteClient.getQuote([`NSE:${underlying}`]);
        return res.json(quote[`NSE:${underlying}`] || quote);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

app.get('/api/broker/zerodha/positions', async (req, res) => {
    if (!kiteClient || !kiteAccessToken) {
        return res.status(401).json({ error: 'Not connected to Zerodha' });
    }
    try {
        const positions = await kiteClient.getPositions();
        return res.json(positions);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

app.get('/api/broker/zerodha/holdings', async (req, res) => {
    if (!kiteClient || !kiteAccessToken) {
        return res.status(401).json({ error: 'Not connected to Zerodha' });
    }
    try {
        const holdings = await kiteClient.getHoldings();
        return res.json(holdings);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// ── Chart History (Real OHLC Data) ──────────────────────────────
const YH_SYMBOL_MAP = {
    'BTC': 'BTC-USD', 'ETH': 'ETH-USD', 'SOL': 'SOL-USD', 'ADA': 'ADA-USD', 'AVAX': 'AVAX-USD',
    'XAU/USD': 'GC=F', 'XAG/USD': 'SI=F', 'OIL': 'CL=F',
    'NIF': '^NSEI', 'BNK': '^NSEBANK', 'FIN': 'NIFTY_FIN_SERVICE.NS', 'REL': 'RELIANCE.NS',
};

const INTERVAL_RANGE_MAP = {
    '1m': { interval: '1m', periodDays: 1 },
    '5m': { interval: '5m', periodDays: 5 },
    '15m': { interval: '15m', periodDays: 14 },
    '1h': { interval: '1h', periodDays: 30 },
    '4h': { interval: '1h', periodDays: 60 },
    '1d': { interval: '1d', periodDays: 365 },
};

app.get('/api/chart/history', async (req, res) => {
    const symbol = req.query.symbol?.toUpperCase();
    const intervalId = req.query.interval || '1h';

    if (!symbol) return res.status(400).json({ error: 'symbol required' });

    const yhSymbol = YH_SYMBOL_MAP[symbol];
    if (!yhSymbol) return res.status(400).json({ error: `Unsupported symbol: ${symbol}` });

    const tf = INTERVAL_RANGE_MAP[intervalId] || INTERVAL_RANGE_MAP['1h'];
    const period1 = Math.floor(Date.now() / 1000) - tf.periodDays * 86400;

    try {
        const roundPrice = (v) => v != null ? Math.round(v * 100) / 100 : v;

        const result = await yf.chart(yhSymbol, { period1, interval: tf.interval });
        const quotes = (result.quotes || []).map(q => ({
            time: q.date,
            open: roundPrice(q.open),
            high: roundPrice(q.high),
            low: roundPrice(q.low),
            close: roundPrice(q.close),
            volume: q.volume,
        })).filter(q => q.open != null && q.close != null).slice(-500);

        // If interval is 4h, aggregate 1h candles into 4h
        let ohlc = quotes;
        if (intervalId === '4h') {
            ohlc = [];
            for (let i = 0; i < quotes.length; i += 4) {
                const chunk = quotes.slice(i, i + 4).filter(c => c.close != null);
                if (chunk.length === 0) continue;
                ohlc.push({
                    time: chunk[0].time,
                    open: chunk[0].open,
                    high: Math.max(...chunk.map(c => c.high)),
                    low: Math.min(...chunk.map(c => c.low)),
                    close: chunk[chunk.length - 1].close,
                    volume: chunk.reduce((s, c) => s + (c.volume || 0), 0),
                });
            }
        }

        res.json({ symbol, interval: intervalId, ohlc });
    } catch (e) {
        console.error(`[Chart] History error for ${yhSymbol}:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// ── F&O AI Agent endpoints ──────────────────────────────────────
app.get('/api/fno-agent/status', (req, res) => {
    try {
        if (fs.existsSync(STATUS_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
            return res.json(data);
        }
        res.json({ mode: 'idle', timestamp: new Date().toISOString() });
    } catch (e) {
        res.json({ mode: 'error', error: e.message });
    }
});

app.post('/api/fno-agent/start', (req, res) => {
    if (agentProcess) {
        return res.json({ status: 'already_running' });
    }
    const script = path.join(FNO_AGENT_DIR, 'orchestrator', 'main_orchestrator.py');
    agentProcess = spawn('python', [script], {
        cwd: FNO_AGENT_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });
    agentProcess.stdout.on('data', d => console.log(`[FNO-Agent] ${d.toString().trim()}`));
    agentProcess.stderr.on('data', d => console.error(`[FNO-Agent] ${d.toString().trim()}`));
    agentProcess.on('exit', code => {
        console.log(`[FNO-Agent] exited with code ${code}`);
        agentProcess = null;
    });
    res.json({ status: 'started', mode: 'running', paper_trade: true });
});

app.post('/api/fno-agent/stop', (req, res) => {
    if (!agentProcess) {
        return res.json({ status: 'not_running' });
    }
    agentProcess.kill('SIGTERM');
    setTimeout(() => {
        if (agentProcess) {
            agentProcess.kill('SIGKILL');
            agentProcess = null;
        }
    }, 3000);
    res.json({ status: 'stopping' });
});

// ── Web News Search (uses yahoo-finance2) ─────────────────────────
app.get('/api/fno-agent/news', async (req, res) => {
    const query = req.query.query || req.query.symbol;
    if (!query) return res.status(400).json({ error: 'query parameter required' });
    try {
        const result = await yf.search(query);
        const headlines = (result.news || []).slice(0, 5).map(n => ({
            title: n.title,
            publisher: n.publisher,
            link: n.link,
            time: n.providerPublishTime,
            tickers: n.relatedTickers || []
        }));
        res.json({ query, headlines });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Config Persistence (backup for client-side settings) ─────────
app.get('/api/config/load', (req, res) => {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            return res.json({ config: data });
        }
        res.json({ config: null });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/config/save', (req, res) => {
    try {
        const data = req.body;
        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'No data provided' });
        }
        const dir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
        res.json({ status: 'saved' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Live Data Proxy Server running on http://localhost:${PORT}`);
});
