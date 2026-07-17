"""
TradingAgents Backend - Multi-Agent LLM Trading Analysis
FastAPI server that orchestrates a team of LLM agents to analyze assets.

Rate-limit aware: merges 8 original calls into 3 combined calls to stay
within Gemini free-tier quota. Includes a global rate limiter and
smart retry with the actual retry_delay returned in 429 errors.
"""
import os, json, time, asyncio, random, re
import httpx
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="TradingAgents API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=True)

# ── Global rate limiter: enforce minimum gap between consecutive LLM calls ──
_last_llm_call_time: float = 0.0
_RATE_LIMIT_GAP = 11.0  # seconds between calls (Free tier ~5 RPM)
_llm_lock = asyncio.Lock()

async def _rate_limit_wait():
    global _last_llm_call_time
    async with _llm_lock:
        now = time.monotonic()
        gap = now - _last_llm_call_time
        if gap < _RATE_LIMIT_GAP:
            wait = _RATE_LIMIT_GAP - gap
            print(f"DEBUG: Rate limiter sleeping {wait:.1f}s before next LLM call")
            await asyncio.sleep(wait)
        _last_llm_call_time = time.monotonic()

# --- LLM Provider Abstraction ---

async def call_llm(prompt: str, provider: str, api_key: str, model: str = None, system: str = None) -> str:
    """Call any supported LLM provider with smart retry respecting the retry_delay in 429 errors."""
    if provider != "ollama":
        await _rate_limit_wait()
    max_retries = 3
    for attempt in range(max_retries):
        try:
            if provider == "openai":
                return await _call_openai(prompt, api_key, model or "gpt-4o-mini", system)
            elif provider == "anthropic":
                return await _call_anthropic(prompt, api_key, model or "claude-haiku-20240307", system)
            elif provider == "gemini":
                return await _call_gemini(prompt, api_key, model or "gemini-1.5-flash-8b", system)
            elif provider == "openrouter":
                return await _call_openrouter(prompt, api_key, model or "google/gemini-2.0-flash-lite-preview-02-05:free", system)
            elif provider == "ollama":
                return await _call_ollama(prompt, model or "gemma2", system)
            raise ValueError(f"Unknown provider: {provider}")
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "rate limit" in err_str.lower():
                print(f"RAW RATE LIMIT ERROR: {err_str}")
                
                delay = 15.0  # default safe wait
                m = re.search(r'retry.*?(\d+(?:\.\d+)?)\s*s', err_str, re.IGNORECASE)
                if m:
                    delay = float(m.group(1)) + 2.0  # add a 2s buffer
                delay += random.uniform(1.0, 3.0)  # jitter
                print(f"DEBUG: 429 Rate limited by {provider}. Waiting {delay:.1f}s (attempt {attempt+1}/{max_retries})")
                await asyncio.sleep(delay)
                await _rate_limit_wait()
            else:
                raise e

async def _call_openai(prompt: str, api_key: str, model: str, system: str = None) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)
    msgs = []
    if system: msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})
    r = await client.chat.completions.create(model=model, messages=msgs, temperature=0.7, max_tokens=1000)
    return r.choices[0].message.content

async def _call_openrouter(prompt: str, api_key: str, model: str, system: str = None) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")
    msgs = []
    if system: msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})
    r = await client.chat.completions.create(model=model, messages=msgs, temperature=0.7, max_tokens=1000)
    return r.choices[0].message.content

async def _call_anthropic(prompt: str, api_key: str, model: str, system: str = None) -> str:
    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=api_key)
    r = await client.messages.create(
        model=model, max_tokens=1000, temperature=0.7,
        system=system or "You are a financial analyst.",
        messages=[{"role": "user", "content": prompt}]
    )
    return r.content[0].text

async def _call_gemini(prompt: str, api_key: str, model: str, system: str = None) -> str:
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    m = genai.GenerativeModel(model, system_instruction=system or "You are a financial analyst.")
    r = await asyncio.to_thread(lambda: m.generate_content(prompt).text)
    return r

