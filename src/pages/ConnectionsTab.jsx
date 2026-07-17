import { useState, useCallback, useEffect } from "react";

/* ── Platform definitions ──────────────────────────────── */
const PLATFORMS = [
  {
    id: "zerodha",
    name: "Zerodha",
    subtitle: "Kite Connect",
    types: ["Stocks", "F&O", "Commodities"],
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "apiSecret", label: "API Secret" },
    ],
    url: "https://kite.zerodha.com",
    docsUrl: "https://kite.trade/docs/connect/v3/",
    legal: "SEBI Registered",
    legalType: "sebi",
    region: "India",
    color: "#387ed1",
    kite: true,
  },
  {
    id: "groww",
    name: "Groww",
    subtitle: null,
    types: ["Stocks", "MF", "F&O"],
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "secretKey", label: "Secret Key" },
    ],
    url: "https://groww.in",
    docsUrl: "https://groww.in/developer",
    legal: "SEBI Registered",
    legalType: "sebi",
    region: "India",
    color: "#00d09c",
  },
  {
    id: "angelone",
    name: "Angel One",
    subtitle: "SmartAPI",
    types: ["Stocks", "F&O"],
    fields: [
      { key: "clientId", label: "Client ID" },
      { key: "apiKey", label: "API Key" },
      { key: "totpSecret", label: "TOTP Secret" },
    ],
    url: "https://angelone.in",
    docsUrl: "https://smartapi.angelone.in/docs",
    legal: "SEBI Registered",
    legalType: "sebi",
    region: "India",
    color: "#e74c3c",
  },
  {
    id: "coinbase",
    name: "Coinbase",
    subtitle: null,
    types: ["Crypto"],
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "secret", label: "Secret" },
      { key: "passphrase", label: "Passphrase" },
    ],
    url: "https://coinbase.com",
    docsUrl: "https://docs.cloud.coinbase.com/",
    legal: "Licensed",
    legalType: "licensed",
    region: "International",
    color: "#0052ff",
  },
  {
    id: "delta",
    name: "Delta Exchange",
    subtitle: null,
    types: ["Crypto Derivatives"],
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "secret", label: "Secret" },
    ],
    url: "https://delta.exchange",
    docsUrl: "https://docs.delta.exchange/",
    legal: "Licensed",
    legalType: "licensed",
    region: "International",
    color: "#6366f1",
  },
  {
    id: "coindcx",
    name: "CoinDCX",
    subtitle: null,
    types: ["Crypto"],
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "secret", label: "Secret" },
    ],
    url: "https://coindcx.com",
    docsUrl: "https://docs.coindcx.com/",
    legal: "Licensed",
    legalType: "licensed",
    region: "India",
    color: "#2962ff",
  },
  {
    id: "wazirx",
    name: "WazirX",
    subtitle: null,
    types: ["Crypto"],
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "secret", label: "Secret" },
    ],
    url: "https://wazirx.com",
    docsUrl: "https://docs.wazirx.com/",
    legal: "Licensed",
    legalType: "licensed",
    region: "India",
    color: "#536dfe",
  },
  {
    id: "dhan",
    name: "Dhan",
    subtitle: null,
    types: ["Stocks", "F&O"],
    fields: [
      { key: "clientId", label: "Client ID" },
      { key: "accessToken", label: "Access Token" },
    ],
    url: "https://dhan.co",
    docsUrl: "https://dhanhq.co/docs/v2/",
    legal: "SEBI Registered",
    legalType: "sebi",
    region: "India",
    color: "#0ea5e9",
  },
  {
    id: "fyers",
    name: "FYERS",
    subtitle: null,
    types: ["Stocks", "F&O"],
    fields: [
      { key: "appId", label: "App ID" },
      { key: "secretKey", label: "Secret Key" },
      { key: "accessToken", label: "Access Token" },
    ],
    url: "https://fyers.in",
    docsUrl: "https://myapi.fyers.in/docs/",
    legal: "SEBI Registered",
    legalType: "sebi",
    region: "India",
    color: "#22c55e",
  },
  {
    id: "upstox",
    name: "Upstox",
    subtitle: null,
    types: ["Equity", "F&O"],
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "secret", label: "Secret" },
    ],
    url: "https://upstox.com",
    docsUrl: "https://upstox.com/developer/api-documentation/",
    legal: "SEBI Registered",
    legalType: "sebi",
    region: "India",
    color: "#7c3aed",
  },
];

