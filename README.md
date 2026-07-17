<p align="center">
  <img src="src/assets/alpha-algo-logo.png" alt="Alpha Algo" width="500" height="500">
</p>

<h1 align="center">Alpha Algo</h1>

<p align="center">
  Crypto & F&O trading terminal with live charts, technical indicators, trade verdicts, and broker integrations
</p>

## Features

- **Live Charts** — Candlestick, OHLC, Heikin-Ashi, Line, Area charts with zoom, pan, and selection
- **Technical Indicators** — RSI, MACD, EMA, Bollinger Bands, Ichimoku, Volume Profile, Smart Money Concepts, and more
- **Trade Verdict** — Aggregates all indicators and shows BUY/SELL/HOLD per asset based on >70% consensus
- **Broker Integrations** — Connect Zerodha Kite, Angel One, Coinbase, and other brokers via OAuth
- **Multi-Asset** — Crypto (CoinGecko) and Indian F&O (NSE) support
- **Auto Trading** — Configurable entry/exit rules with trailing stop-loss and take-profit

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- npm

### Install

```bash
git clone https://github.com/prajprem/Alpha-algo.git
cd Alpha-algo
npm install
pip install -r server/requirements.txt
```

### Run (3 servers)

**Terminal 1 — Express Backend (port 5000)**
```bash
node server.js
```

**Terminal 2 — Python FastAPI (port 8000)**
```bash
cd server && python main.py
```

**Terminal 3 — Vite Frontend (port 5173)**
```bash
npx vite --host 0.0.0.0
```

Open **http://localhost:5173**

### GitHub Codespaces
Click **Code → Open with Codespaces** — servers start automatically.

## Architecture

```
Alpha-algo/
├── server.js          # Express backend (Yahoo Finance, NSE, F&O Agent, Broker API)
├── server/main.py     # Python FastAPI (AI sentiment, WebSocket)
├── src/
│   ├── App.jsx        # Main app (routing, indicator computation, trade engine)
│   ├── indicators.js  # All technical indicators
│   ├── constants.js   # Config, asset lists, color theme
│   └── pages/         # Tab components
│       ├── ChartsPage.jsx      # Live chart with zoom/pan/selection
│       ├── TradeVerdictTab.jsx # BUY/SELL/HOLD verdicts
│       ├── TradesTab.jsx       # Active & closed trades
│       ├── ConnectionsTab.jsx  # Broker connections
│       └── ...
└── public/            # Static assets


## Tech Stack

- **Frontend:** React 19, Vite 8
- **Backend:** Node.js (Express), Python (FastAPI)
- **Data:** Yahoo Finance, CoinGecko, NSE India
- **Brokers:** Zerodha Kite Connect API
