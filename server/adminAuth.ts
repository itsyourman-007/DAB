import { createHash, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import * as db from "./db";
import { passwordHashMatches } from "./adminSecurity";

export const ADMIN_SESSION_COOKIE = "91dab_admin_session";
export const ADMIN_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
export type DashboardRole = "admin" | "employee";
export type DashboardSession = { role: DashboardRole; employeeId?: number; email?: string };

function signingKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required for administrator sessions");
  return new TextEncoder().encode(secret);
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export async function passwordMatchesAdminPassword(candidate: string) {
  const security = await db.getAdminSecurity();
  if (security?.passwordHash) return passwordHashMatches(candidate, security.passwordHash);
  const configuredPassword = process.env.ADMIN_DASHBOARD_PASSWORD;
  if (!configuredPassword) return false;
  return timingSafeEqual(digest(candidate), digest(configuredPassword));
}

export async function createAdminSession() {
  return new SignJWT({ scope: "91dab-dashboard", role: "admin" satisfies DashboardRole })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(signingKey());
}

export async function createEmployeeSession(input: { employeeId: number; email: string }) {
  return new SignJWT({ scope: "91dab-dashboard", role: "employee" satisfies DashboardRole, employeeId: input.employeeId, email: input.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(signingKey());
}

export function cookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function getDashboardSession(cookieHeader: string | undefined): Promise<DashboardSession | null> {
  const token = cookieValue(cookieHeader, ADMIN_SESSION_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey());
    if (payload.scope !== "91dab-dashboard" || (payload.role !== "admin" && payload.role !== "employee")) return null;
    const session: DashboardSession = {
      role: payload.role as DashboardRole,
      employeeId: typeof payload.employeeId === "number" ? payload.employeeId : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
    if (session.role === "employee") {
      if (!session.employeeId) return null;
      const employee = await db.getActiveMerchantEmployeeAccountById(session.employeeId);
      if (!employee || employee.email !== session.email) return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function isDashboardSession(cookieHeader: string | undefined) {
  return Boolean(await getDashboardSession(cookieHeader));
}

export async function isAdminSession(cookieHeader: string | undefined) {
  return (await getDashboardSession(cookieHeader))?.role === "admin";
}
