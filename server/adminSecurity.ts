import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

function equalBuffers(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function passwordHashMatches(password: string, storedHash: string) {
  const [algorithm, salt, expected] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const derived = scryptSync(password, salt, 64).toString("hex");
  return equalBuffers(Buffer.from(derived, "hex"), Buffer.from(expected, "hex"));
}

export function createOtp() {
  const code = randomInt(100000, 1_000_000).toString();
  return { code, hash: hashOtp(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) };
}

export function hashOtp(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function otpMatches(code: string, storedHash: string) {
  return equalBuffers(Buffer.from(hashOtp(code), "hex"), Buffer.from(storedHash, "hex"));
}
