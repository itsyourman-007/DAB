import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { adminSecurity } from "../drizzle/schema";
import { createAdminSession, passwordMatchesAdminPassword } from "./adminAuth";
import { hashOtp, hashPassword } from "./adminSecurity";
import { getAdminSecurity, getDb, storeAdminOtp, storeAdminPasswordHash } from "./db";
import { appRouter } from "./routers";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("administrator password change integration", () => {
  let database: Awaited<ReturnType<typeof getDb>>;
  const initialPassword = "Initial-Test-Password-123";
  const changedPassword = "Changed-Test-Password-456";

  beforeAll(async () => {
    database = await getDb();
    if (!database) throw new Error("Database is required for the OTP integration test");
    const existing = await database.select().from(adminSecurity).where(eq(adminSecurity.id, 1)).limit(1);
    if (existing.length) throw new Error("Refusing to overwrite existing administrator security data during the integration test");
  });

  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    await database?.delete(adminSecurity).where(eq(adminSecurity.id, 1));
  });

  it("requires the trusted email OTP before replacing the active administrator password", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-test" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await storeAdminPasswordHash(hashPassword(initialPassword));

    const token = await createAdminSession();
    const ctx = {
      user: null,
      req: { protocol: "https", headers: { cookie: `91dab_admin_session=${token}` } },
      res: { cookie: () => undefined, clearCookie: () => undefined },
    } as any;
    const caller = appRouter.createCaller(ctx);

    const requested = await caller.admin.requestPasswordChange();
    expect(requested.expiresInMinutes).toBe(10);
    expect(fetchMock).toHaveBeenCalledOnce();
    const sentPayload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sentPayload.to).toEqual([process.env.ADMIN_OTP_RECIPIENT_EMAIL?.trim().toLowerCase()]);
    expect((await getAdminSecurity())?.otpHash).toBeTruthy();

    await storeAdminOtp({
      otpHash: hashOtp("654321"),
      recipient: process.env.ADMIN_OTP_RECIPIENT_EMAIL!.trim().toLowerCase(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(caller.admin.confirmPasswordChange({
      currentPassword: initialPassword,
      newPassword: changedPassword,
      otp: "654321",
    })).resolves.toEqual({ changed: true });

    await expect(passwordMatchesAdminPassword(changedPassword)).resolves.toBe(true);
    await expect(passwordMatchesAdminPassword(initialPassword)).resolves.toBe(false);
    await expect(caller.admin.login({ username: "dantaresearch@gmail.com", password: initialPassword })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.admin.login({ username: "dantaresearch@gmail.com", password: changedPassword })).resolves.toEqual({ authenticated: true, role: "admin", email: "dantaresearch@gmail.com" });
  });
});
