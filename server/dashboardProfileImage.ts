import express, { type Express, type Request, type Response } from "express";
import { adminOtpRecipient } from "./adminOtpMail";
import { isAdminSession } from "./adminAuth";
import * as db from "./db";
import { storagePut } from "./storage";

const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

function isExpectedImagePayload(contentType: string, bytes: Buffer) {
  if (contentType === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/webp") return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export function registerDashboardProfileImageRoute(app: Express) {
  app.post("/api/dashboard-profile-image", express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: MAX_PROFILE_IMAGE_BYTES }), async (req: Request, res: Response) => {
    try {
      if (!(await isAdminSession(req.headers.cookie))) return res.status(403).json({ error: "Administrator access is required" });
      const contentType = String(req.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
      const extension = IMAGE_TYPES.get(contentType);
      if (!extension) return res.status(415).json({ error: "Use a PNG, JPEG, or WebP image" });
      if (!Buffer.isBuffer(req.body) || req.body.length === 0 || req.body.length > MAX_PROFILE_IMAGE_BYTES) return res.status(400).json({ error: "Choose an image smaller than 2 MB" });
      if (!isExpectedImagePayload(contentType, req.body)) return res.status(400).json({ error: "The uploaded file does not match its image type" });
      const stored = await storagePut(`merchant-dashboard/profile/profile.${extension}`, req.body, contentType);
      const current = await db.getMerchantDashboardProfile();
      const profile = await db.saveMerchantDashboardProfile({
        displayName: current?.displayName ?? "91DAB Administrator",
        email: current?.email ?? adminOtpRecipient(),
        profileImageUrl: stored.url,
      });
      return res.json({ profile });
    } catch (error) {
      console.error("[Dashboard profile image] Upload failed", error);
      return res.status(500).json({ error: "Profile picture could not be saved" });
    }
  });
}
