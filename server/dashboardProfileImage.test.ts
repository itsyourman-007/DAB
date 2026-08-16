import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const dashboardHtml = readFileSync(resolve(process.cwd(), "client/src/embedded/dashboard.html"), "utf8");
const adminSource = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");

describe("simplified dashboard profile", () => {
	  it("keeps editable account details but removes profile-picture controls and duplicate profile imagery", () => {
	    expect(schemaSource).toContain('profileImageUrl: varchar("profileImageUrl", { length: 1024 })');
	    expect(dbSource).toContain("profileImageUrl?: string | null");
	    expect(dashboardHtml).not.toContain("uploadDashboardProfileImage");
	    expect(dashboardHtml).not.toContain("dashboardProfileAvatarImage");
	    expect(dashboardHtml).not.toContain("dashboardProfilePhotoPreview");
	    expect(dashboardHtml).not.toContain("PROFILE_IMAGE_STORAGE_KEY");
	    expect(adminSource).not.toContain("91dab-dashboard-profile-image-upload");
	    expect(adminSource).not.toContain("/api/dashboard-profile-image");
	    expect(adminSource).toContain('const dashboardLogoUrl = "/manus-storage/91-danta-dashboard-logo_d2a87fee.png"');
	  });
});
