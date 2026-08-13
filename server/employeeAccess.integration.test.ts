import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { merchantEmployeeAccounts } from "../drizzle/schema";
import { ADMIN_SESSION_COOKIE } from "./adminAuth";
import { hashPassword } from "./adminSecurity";
import { createMerchantEmployeeAccount, getDb, removeMerchantEmployeeAccount } from "./db";
import { appRouter } from "./routers";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

function createContext(cookieHeader?: string) {
  const cookies: Array<{ name: string; value: string }> = [];
  return {
    ctx: {
      user: null,
      req: { protocol: "https", headers: cookieHeader ? { cookie: cookieHeader } : {} },
      res: { cookie: (name: string, value: string) => cookies.push({ name, value }), clearCookie: () => undefined },
    } as any,
    cookies,
  };
}

describeWithDatabase("restricted employee dashboard access", () => {
  const email = `employee-access-${Date.now()}@91dab.test`;
  const password = "Employee-Test-Password-123";
  let employeeId: number | undefined;

  beforeAll(async () => {
    const created = await createMerchantEmployeeAccount({ name: "Access Test Employee", email, passwordHash: hashPassword(password) });
    employeeId = created?.id;
  });

  afterAll(async () => {
    if (employeeId) await removeMerchantEmployeeAccount(employeeId);
    const database = await getDb();
    if (database) await database.delete(merchantEmployeeAccounts).where(eq(merchantEmployeeAccounts.email, email));
  });

  it("accepts only the authorized email and password, then revokes the session when the account is removed", async () => {
    const login = createContext();
    await expect(appRouter.createCaller(login.ctx).admin.login({ username: email, password })).resolves.toEqual({ authenticated: true, role: "employee", email });
    const token = login.cookies.find((cookie) => cookie.name === ADMIN_SESSION_COOKIE)?.value;
    expect(token).toBeTruthy();

    const status = createContext(`${ADMIN_SESSION_COOKIE}=${token}`);
    await expect(appRouter.createCaller(status.ctx).admin.status()).resolves.toEqual({ authenticated: true, role: "employee", email });

    if (!employeeId) throw new Error("Employee account was not created");
    await removeMerchantEmployeeAccount(employeeId);
    await expect(appRouter.createCaller(status.ctx).admin.status()).resolves.toEqual({ authenticated: false, role: null, email: null });
  });
});