async def _call_ollama(prompt: str, model: str, system: str = None) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key="ollama", base_url="http://localhost:11434/v1")
    msgs = []
    if system: msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})
    r = await client.chat.completions.create(model=model, messages=msgs, temperature=0.7, max_tokens=1000)
    return r.choices[0].message.content

# --- System Prompts ---
FUNDAMENTAL_SYSTEM = """You are a Fundamental Analyst.
Analyze the asset data and provide a concise fundamental perspective.
Return ONLY valid JSON. DO NOT use unescaped double quotes inside the JSON string values.
{"signal": "BULLISH|BEARISH|NEUTRAL", "report": "1-2 sentences summarizing fundamental view"}
"""

SENTIMENT_SYSTEM = """You are a Sentiment Analyst.
Analyze the market sentiment based on technical indicators and price action.
Return ONLY valid JSON. DO NOT use unescaped double quotes inside the JSON string values.
{"signal": "BULLISH|BEARISH|NEUTRAL", "score": 0.0, "report": "1-2 sentences summarizing sentiment"}
"""

NEWS_SYSTEM = """You are a News and Event Analyst (simulated).
Based on the technical data and asset, extrapolate potential market events or structural momentum.
Return ONLY valid JSON. DO NOT use unescaped double quotes inside the JSON string values.
{"signal": "BULLISH|BEARISH|NEUTRAL", "report": "1-2 sentences summarizing news/momentum"}
"""

TECHNICAL_SYSTEM = """You are a Technical Analyst.
Evaluate the indicators and price action. Identify key patterns.
Return ONLY valid JSON. DO NOT use unescaped double quotes inside the JSON string values.
{"signal": "BULLISH|BEARISH|NEUTRAL", "patterns": ["Pattern 1", "Pattern 2"], "report": "1-2 sentences summarizing technicals"}
"""

BULL_SYSTEM = """You are a Bull Researcher.
Make the best possible BULLISH case based on the provided analyst reports.
Return ONLY valid JSON. DO NOT use unescaped double quotes inside the JSON string values.
{"arguments": ["Argument 1", "Argument 2"], "conviction": 75, "score": 8}
"""

BEAR_SYSTEM = """You are a Bear Researcher.
Make the best possible BEARISH case based on the provided analyst reports.
Return ONLY valid JSON. DO NOT use unescaped double quotes inside the JSON string values.
{"arguments": ["Argument 1", "Argument 2"], "conviction": 75, "score": 8}
"""

TRADER_SYSTEM = """You are the Head Trader.
Review the analyst reports and the Bull vs Bear debate.
Make a decisive trading decision.
Return ONLY valid JSON. DO NOT use unescaped double quotes inside the JSON string values.
{"action": "BUY|SELL|HOLD", "conviction": 80, "reasoning": "Your reasoning...", "suggestedEntry": 0, "suggestedSL": 0, "suggestedTP": 0, "positionSize": 0.1}
"""

RISK_SYSTEM = """You are the Risk Manager.
Evaluate the proposed trade decision. Approve or reject it based on risk factors.
Return ONLY valid JSON. DO NOT use unescaped double quotes inside the JSON string values.
{"approved": true, "riskLevel": "LOW|MODERATE|HIGH", "assessment": "Risk reasoning...", "concerns": ["Concern 1", "Concern 2"]}
"""

# --- Request/Response Models ---

class AnalyzeRequest(BaseModel):
    symbol: str
    price: float
    indicators: dict = {}
    hist: list = []
    provider: str = "gemini"
    apiKey: str = ""
    model: str = ""
    depth: str = "medium"
    learningContext: dict = {}

class AgentConfigRequest(BaseModel):
    provider: str = "gemini"
    apiKey: str = ""
    model: str = ""
    depth: str = "medium"

# --- State ---
current_status = {"state": "idle", "progress": 0, "current_agent": None, "symbol": None}
ws_clients: list[WebSocket] = []

async def broadcast(msg: dict):
    for ws in ws_clients[:]:
        try: await ws.send_json(msg)
        except: ws_clients.remove(ws)

