import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { applySecurityHeaders, isTrustedMutationOrigin, rateLimit } from "./security";

function request(input: { method?: string; origin?: string; host?: string; protocol?: string; ip?: string } = {}) {
  const headers: Record<string, string | undefined> = {
    origin: input.origin,
    host: input.host,
  };
  return {
    method: input.method ?? "POST",
    protocol: input.protocol ?? "https",
    ip: input.ip ?? "203.0.113.10",
    socket: { remoteAddress: input.ip ?? "203.0.113.10" },
    header: (name: string) => headers[name.toLowerCase()],
    headers,
  } as unknown as Request;
}

function response() {
  const headers = new Map<string, string>();
  let statusCode = 200;
  return {
    headers,
    get statusCode() { return statusCode; },
    setHeader: (name: string, value: string) => headers.set(name, value),
    status: (code: number) => {
      statusCode = code;
      return { json: (body: unknown) => body };
    },
  } as unknown as Response & { headers: Map<string, string>; statusCode: number };
}

describe("merchant security middleware", () => {
  it("allows only same-origin browser mutations while keeping reads unaffected", () => {
    expect(isTrustedMutationOrigin(request({ origin: "https://shop.example", host: "shop.example" }))).toBe(true);
    expect(isTrustedMutationOrigin(request({ origin: "https://attacker.example", host: "shop.example" }))).toBe(false);
    expect(isTrustedMutationOrigin(request({ method: "GET" }))).toBe(true);
  });

  it("throttles repeated sensitive requests from the same client", () => {
    const middleware = rateLimit({ name: "test-login", windowMs: 60_000, max: 2 });
    const req = request({ ip: "198.51.100.5" });
    const next = () => undefined;
    const first = response();
    const second = response();
    const blocked = response();
    middleware(req, first, next);
    middleware(req, second, next);
    middleware(req, blocked, next);
    expect(first.headers.get("RateLimit-Remaining")).toBe("1");
    expect(second.headers.get("RateLimit-Remaining")).toBe("0");
    expect(blocked.statusCode).toBe(429);
  });

  it("sets browser security headers on every response", () => {
    const res = response();
    let continued = false;
    applySecurityHeaders(request({ method: "GET" }), res, () => { continued = true; });
    expect(continued).toBe(true);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'self'");
  });
});
