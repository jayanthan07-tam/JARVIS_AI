import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "jarvis_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const MAX_GLOBAL_BODY_BYTES = 256 * 1024;

type RatePolicy = { limit: number; windowMs: number };
type RateWindow = { count: number; resetAt: number };

const RATE_POLICIES: Record<string, RatePolicy> = {
  default: { limit: 120, windowMs: 60_000 },
  write: { limit: 60, windowMs: 60_000 },
  chat: { limit: 24, windowMs: 60_000 },
  search: { limit: 20, windowMs: 60_000 },
  status: { limit: 30, windowMs: 60_000 },
  login: { limit: 5, windowMs: 15 * 60_000 },
};

const rateWindows = new Map<string, RateWindow>();

export class ApiInputError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 413 | 415 = 400
  ) {
    super(message);
    this.name = "ApiInputError";
  }
}

export function getAuthConfiguration() {
  const password = process.env.JARVIS_ACCESS_PASSWORD ?? "";
  const secret = process.env.JARVIS_AUTH_SECRET ?? "";
  const configured = password.trim().length >= 16 && secret.length >= 32;
  const hasPartialConfiguration = Boolean(password || secret);
  return { password, secret, configured, hasPartialConfiguration };
}

function sessionSignature(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(encodedPayload).digest();
}

export function isAuthenticated(request: NextRequest): boolean {
  const { secret, configured } = getAuthConfiguration();
  if (!configured) return process.env.NODE_ENV !== "production";

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return false;

  try {
    const expected = sessionSignature(encodedPayload, secret);
    const received = Buffer.from(encodedSignature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      return false;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as { version?: number; issuedAt?: number; expiresAt?: number; nonce?: string };
    const now = Math.floor(Date.now() / 1000);
    return (
      payload.version === 1 &&
      typeof payload.issuedAt === "number" &&
      payload.issuedAt <= now + 60 &&
      typeof payload.expiresAt === "number" &&
      payload.expiresAt > now &&
      payload.expiresAt - payload.issuedAt <= SESSION_SECONDS &&
      typeof payload.nonce === "string"
    );
  } catch {
    return false;
  }
}

export function verifyAccessPassword(candidate: unknown): boolean {
  const { password, configured } = getAuthConfiguration();
  if (!configured || typeof candidate !== "string") return false;
  const expected = createHash("sha256").update(password).digest();
  const received = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(expected, received);
}

export function setSessionCookie(response: NextResponse): void {
  const { secret, configured } = getAuthConfiguration();
  if (!configured) return;

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      version: 1,
      issuedAt,
      expiresAt: issuedAt + SESSION_SECONDS,
      nonce: randomBytes(18).toString("base64url"),
    })
  ).toString("base64url");
  const signature = sessionSignature(payload, secret).toString("base64url");

  response.cookies.set(SESSION_COOKIE, `${payload}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

function getExpectedOrigin(request: NextRequest): string | null {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const requestProto = new URL(request.url).protocol.replace(":", "");
  const proto = forwardedProto || requestProto;
  if (!host || (proto !== "https" && proto !== "http")) return null;

  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
}

export function validateRequestOrigin(request: NextRequest): NextResponse | null {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return null;
  const origin = request.headers.get("origin");
  if (!origin) return null;

  try {
    const suppliedOrigin = new URL(origin).origin;
    const expectedOrigin = getExpectedOrigin(request);
    if (expectedOrigin && suppliedOrigin === expectedOrigin) return null;
  } catch {
    // Reject malformed browser Origin headers below.
  }

  return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
}

function clientAddress(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const addresses = forwarded.split(",").map((value) => value.trim()).filter(Boolean);
    const last = addresses.at(-1);
    if (last) return last.slice(0, 128);
  }
  return "unknown";
}

export function rateLimitRequest(
  request: NextRequest,
  scope: keyof typeof RATE_POLICIES
): NextResponse | null {
  const policy = RATE_POLICIES[scope];
  const now = Date.now();
  const key = `${scope}:${clientAddress(request)}`;
  let window = rateWindows.get(key);

  if (!window || window.resetAt <= now) {
    if (!window && rateWindows.size >= 5_000) {
      for (const [existingKey, existingWindow] of rateWindows) {
        if (existingWindow.resetAt <= now) rateWindows.delete(existingKey);
      }
      if (rateWindows.size >= 5_000) {
        const response = NextResponse.json(
          { error: "Too many requests. Please wait and try again." },
          { status: 429 }
        );
        response.headers.set("Retry-After", "60");
        response.headers.set("Cache-Control", "no-store");
        return response;
      }
    }
    window = { count: 0, resetAt: now + policy.windowMs };
    rateWindows.set(key, window);
  }

  window.count += 1;
  if (window.count <= policy.limit) return null;

  const retryAfter = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
  const response = NextResponse.json(
    { error: "Too many requests. Please wait and try again." },
    { status: 429 }
  );
  response.headers.set("Retry-After", String(retryAfter));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function authUnavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: "Server authentication is not configured." },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}

export async function authorizeApiRequest(
  request: NextRequest,
  policy: "default" | "write" | "chat" | "search" | "status" = "default"
): Promise<NextResponse | null> {
  const originFailure = validateRequestOrigin(request);
  if (originFailure) return originFailure;

  const rateFailure = rateLimitRequest(request, policy);
  if (rateFailure) return rateFailure;

  const config = getAuthConfiguration();
  if (!config.configured) {
    if (process.env.NODE_ENV === "production" || config.hasPartialConfiguration) {
      return authUnavailableResponse();
    }
    return null;
  }

  if (!isAuthenticated(request)) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  return null;
}

export async function readJsonRequest(
  request: NextRequest,
  maxBytes = 32 * 1024
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json" && !contentType?.endsWith("+json")) {
    throw new ApiInputError("A JSON request body is required.", 415);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > Math.min(maxBytes, MAX_GLOBAL_BODY_BYTES)) {
    throw new ApiInputError("Request body is too large.", 413);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new ApiInputError("A JSON request body is required.");

  const limit = Math.min(maxBytes, MAX_GLOBAL_BODY_BYTES);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => {});
        throw new ApiInputError("Request body is too large.", 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ApiInputError) throw error;
    throw new ApiInputError("Request body could not be read.");
  }

  if (size === 0) throw new ApiInputError("A JSON request body is required.");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new ApiInputError("A JSON object is required.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiInputError) throw error;
    throw new ApiInputError("Request body must contain valid JSON.");
  }
}

export function handleApiError(scope: string, error: unknown): NextResponse {
  if (error instanceof ApiInputError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const errorName = error instanceof Error ? error.name : "UnknownError";
  process.stderr.write(`[JARVIS-API] ${scope} failed (${errorName})\n`);
  return NextResponse.json({ error: "The request could not be completed." }, { status: 500 });
}
