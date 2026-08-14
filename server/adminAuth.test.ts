import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { ADMIN_SESSION_COOKIE } from "./adminAuth";
import type { TrpcContext } from "./_core/context";

type SetCookie = { name: string; value: string; options: Record<string, unknown> };
type ClearedCookie = { name: string; options: Record<string, unknown> };

function createContext(cookieHeader?: string) {
  const setCookies: SetCookie[] = [];
  const clearedCookies: ClearedCookie[] = [];
  const ctx = {
    user: null,
    req: { protocol: "https", headers: cookieHeader ? { cookie: cookieHeader } : {} },
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => setCookies.push({ name, value, options }),
      clearCookie: (name: string, options: Record<string, unknown>) => clearedCookies.push({ name, options }),
    },
  } as unknown as TrpcContext;
  return { ctx, setCookies, clearedCookies };
}

describe("admin password endpoint", () => {
  it("accepts the configured administrator secret and creates a verifiable admin session", async () => {
    const password = process.env.ADMIN_DASHBOARD_PASSWORD;
    expect(password).toBeTruthy();
    const login = createContext();
    const loginResult = await appRouter.createCaller(login.ctx).admin.login({ username: "dantaresearch@gmail.com", password: password! });

    expect(loginResult).toEqual({ authenticated: true, role: "admin", email: "dantaresearch@gmail.com" });
    const session = login.setCookies.find((cookie) => cookie.name === ADMIN_SESSION_COOKIE);
    expect(session?.value).toBeTruthy();
    expect(session?.options).toMatchObject({ httpOnly: true, secure: true, maxAge: expect.any(Number) });

    const status = createContext(`${ADMIN_SESSION_COOKIE}=${session?.value}`);
    await expect(appRouter.createCaller(status.ctx).admin.status()).resolves.toEqual({ authenticated: true, role: "admin", email: null });
  });

  it("rejects an invalid administrator password", async () => {
    const attempt = createContext();
    await expect(appRouter.createCaller(attempt.ctx).admin.login({ username: "dantaresearch@gmail.com", password: "incorrect-password" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("requires the current administrator password again before Security Settings can open", async () => {
    const password = process.env.ADMIN_DASHBOARD_PASSWORD;
    expect(password).toBeTruthy();
    const login = createContext();
    await appRouter.createCaller(login.ctx).admin.login({ username: "dantaresearch@gmail.com", password: password! });
    const session = login.setCookies.find((cookie) => cookie.name === ADMIN_SESSION_COOKIE);
    const gate = createContext(`${ADMIN_SESSION_COOKIE}=${session?.value}`);

    await expect(appRouter.createCaller(gate.ctx).admin.verifySecuritySettingsPassword({ password: "incorrect-password" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(appRouter.createCaller(gate.ctx).admin.verifySecuritySettingsPassword({ password: password! })).resolves.toEqual({ verified: true });
  });

  it("clears the protected administrator session on logout", async () => {
    const session = createContext();
    await expect(appRouter.createCaller(session.ctx).admin.logout()).resolves.toEqual({ success: true });
    expect(session.clearedCookies).toHaveLength(1);
    expect(session.clearedCookies[0]).toMatchObject({
      name: ADMIN_SESSION_COOKIE,
      options: { httpOnly: true, secure: true, maxAge: -1 },
    });
  });
});
