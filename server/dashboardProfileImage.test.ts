import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const uploadRoute = readFileSync(resolve(process.cwd(), "server/dashboardProfileImage.ts"), "utf8");
const indexSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
const schemaSource = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const dashboardHtml = readFileSync(resolve(process.cwd(), "client/src/embedded/dashboard.html"), "utf8");
const adminSource = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");

describe("protected dashboard profile images", () => {
  it("accepts only a small, valid image from an active administrator session and stores it through managed storage", () => {
    expect(uploadRoute).toContain("MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024");
    expect(uploadRoute).toContain('"image/png"');
    expect(uploadRoute).toContain('"image/jpeg"');
    expect(uploadRoute).toContain('"image/webp"');
    expect(uploadRoute).toContain("isExpectedImagePayload");
    expect(uploadRoute).toContain("isAdminSession(req.headers.cookie)");
    expect(uploadRoute).toContain("storagePut(`merchant-dashboard/profile/profile.${extension}`");
    expect(indexSource).toContain('app.use("/api/dashboard-profile-image", requireTrustedMutationOrigin)');
    expect(indexSource).toContain('registerDashboardProfileImageRoute(app)');
  });

	  it("persists only the managed image URL and renders the supplied console logo", () => {
    expect(schemaSource).toContain('profileImageUrl: varchar("profileImageUrl", { length: 1024 })');
    expect(dbSource).toContain("profileImageUrl?: string | null");
    expect(dashboardHtml).toContain('/manus-storage/91-danta-dashboard-logo_d2a87fee.png');
    expect(dashboardHtml).toContain('id="dashboardProfileAvatarImage"');
	    expect(dashboardHtml).toContain('id="dashboardProfilePhotoPreview"');
	    expect(adminSource).toContain("function isUploadableProfileImage(value: unknown)");
	    expect(adminSource).not.toContain("file instanceof File");
	    expect(adminSource).toContain('const dashboardLogoUrl = "/manus-storage/91-danta-dashboard-logo_d2a87fee.png"');
	    expect(adminSource).not.toContain("Private merchant console");
	    expect(dashboardHtml).toContain("const PROFILE_IMAGE_STORAGE_KEY='91dab_dashboard_profile_image'");
	    expect(dashboardHtml).toContain("function persistProfileImage(imageUrl)");
	    expect(dashboardHtml).toContain("reader.readAsDataURL(file)");
	    expect(dashboardHtml).toContain("Profile picture saved and shown.");
	    expect(dashboardHtml).toContain('.avatar{width:34px;height:34px;border-radius:50%;background:#fff;border:1px solid var(--border);');
	    expect(adminSource).toContain('src={dashboardLogoUrl} alt="91 DANTA" className="h-9 w-9');
	    expect(dashboardHtml).toContain('id="dashboardProfileAvatarFallback" src="/manus-storage/91-danta-dashboard-logo_d2a87fee.png"');
	    expect(dashboardHtml).toContain('id="dashboardProfilePhotoFallback" src="/manus-storage/91-danta-dashboard-logo_d2a87fee.png"');
	    expect(dashboardHtml).not.toContain('dashboardProfileAvatarInitials">91');
	  });
});
