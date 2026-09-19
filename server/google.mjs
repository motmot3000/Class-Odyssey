/* Google OAuth 2.0 (Authorization Code + PKCE) without external dependencies.
 * The flow never exposes the session token in a URL: the callback hands the
 * browser a one-time code that the app exchanges for the real token.
 */

import crypto from "node:crypto";

export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const OAUTH_COOKIE = "classquest_oauth";
const OAUTH_COOKIE_TTL_SECONDS = 10 * 60;
const EXCHANGE_TTL_MS = 60 * 1000;
const AUTH_TIMEOUT_MS = 10_000;

export function decodeIdToken(idToken) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/* The ID token is received over TLS directly from Google's token endpoint, so
 * OpenID Connect allows validating the issuer, audience and expiry instead of
 * re-checking the signature. */
export function claimsProblem(claims, clientId, timeMs = Date.now()) {
  if (!claims || typeof claims !== "object") return "invalid";
  if (claims.iss !== "accounts.google.com" && claims.iss !== "https://accounts.google.com") return "issuer";
  if (claims.aud !== clientId) return "audience";
  if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= timeMs) return "expired";
  if (typeof claims.email !== "string" || !claims.email.trim()) return "email";
  if (claims.email_verified !== true) return "email";
  return null;
}

function parseCookies(header) {
  const jar = {};
  for (const part of String(header || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    if (!name || Object.hasOwn(jar, name)) continue;
    try {
      jar[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      jar[name] = part.slice(index + 1).trim();
    }
  }
  return jar;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

export function createGoogleAuth({
  clientId = "",
  clientSecret = "",
  redirectUri = "",
  trustProxy = false,
  fetchImpl = (...args) => fetch(...args),
  now = () => Date.now()
} = {}) {
  const enabled = Boolean(clientId && clientSecret);
  const pending = new Map();

  function origin(req) {
    const forwarded = trustProxy ? String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() : "";
    const proto = forwarded === "http" || forwarded === "https" ? forwarded : (req.socket.encrypted ? "https" : "http");
    const host = String(req.headers.host || "localhost");
    return `${proto}://${host}`;
  }

  const callbackUrl = (req) => redirectUri || `${origin(req)}/api/auth/google/callback`;

  function oauthCookie(req, value, maxAge) {
    const secure = origin(req).startsWith("https://") ? "; Secure" : "";
    return `${OAUTH_COOKIE}=${encodeURIComponent(value)}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
  }

  function redirect(res, location, extraHeaders = {}) {
    res.writeHead(302, {
      Location: location,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    });
    res.end();
  }

  function failure(req, res, reason) {
    redirect(res, `/?google_error=${encodeURIComponent(reason)}`, {
      "Set-Cookie": oauthCookie(req, "", 0)
    });
  }

  function start(req, res) {
    if (!enabled) return failure(req, res, "unavailable");
    const state = crypto.randomBytes(16).toString("base64url");
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const url = new URL(GOOGLE_AUTH_ENDPOINT);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", callbackUrl(req));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("prompt", "select_account");
    return redirect(res, url.toString(), { "Set-Cookie": oauthCookie(req, `${state}.${verifier}`, OAUTH_COOKIE_TTL_SECONDS) });
  }

  async function callback(req, res, onLogin) {
    if (!enabled) return failure(req, res, "unavailable");
    const params = new URL(req.url, "http://localhost").searchParams;
    if (params.get("error")) return failure(req, res, "denied");
    const code = params.get("code") || "";
    const state = params.get("state") || "";
    const saved = parseCookies(req.headers.cookie)[OAUTH_COOKIE] || "";
    const separator = saved.indexOf(".");
    if (!code || !state || separator < 1 || !safeEqual(state, saved.slice(0, separator))) {
      return failure(req, res, "state");
    }
    const verifier = saved.slice(separator + 1);
    let payload = null;
    try {
      const response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          code_verifier: verifier,
          grant_type: "authorization_code",
          redirect_uri: callbackUrl(req)
        }).toString(),
        signal: AbortSignal.timeout(AUTH_TIMEOUT_MS)
      });
      if (response.ok) payload = await response.json();
    } catch {
      payload = null;
    }
    const claims = decodeIdToken(payload?.id_token);
    const problem = claimsProblem(claims, clientId, now());
    if (problem) return failure(req, res, problem === "email" ? "email" : "failed");
    let login;
    try {
      login = await onLogin(claims);
    } catch {
      login = null;
    }
    if (!login?.token || !login?.account) return failure(req, res, "failed");
    const exchangeCode = crypto.randomBytes(32).toString("base64url");
    pending.set(exchangeCode, { ...login, expiresAt: now() + EXCHANGE_TTL_MS });
    if (pending.size > 100) {
      for (const [key, entry] of pending) if (entry.expiresAt <= now()) pending.delete(key);
    }
    return redirect(res, `/?google_code=${encodeURIComponent(exchangeCode)}`, {
      "Set-Cookie": oauthCookie(req, "", 0)
    });
  }

  function consumeExchangeCode(code) {
    const entry = pending.get(String(code || ""));
    if (!entry || entry.expiresAt <= now()) {
      if (entry) pending.delete(String(code || ""));
      return null;
    }
    pending.delete(String(code || ""));
    return { token: entry.token, account: entry.account };
  }

  return { enabled, start, callback, consumeExchangeCode };
}