def parse_json_response(text: str) -> dict:
    """Extract JSON from LLM response, handling markdown fences and extra text."""
    text = text.strip()
    if "```json" in text: text = text.split("```json")[1].split("```")[0]
    elif "```" in text: text = text.split("```")[1].split("```")[0]
    
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        text = text[start:end+1]
        
    try: return json.loads(text.strip())
    except Exception as e:
        print(f"DEBUG JSON Parse Error. Raw text:\n{text}\n")
        return {"report": text, "signal": "NEUTRAL", "error": f"Failed to parse JSON: {e}"}

async def run_agent(name: str, system: str, prompt: str, provider: str, api_key: str, model: str, broadcast_name: str = None) -> dict:
    """Run a single agent and return parsed result."""
    global current_status
    actual_name = broadcast_name or name
    current_status["current_agent"] = actual_name
    await broadcast({"type": "agent_update", "agent": actual_name, "status": "analyzing"})
    try:
        raw = await call_llm(prompt, provider, api_key, model, system)
        result = parse_json_response(raw)
        await broadcast({"type": "agent_update", "agent": actual_name, "status": "complete", "result": result})
        return result
    except Exception as e:
        err = {"report": f"Error: {str(e)}", "signal": "NEUTRAL", "error": str(e)}
        await broadcast({"type": "agent_update", "agent": actual_name, "status": "error", "error": str(e)})
        return err