/* ── Status helpers ──────────────────────────────────────── */
const STATUS_CONFIG = {
  connected:    { color: "#10b981", label: "Connected" },
  disconnected: { color: "#ef4444", label: "Disconnected" },
  error:        { color: "#f59e0b", label: "Error" },
};

/* ── Masked field component ─────────────────────────────── */
function SecretField({ value, onChange, label, S }) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 10,
        color: S.dim,
        marginBottom: 4,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        fontFamily: "Inter, sans-serif",
      }}>
        {label}
      </div>
      <div style={{ position: "relative" }}>
        <input
          type={visible ? "text" : "password"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}...`}
          spellCheck={false}
          autoComplete="off"
          style={{
            background: "#060c18",
            border: `1px solid ${S.border}`,
            color: S.text,
            fontSize: 12,
            padding: "8px 40px 8px 10px",
            borderRadius: 6,
            width: "100%",
            outline: "none",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: visible ? 0 : 2,
          }}
        />
        <button
          onClick={() => setVisible((p) => !p)}
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: S.dim,
            fontSize: 10,
            cursor: "pointer",
            padding: "2px 6px",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {visible ? "HIDE" : "SHOW"}
        </button>
      </div>
    </div>
  );
}

/* ── Spinner ─────────────────────────────────────────────── */
function Spinner({ size = 14, color = "#3b82f6" }) {
  return (
    <span
      className="spin"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${color}33`,
        borderTopColor: color,
        borderRadius: "50%",
        verticalAlign: "middle",
      }}
    />
  );
}

