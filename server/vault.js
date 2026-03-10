// ============================================================
// Mx — Vault API Client
// Connects to JC Dashboard vault on Mac mini (CB Data API)
// Caches credentials in memory with TTL, falls back to env vars
// ============================================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let vaultUrl = null;
let vaultPin = null;
let vaultToken = "cb-local-2026";
let initialized = false;
let available = false;

// In-memory credential cache: name → { value, expires }
const cache = new Map();

/**
 * Initialize vault connection.
 * @param {string} url - Vault base URL (e.g., http://192.168.51.64:5160)
 * @param {string} pin - Vault PIN for credential reveals
 * @param {string} [token] - Bearer token (default: cb-local-2026)
 */
async function initVault(url, pin, token) {
  vaultUrl = url || process.env.VAULT_URL || null;
  vaultPin = pin || process.env.VAULT_PIN || null;
  if (token) vaultToken = token;

  if (!vaultUrl) {
    console.log("[vault] No VAULT_URL configured — using env var fallback");
    initialized = true;
    available = false;
    return;
  }

  try {
    const res = await fetch(`${vaultUrl}/vault/status`, {
      headers: { Authorization: `Bearer ${vaultToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      available = true;
      console.log(`[vault] Connected to vault at ${vaultUrl} — ${data.total_credentials || 0} credentials`);
    } else {
      available = false;
      console.warn(`[vault] Vault returned ${res.status} — falling back to env vars`);
    }
  } catch (err) {
    available = false;
    console.warn(`[vault] Cannot reach vault at ${vaultUrl}: ${err.message} — falling back to env vars`);
  }

  initialized = true;
}

/**
 * Retrieve a credential by name.
 * Checks cache first, then vault API, then process.env fallback.
 * @param {string} name - Credential name in vault (e.g., "mx-imap-host")
 * @param {string} [envFallback] - Environment variable name to fall back to
 * @returns {Promise<string|null>}
 */
async function cred(name, envFallback) {
  // Check cache first
  const cached = cache.get(name);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  // Try vault if available
  if (available && vaultUrl && vaultPin) {
    try {
      const res = await fetch(`${vaultUrl}/vault/credentials/${encodeURIComponent(name)}/reveal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vaultToken}`,
          "Content-Type": "application/json",
          "X-Vault-PIN": vaultPin,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();
        const value = data.value || data.credential?.value || null;
        if (value) {
          cache.set(name, { value, expires: Date.now() + CACHE_TTL_MS });
          return value;
        }
      }
    } catch (err) {
      console.warn(`[vault] Failed to reveal "${name}": ${err.message}`);
    }
  }

  // Fallback to env var
  if (envFallback && process.env[envFallback]) {
    return process.env[envFallback];
  }

  return null;
}

/**
 * List all credentials (names + metadata, not values).
 * @returns {Promise<Array>}
 */
async function listCredentials() {
  if (!available || !vaultUrl) return [];

  try {
    const res = await fetch(`${vaultUrl}/vault/credentials`, {
      headers: {
        Authorization: `Bearer ${vaultToken}`,
        "X-Vault-PIN": vaultPin || "",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      return data.credentials || data || [];
    }
  } catch (err) {
    console.warn(`[vault] Failed to list credentials: ${err.message}`);
  }

  return [];
}

/**
 * Check vault health.
 * @returns {Promise<object>}
 */
async function health() {
  if (!vaultUrl) {
    return { status: "not_configured", url: null };
  }

  try {
    const res = await fetch(`${vaultUrl}/vault/status`, {
      headers: { Authorization: `Bearer ${vaultToken}` },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      return { status: "connected", url: vaultUrl, ...data };
    }
    return { status: "error", url: vaultUrl, code: res.status };
  } catch (err) {
    return { status: "unreachable", url: vaultUrl, error: err.message };
  }
}

/**
 * Proxy a vault request (for frontend → server → vault).
 * @param {string} method - HTTP method
 * @param {string} path - Vault API path (e.g., /vault/credentials)
 * @param {object} [body] - Request body
 * @param {string} [pin] - Override PIN for this request
 * @returns {Promise<object>}
 */
async function proxyRequest(method, path, body, pin) {
  if (!vaultUrl) {
    throw new Error("Vault not configured");
  }

  const headers = {
    Authorization: `Bearer ${vaultToken}`,
    "Content-Type": "application/json",
  };

  if (pin || vaultPin) {
    headers["X-Vault-PIN"] = pin || vaultPin;
  }

  const res = await fetch(`${vaultUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(data.error || data.message || `Vault ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

/**
 * Clear the credential cache (e.g., after vault changes).
 */
function clearCache() {
  cache.clear();
}

/**
 * Check if vault is available.
 */
function isAvailable() {
  return available;
}

module.exports = {
  initVault,
  cred,
  listCredentials,
  health,
  proxyRequest,
  clearCache,
  isAvailable,
};