async def run_analysis(req: AnalyzeRequest) -> dict:
    """
    Run the full 8-agent pipeline individually (no API limits).
    """
    global current_status
    provider = req.provider
    print(f"DEBUG: provider={provider}, api_key={'[SET]' if req.apiKey else '[EMPTY]'}")
    api_key = req.apiKey or os.getenv(f"{provider.upper()}_API_KEY", "")
    model = req.model.strip() if req.model else ""
    
    if not model or model.lower() == "auto-select" or (provider == "openrouter" and "gemini" in model.lower()):
        if provider == "openrouter": model = "google/gemma-4-31b-it:free"
        elif provider == "openai": model = "gpt-4o"
        elif provider == "anthropic": model = "claude-3-5-sonnet-latest"
        else: model = "gemini-2.0-flash"

    if not api_key and provider != "ollama":
        return {"status": "error", "error": f"No API key for {provider}. Set it in Settings > AI Agents."}

    try:
        current_status = {"state": "running", "progress": 0, "current_agent": None, "symbol": req.symbol}
        await broadcast({"type": "pipeline_start", "symbol": req.symbol})

        ind_summary = json.dumps({k: v for k, v in req.indicators.items() if v is not None}, default=str)
        asset_ctx = f"Asset: {req.symbol} | Price: ${req.price:,.4f}\nIndicators: {ind_summary}"

        # 1. Fundamental
        current_status["progress"] = 10
        fundamental = await run_agent("fundamental", FUNDAMENTAL_SYSTEM, asset_ctx, provider, api_key, model)
        if "report" not in fundamental: fundamental["report"] = fundamental.get("error", "No report available")
        if "signal" not in fundamental: fundamental["signal"] = "NEUTRAL"
        
        # 2. Sentiment
        current_status["progress"] = 20
        sentiment = await run_agent("sentiment", SENTIMENT_SYSTEM, asset_ctx, provider, api_key, model)
        if "report" not in sentiment: sentiment["report"] = sentiment.get("error", "No report available")
        if "signal" not in sentiment: sentiment["signal"] = "NEUTRAL"
        
        # 3. News
        current_status["progress"] = 30
        news = await run_agent("news", NEWS_SYSTEM, asset_ctx, provider, api_key, model)
        if "report" not in news: news["report"] = news.get("error", "No report available")
        if "signal" not in news: news["signal"] = "NEUTRAL"
        
        # 4. Technical
        current_status["progress"] = 40
        technical = await run_agent("technical", TECHNICAL_SYSTEM, asset_ctx, provider, api_key, model)
        if "report" not in technical: technical["report"] = technical.get("error", "No report available")
        if "signal" not in technical: technical["signal"] = "NEUTRAL"
        if "patterns" not in technical: technical["patterns"] = [technical.get("error", "")] if "error" in technical else []

        # 5 & 6: Bull & Bear Debate
        analyst_summary = (
            f"Fundamental: {fundamental.get('signal','?')} — {fundamental.get('report','')}\n"
            f"Sentiment: {sentiment.get('signal','?')} — {sentiment.get('report','')}\n"
            f"News: {news.get('signal','?')} — {news.get('report','')}\n"
            f"Technical: {technical.get('signal','?')} — {technical.get('report','')}"
        )
        
        current_status["progress"] = 50
        bull = await run_agent("bull", BULL_SYSTEM, analyst_summary, provider, api_key, model)
        if "arguments" not in bull: bull["arguments"] = [bull.get("report", bull.get("error", "No arguments provided."))]
        if "score" not in bull: bull["score"] = 5
        if "conviction" not in bull: bull["conviction"] = 50
        
        current_status["progress"] = 60
        bear = await run_agent("bear", BEAR_SYSTEM, analyst_summary, provider, api_key, model)
        if "arguments" not in bear: bear["arguments"] = [bear.get("report", bear.get("error", "No arguments provided."))]
        if "score" not in bear: bear["score"] = 5
        if "conviction" not in bear: bear["conviction"] = 50

        # 7. Trader Decision
        current_status["progress"] = 75
        debate_summary = f"Bull Case: {bull}\nBear Case: {bear}"
        trader_ctx = f"Asset Context:\n{asset_ctx}\n\nAnalyst Reports:\n{analyst_summary}\n\nDebate:\n{debate_summary}\nCurrent Price: {req.price}"
        decision = await run_agent("trader", TRADER_SYSTEM, trader_ctx, provider, api_key, model)
        if "action" not in decision: decision["action"] = "HOLD"
        if "conviction" not in decision: decision["conviction"] = 0
        if "reasoning" not in decision: decision["reasoning"] = decision.get("report", decision.get("error", "Could not parse trader reasoning."))
        if "suggestedEntry" not in decision: decision["suggestedEntry"] = req.price
        if "suggestedSL" not in decision: decision["suggestedSL"] = req.price * 0.95
        if "suggestedTP" not in decision: decision["suggestedTP"] = req.price * 1.05
        if "positionSize" not in decision: decision["positionSize"] = 0.1
        
        # 8. Risk Manager
        current_status["progress"] = 90
        risk_ctx = f"Asset Context:\n{asset_ctx}\n\nTrade Decision:\n{decision}"
        risk = await run_agent("risk", RISK_SYSTEM, risk_ctx, provider, api_key, model)
        if "approved" not in risk: risk["approved"] = False
        if "assessment" not in risk: risk["assessment"] = risk.get("report", risk.get("error", "Risk assessment unavailable."))
        if "riskLevel" not in risk: risk["riskLevel"] = "HIGH"
        if "concerns" not in risk: risk["concerns"] = [risk.get("error", "Unknown error")] if "error" in risk else []

        current_status = {"state": "idle", "progress": 100, "current_agent": None, "symbol": None}

        # Determine winner
        winner = "TIE"
        bull_s = float(bull.get('score', 0)) if isinstance(bull.get('score', 0), (int, float, str)) else 0
        bear_s = float(bear.get('score', 0)) if isinstance(bear.get('score', 0), (int, float, str)) else 0
        if bull_s > bear_s: winner = "BULL"
        elif bear_s > bull_s: winner = "BEAR"
        
        bull['score'] = bull_s
        bear['score'] = bear_s

        res = {
            "status": "complete",
            "symbol": req.symbol,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "agents": {
                "fundamental": fundamental,
                "sentiment": sentiment,
                "news": news,
                "technical": technical,
            },
            "debate": {
                "bull": bull,
                "bear": bear,
                "rounds": 1,
                "winner": winner,
            },
            "decision": decision,
            "risk": risk
        }
        await broadcast({"type": "pipeline_complete", "symbol": req.symbol, "result": res})
        return res
    except Exception as e:
        current_status = {"state": "idle", "progress": 0, "current_agent": None, "symbol": None}
        err_msg = f"Analysis failed: {str(e)}"
        print(err_msg)
        await broadcast({"type": "pipeline_error", "symbol": req.symbol, "error": str(e)})
        return {"status": "error", "error": err_msg}

# --- API Endpoints ---