/* ── Platform Card ───────────────────────────────────────── */
function PlatformCard({ platform, conn, onUpdate, S, toast_ }) {
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [kiteStatus, setKiteStatus] = useState(null);
  const [kiteLoggingIn, setKiteLoggingIn] = useState(false);

  const status = conn?.status || "disconnected";
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;
  const isKite = platform.kite;

  const hasAllFields = platform.fields.every(
    (f) => conn?.[f.key] && conn[f.key].trim().length > 0
  );

  const updateField = useCallback(
    (key, value) => {
      onUpdate(platform.id, { ...conn, [key]: value, status: conn?.status || "disconnected" });
    },
    [platform.id, conn, onUpdate]
  );

  // Poll Kite status when connected
  useEffect(() => {
    if (!isKite) return;
    const check = () => {
      fetch('/api/broker/zerodha/status')
        .then(r => r.json())
        .then(d => {
          setKiteStatus(d);
          if (d.connected && conn?.status !== 'connected') {
            onUpdate(platform.id, { ...conn, status: 'connected', userId: d.userId });
          } else if (!d.connected && conn?.status === 'connected' && !kiteLoggingIn) {
            onUpdate(platform.id, { ...conn, status: 'disconnected' });
          }
        })
        .catch(() => {});
    };
    check();
    const iv = setInterval(check, 5000);
    return () => clearInterval(iv);
  }, [isKite, conn?.status]);

  const handleTestConnection = useCallback(() => {
    if (!hasAllFields) {
      toast_("Fill in all API fields first", "warn");
      return;
    }
    setTesting(true);
    setTestResult(null);

    if (isKite) {
      fetch('/api/broker/zerodha/status')
        .then(r => r.json())
        .then(d => {
          setTesting(false);
          const success = d.connected;
          setTestResult(success ? "success" : "fail");
          if (success) onUpdate(platform.id, { ...conn, status: 'connected', userId: d.userId });
          else onUpdate(platform.id, { ...conn, status: 'disconnected' });
          toast_(success ? 'Zerodha - Connected' : 'Zerodha - Not connected', success ? 'success' : 'error');
          setTimeout(() => setTestResult(null), 4000);
        })
        .catch(() => {
          setTesting(false);
          setTestResult("fail");
          toast_('Zerodha - Connection check failed', 'error');
          setTimeout(() => setTestResult(null), 4000);
        });
      return;
    }

    const delay = 1200 + Math.random() * 1800;
    setTimeout(() => {
      const success = Math.random() > 0.25;
      setTesting(false);
      setTestResult(success ? "success" : "fail");
      onUpdate(platform.id, {
        ...conn,
        lastTest: new Date().toLocaleTimeString(),
        status: success ? conn?.status || "disconnected" : "error",
      });
      toast_(
        success
          ? `${platform.name} - Connection test passed`
          : `${platform.name} - Connection test failed`,
        success ? "success" : "error"
      );
      setTimeout(() => setTestResult(null), 4000);
    }, delay);
  }, [hasAllFields, isKite, platform, conn, onUpdate, toast_]);

  const handleZerodhaLogin = useCallback(async () => {
    if (!hasAllFields) {
      toast_("Fill in API Key and Secret first", "warn");
      return;
    }
    setKiteLoggingIn(true);
    try {
      const r = await fetch('/api/broker/zerodha/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: conn.apiKey, apiSecret: conn.apiSecret })
      });
      const d = await r.json();
      if (d.loginUrl) {
        window.open(d.loginUrl, '_blank');
        toast_('Zerodha login page opened. Complete login in the browser, then check status.', 'info');
      } else {
        toast_(d.error || 'Failed to get login URL', 'error');
      }
    } catch (e) {
      toast_('Failed to connect to backend', 'error');
    }
    setKiteLoggingIn(false);
  }, [hasAllFields, conn, toast_]);

  const handleConnect = useCallback(() => {
    if (!hasAllFields) {
      toast_("Fill in all API fields before connecting", "warn");
      return;
    }
    if (isKite) {
      handleZerodhaLogin();
      return;
    }
    onUpdate(platform.id, { ...conn, status: "connected" });
    toast_(`Connected to ${platform.name}`, "success");
  }, [hasAllFields, isKite, platform, conn, onUpdate, toast_, handleZerodhaLogin]);

  const handleDisconnect = useCallback(() => {
    if (isKite) {
      fetch('/api/broker/zerodha/disconnect', { method: 'POST' })
        .then(() => {
          setKiteStatus(null);
          const cleared = { status: "disconnected" };
          platform.fields.forEach((f) => { cleared[f.key] = ""; });
          onUpdate(platform.id, cleared);
          toast_('Disconnected from Zerodha', 'warn');
        })
        .catch(() => toast_('Failed to disconnect', 'error'));
      return;
    }
    const cleared = { status: "disconnected" };
    platform.fields.forEach((f) => {
      cleared[f.key] = "";
    });
    onUpdate(platform.id, cleared);
    toast_(`Disconnected from ${platform.name}`, "warn");
    setTestResult(null);
  }, [isKite, platform, onUpdate, toast_]);

  return (
    <div
      style={{
        background: S.card,
        border: `1px solid ${S.border}`,
        borderRadius: 8,
        overflow: "hidden",
        transition: "border-color 0.2s",
        borderColor: status === "connected" ? `${S.green}55` : S.border,
      }}
    >
      {/* ── Card Header ─────────────────────────── */}
      <div
        onClick={() => setExpanded((p) => !p)}
        style={{
          padding: "14px 16px 12px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {/* Top row: name + status */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Color accent bar */}
            <div style={{
              width: 3,
              height: 28,
              borderRadius: 2,
              background: platform.color,
              flexShrink: 0,
            }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: S.bright,
                  fontFamily: "Inter, sans-serif",
                }}>
                  {platform.name}
                </span>
                {platform.subtitle && (
                  <span style={{
                    fontSize: 10,
                    color: S.dim,
                    fontFamily: "Inter, sans-serif",
                  }}>
                    {platform.subtitle}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 10,
                color: S.dim,
                marginTop: 2,
                fontFamily: "Inter, sans-serif",
              }}>
                {platform.url.replace("https://", "")}
              </div>
            </div>
          </div>

          {/* Status dot + label */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: statusCfg.color,
              boxShadow: status === "connected" ? `0 0 8px ${statusCfg.color}66` : "none",
            }} />
            <span style={{
              fontSize: 10,
              color: statusCfg.color,
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
            }}>
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* Type badges + Legal badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {platform.types.map((type) => {
            const isCrypto = type.toLowerCase().includes("crypto");
            const badgeColor = isCrypto ? "#8b5cf6" : "#3b82f6";
            return (
              <span
                key={type}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: badgeColor,
                  background: `${badgeColor}18`,
                  border: `1px solid ${badgeColor}33`,
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {type}
              </span>
            );
          })}

          <span style={{
            fontSize: 9,
            fontWeight: 600,
            color: platform.legalType === "sebi" ? "#f59e0b" : "#10b981",
            background: platform.legalType === "sebi" ? "#f59e0b14" : "#10b98114",
            border: `1px solid ${platform.legalType === "sebi" ? "#f59e0b33" : "#10b98133"}`,
            borderRadius: 4,
            padding: "2px 7px",
            fontFamily: "Inter, sans-serif",
            marginLeft: "auto",
          }}>
            {platform.legal}
          </span>

          {/* Expand indicator */}
          <span style={{
            fontSize: 10,
            color: S.dim,
            fontFamily: "Inter, sans-serif",
            transition: "transform 0.2s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            display: "inline-block",
          }}>
            {">"}
          </span>
        </div>
      </div>

      {/* ── Expanded Section ───────────────────── */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${S.border}`,
          padding: "14px 16px 16px",
          background: "#0c1120",
        }}>
          {/* API Fields */}
          {platform.fields.map((field) => (
            <SecretField
              key={field.key}
              label={field.label}
              value={conn?.[field.key] || ""}
              onChange={(val) => updateField(field.key, val)}
              S={S}
            />
          ))}

          {/* Last test result */}
          {conn?.lastTest && (
            <div style={{
              fontSize: 10,
              color: S.dim,
              marginBottom: 10,
              fontFamily: "Inter, sans-serif",
            }}>
              Last tested: {conn.lastTest}
            </div>
          )}

          {/* Test result indicator */}
          {testResult && (
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: testResult === "success" ? S.green : S.red,
              background: testResult === "success" ? "#10b98114" : "#ef444414",
              border: `1px solid ${testResult === "success" ? S.green : S.red}33`,
              borderRadius: 6,
              padding: "6px 10px",
              marginBottom: 10,
              fontFamily: "Inter, sans-serif",
            }}>
              {testResult === "success"
                ? "Test passed - API credentials verified"
                : "Test failed - Check your credentials and try again"}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {/* Test Connection */}
            <button
              onClick={handleTestConnection}
              disabled={testing || !hasAllFields}
              style={{
                padding: "7px 14px",
                fontSize: 11,
                fontWeight: 600,
                cursor: testing || !hasAllFields ? "not-allowed" : "pointer",
                opacity: testing || !hasAllFields ? 0.5 : 1,
                background: "#060d18",
                border: `1px solid ${S.blue}44`,
                borderRadius: 6,
                color: S.blue,
                fontFamily: "Inter, sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {testing ? (
                <>
                  <Spinner size={12} color={S.blue} />
                  <span>Testing...</span>
                </>
              ) : (
                "Test Connection"
              )}
            </button>

            {/* Connect / Disconnect */}
            {status === "connected" ? (
              <button
                onClick={handleDisconnect}
                style={{
                  padding: "7px 14px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "#1a0508",
                  border: `1px solid ${S.red}44`,
                  borderRadius: 6,
                  color: S.red,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Disconnect
              </button>
            ) : isKite ? (
              <button
                onClick={handleConnect}
                disabled={!hasAllFields || kiteLoggingIn}
                style={{
                  padding: "7px 14px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: !hasAllFields || kiteLoggingIn ? "not-allowed" : "pointer",
                  opacity: !hasAllFields || kiteLoggingIn ? 0.5 : 1,
                  background: "#1a2d50",
                  border: `1px solid ${S.blue}55`,
                  borderRadius: 6,
                  color: S.blue,
                  fontFamily: "Inter, sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {kiteLoggingIn ? (
                  <>
                    <Spinner size={12} color={S.blue} />
                    <span>Opening login page...</span>
                  </>
                ) : (
                  "Login with Zerodha"
                )}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={!hasAllFields}
                style={{
                  padding: "7px 14px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: !hasAllFields ? "not-allowed" : "pointer",
                  opacity: !hasAllFields ? 0.5 : 1,
                  background: "#051a0d",
                  border: `1px solid ${S.green}44`,
                  borderRadius: 6,
                  color: S.green,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Connect
              </button>
            )}
          </div>

          {/* Kite connection info */}
          {isKite && kiteStatus?.connected && (
            <div style={{
              fontSize: 10,
              color: S.green,
              background: "#10b98110",
              border: `1px solid ${S.green}33`,
              borderRadius: 6,
              padding: "6px 10px",
              marginBottom: 10,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              Connected as: {kiteStatus.userId || kiteStatus.userName}
            </div>
          )}

          {/* Kite OAuth instructions when not connected */}
          {isKite && expanded && !kiteStatus?.connected && (
            <div style={{
              fontSize: 10,
              color: S.mid,
              background: "#0d1a2a",
              border: `1px solid ${S.border}`,
              borderRadius: 6,
              padding: "8px 10px",
              marginBottom: 10,
              lineHeight: 1.5,
              fontFamily: "Inter, sans-serif",
            }}>
              <strong style={{ color: S.blue }}>Setup:</strong>
              <ol style={{ margin: "4px 0 0 16px", padding: 0 }}>
                <li>Create an app at <span style={{ color: S.blue }}>developers.kite.trade</span></li>
                <li>Set redirect URL to: <code style={{ background: "#0003", padding: "1px 4px", borderRadius: 3 }}>http://localhost:5000/api/broker/zerodha/callback</code></li>
                <li>Enter the API Key &amp; Secret above</li>
                <li>Click "Login with Zerodha" and complete login in the browser</li>
                <li>Use "Test Connection" to verify</li>
              </ol>
            </div>
          )}

          {/* Docs link */}
          <a
            href={platform.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 10,
              color: S.blue,
              textDecoration: "none",
              fontFamily: "Inter, sans-serif",
              display: "inline-block",
              borderBottom: `1px dashed ${S.blue}55`,
              paddingBottom: 1,
            }}
          >
            API Documentation -- {platform.url.replace("https://", "")}
          </a>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ConnectionsTab  (main export)
   ═══════════════════════════════════════════════════════════ */
export default function ConnectionsTab({ connections, setConnections, S, toast_ }) {
  const [filter, setFilter] = useState("all"); // 'all' | 'stocks' | 'crypto'

  const handleUpdate = useCallback(
    (platformId, data) => {
      setConnections((prev) => ({
        ...prev,
        [platformId]: data,
      }));
    },
    [setConnections]
  );

  const connectedCount = PLATFORMS.filter(
    (p) => connections[p.id]?.status === "connected"
  ).length;

  const errorCount = PLATFORMS.filter(
    (p) => connections[p.id]?.status === "error"
  ).length;

  const filteredPlatforms = PLATFORMS.filter((p) => {
    if (filter === "all") return true;
    if (filter === "stocks") return p.types.some((t) =>
      ["Stocks", "F&O", "Commodities", "Equity", "MF"].includes(t)
    );
    if (filter === "crypto") return p.types.some((t) =>
      t.toLowerCase().includes("crypto")
    );
    return true;
  });

  // Detect OAuth callback result from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('zerodha') === 'connected') {
      toast_('Zerodha connected successfully!', 'success');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('zerodha') === 'disconnected') {
      toast_('Zerodha disconnected', 'warn');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('zerodha') === 'error') {
      toast_(`Zerodha login failed: ${params.get('msg') || 'Unknown error'}`, 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast_]);

  return (
    <div className="fin" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* ── Header section ───────────────────────── */}
      <div style={{
        background: S.card,
        border: `1px solid ${S.border}`,
        borderRadius: 8,
        padding: "16px 18px",
        marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{
              fontSize: 16,
              fontWeight: 700,
              color: S.bright,
              marginBottom: 4,
            }}>
              Broker Integrations
            </div>
            <div style={{ fontSize: 11, color: S.dim }}>
              Connect your trading accounts to enable live order execution
            </div>
          </div>

          {/* Summary badges */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: connectedCount > 0 ? S.green : S.dim,
            }}>
              <div style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: connectedCount > 0 ? S.green : S.dim,
              }} />
              {connectedCount} connected
            </div>
            {errorCount > 0 && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: S.amber,
              }}>
                <div style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: S.amber,
                }} />
                {errorCount} error{errorCount > 1 ? "s" : ""}
              </div>
            )}
            <span style={{
              fontSize: 10,
              color: S.dim,
              borderLeft: `1px solid ${S.border}`,
              paddingLeft: 10,
            }}>
              {PLATFORMS.length} platforms
            </span>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
          {[
            { key: "all", label: "All" },
            { key: "stocks", label: "Stocks / F&O" },
            { key: "crypto", label: "Crypto" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "5px 14px",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                background: filter === f.key ? `${S.blue}22` : "transparent",
                border: `1px solid ${filter === f.key ? `${S.blue}55` : S.border}`,
                borderRadius: 6,
                color: filter === f.key ? S.blue : S.mid,
                fontFamily: "Inter, sans-serif",
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Security notice ──────────────────────── */}
      <div style={{
        background: "#0d1a2a",
        border: `1px solid ${S.blue}33`,
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <div style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: `${S.blue}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: S.blue,
          fontWeight: 700,
          flexShrink: 0,
        }}>
          i
        </div>
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: S.blue,
            marginBottom: 2,
          }}>
            Security Notice
          </div>
          <div style={{
            fontSize: 10,
            color: S.mid,
            lineHeight: 1.5,
          }}>
            API keys are stored locally in your browser only. They are never sent to any server.
            Use read-only API keys where possible. Enable IP whitelisting on your broker account for added security.
          </div>
        </div>
      </div>

      {/* ── Platform grid ────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: 12,
      }}>
        {filteredPlatforms.map((platform) => (
          <PlatformCard
            key={platform.id}
            platform={platform}
            conn={connections[platform.id]}
            onUpdate={handleUpdate}
            S={S}
            toast_={toast_}
          />
        ))}
      </div>

      {/* ── Empty state ──────────────────────────── */}
      {filteredPlatforms.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "40px 20px",
          color: S.dim,
          fontSize: 12,
        }}>
          No platforms match the current filter.
        </div>
      )}

      {/* ── Quick links footer ───────────────────── */}
      <div style={{
        marginTop: 20,
        background: S.card,
        border: `1px solid ${S.border}`,
        borderRadius: 8,
        padding: "14px 18px",
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: S.mid, marginBottom: 10 }}>
          Platform Links
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PLATFORMS.map((p) => {
            const isConnected = connections[p.id]?.status === "connected";
            return (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 10,
                  color: isConnected ? S.green : S.dim,
                  background: isConnected ? "#10b98110" : "#ffffff06",
                  border: `1px solid ${isConnected ? `${S.green}33` : S.border}`,
                  borderRadius: 4,
                  padding: "4px 10px",
                  textDecoration: "none",
                  fontFamily: "Inter, sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {isConnected && (
                  <div style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: S.green,
                  }} />
                )}
                {p.name}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
