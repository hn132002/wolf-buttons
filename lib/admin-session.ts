import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "wolfButtonsAdmin";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const SESSION_VERSION = "v1";

type AdminAuthResult = { ok: true } | { ok: false; status: number };

const hasAdminAccess = (secret: string | undefined, given: string | null) =>
  Boolean(secret && given === secret);

const getAdminFailureStatus = (given: string | null) => (given ? 403 : 401);

const signSession = (secret: string, issuedAt: number) =>
  createHmac("sha256", secret)
    .update(`${SESSION_VERSION}.${issuedAt}`)
    .digest("hex");

const getCookieValue = (cookieHeader: string | null, name: string) => {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");

    if (key === name) return valueParts.join("=") || null;
  }

  return null;
};

const hasCookie = (cookieHeader: string | null, name: string) =>
  getCookieValue(cookieHeader, name) !== null;

export const createAdminSessionValue = (
  secret: string | undefined,
  issuedAt = Date.now()
) => {
  if (!secret) return null;

  return `${SESSION_VERSION}.${issuedAt}.${signSession(secret, issuedAt)}`;
};

export const hasAdminSession = (
  secret: string | undefined,
  cookieHeader: string | null,
  now = Date.now()
) => {
  if (!secret) return false;

  const value = getCookieValue(cookieHeader, ADMIN_SESSION_COOKIE);
  if (!value) return false;

  const [version, issuedAtText, signature] = value.split(".");
  const issuedAt = Number(issuedAtText);

  if (
    version !== SESSION_VERSION ||
    !Number.isInteger(issuedAt) ||
    issuedAt > now + 60_000 ||
    now - issuedAt > SESSION_MAX_AGE_SECONDS * 1000
  ) {
    return false;
  }

  const expected = signSession(secret, issuedAt);
  const given = Buffer.from(signature || "", "hex");
  const wanted = Buffer.from(expected, "hex");

  return given.length === wanted.length && timingSafeEqual(given, wanted);
};

export const createAdminSessionCookie = (secret: string | undefined) => {
  const value = createAdminSessionValue(secret);

  if (!value) return null;

  return [
    `${ADMIN_SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
};

export const clearAdminSessionCookie = () =>
  [
    `${ADMIN_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

export const getAdminAuthResult = (
  secret: string | undefined,
  request: Request
): AdminAuthResult => {
  const cookie = request.headers.get("cookie");

  if (hasAdminSession(secret, cookie)) return { ok: true };

  const given = request.headers.get("x-admin-secret");

  if (hasAdminAccess(secret, given)) return { ok: true };
  if (hasCookie(cookie, ADMIN_SESSION_COOKIE)) return { ok: false, status: 403 };

  return { ok: false, status: getAdminFailureStatus(given) };
};