@app.get("/")
def root():
    return {"name": "TradingAgents API", "version": "1.0.0", "status": "running"}

@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/health")
def health_alias():
    return health()

@app.get("/api/agents/status")
def agent_status():
    return current_status

_analysis_started_at: float = 0.0
ANALYSIS_TIMEOUT_SECS = 120  # auto-reset if stuck longer than this

@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    global current_status, _analysis_started_at
    if current_status.get("state") == "running":
        # Safety valve: if analysis has been "running" for too long, it's stuck — auto-reset
        elapsed = time.monotonic() - _analysis_started_at
        if elapsed < ANALYSIS_TIMEOUT_SECS:
            remaining = int(ANALYSIS_TIMEOUT_SECS - elapsed)
            print(f"DEBUG: Analysis already in progress for {req.symbol} (running {elapsed:.0f}s, timeout in {remaining}s)")
            return {"status": "error", "error": "Analysis already in progress"}
        else:
            print(f"DEBUG: Stale analysis detected ({elapsed:.0f}s). Auto-resetting state.")
            current_status = {"state": "idle", "progress": 0, "current_agent": None, "symbol": None}

    _analysis_started_at = time.monotonic()
    current_status["state"] = "running"
    try:
        return await run_analysis(req)
    except asyncio.CancelledError:
        current_status = {"state": "idle", "progress": 0, "current_agent": None, "symbol": None}
        raise
    finally:
        if current_status.get("state") == "running":
            current_status = {"state": "idle", "progress": 0, "current_agent": None, "symbol": None}


@app.post("/api/agents/config")
def config(req: AgentConfigRequest):
    # Validate provider
    if req.provider not in ("openai", "anthropic", "gemini", "openrouter"):
        return {"status": "error", "error": f"Unsupported provider: {req.provider}"}
    return {"status": "ok", "provider": req.provider, "model": req.model, "depth": req.depth}

@app.get("/api/prices/fno")
async def fno_prices():
    """Fetch real-time F&O prices from Yahoo Finance."""
    symbols = {
        "NIF": "%5ENSEI",       # Nifty 50
        "BNK": "%5ENSEBANK",    # Bank Nifty
        "FIN": "NIFTY_FIN_SERVICE.NS", # FinNifty
        "REL": "RELIANCE.NS",   # Reliance
        "XAU/USD": "GC=F",      # Gold
        "XAG/USD": "SI=F",      # Silver
        "OIL": "CL=F",          # Oil
    }
    results = {}
    async with httpx.AsyncClient(timeout=10) as client:
        for sym, yf_id in symbols.items():
            try:
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yf_id}?interval=1m&range=1d"
                headers = {"User-Agent": "Mozilla/5.0"}
                r = await client.get(url, headers=headers)
                data = r.json()
                chart = data.get("chart", {}).get("result", [{}])[0]
                meta = chart.get("meta", {})
                price = meta.get("regularMarketPrice", 0)
                prev_close = meta.get("previousClose", price)
                change_pct = ((price - prev_close) / prev_close * 100) if prev_close else 0
                results[sym] = {
                    "usd": price,
                    "usd_24h_change": round(change_pct, 2),
                    "high": meta.get("regularMarketDayHigh", price),
                    "low": meta.get("regularMarketDayLow", price),
                    "volume": meta.get("regularMarketVolume", 0),
                    "source": "yahoo_finance",
                }
            except Exception as e:
                results[sym] = {"error": str(e)}
    return results

@app.get("/api/prices/crypto")
async def crypto_prices():
    """Fetch real-time crypto prices from CoinGecko."""
    ids = "bitcoin,ethereum,solana,cardano,avalanche-2"
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(f"https://api.coingecko.com/api/v3/simple/price?ids={ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true")
            return r.json()
        except Exception as e:
            return {"error": str(e)}

@app.websocket("/ws/agents")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    ws_clients.append(ws)
    try:
        while True:
            data = await ws.receive_text()
            # Handle ping/pong
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        ws_clients.remove(ws)

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    reload = os.getenv("RELOAD", "false").lower() in ("1", "true", "yes")
    uvicorn.run("main:app", host=host, port=port, reload=reload)
