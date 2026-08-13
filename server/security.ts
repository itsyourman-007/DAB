import type { NextFunction, Request, Response } from "express";

type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitEntries = new Map<string, RateLimitEntry>();

function forwardedProtocol(req: Request) {
  const forwarded = req.header("x-forwarded-proto");
  return forwarded?.split(",")[0]?.trim().toLowerCase() || req.protocol;
}

function clientKey(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function isTrustedMutationOrigin(req: Request) {
  if (!/[Pp][Oo][Ss][Tt]|[Pp][Uu][Tt]|[Pp][Aa][Tt][Cc][Hh]|[Dd][Ee][Ll][Ee][Tt][Ee]/.test(req.method)) return true;
  const origin = req.header("origin");
  const host = req.header("host");
  if (!origin || !host) return false;
  return origin === `${forwardedProtocol(req)}://${host}`;
}

/** Blocks cross-site browser writes; APIs are intentionally same-origin only. */
export function requireTrustedMutationOrigin(req: Request, res: Response, next: NextFunction) {
  if (isTrustedMutationOrigin(req)) return next();
  return res.status(403).json({ error: "Cross-site requests are not allowed" });
}

/** Lightweight per-instance abuse control. Persistent account checks still happen in the protected procedures. */
export function rateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (rateLimitEntries.size > 2_000) {
      for (const key of Array.from(rateLimitEntries.keys())) {
        const value = rateLimitEntries.get(key);
        if (value && value.resetAt <= now) rateLimitEntries.delete(key);
      }
    }
    const key = `${options.name}:${clientKey(req)}`;
    const existing = rateLimitEntries.get(key);
    const entry = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : existing;
    entry.count += 1;
    rateLimitEntries.set(key, entry);
    res.setHeader("RateLimit-Limit", String(options.max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, options.max - entry.count)));
    if (entry.count > options.max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1_000))));
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    return next();
  };
}

export function applySecurityHeaders(_: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.setHeader("Content-Security-Policy", "base-uri 'self'; frame-ancestors 'self'; object-src 'none'");
  next();
}
