import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@saas/services", () => ({ getBusinessProfile: vi.fn() }));
vi.mock("@/lib/storage/r2", () => ({
  fetchImageBytesFromR2: vi.fn(),
  R2NotFoundError: class extends Error {
    constructor(k: string) {
      super(k);
      this.name = "R2NotFoundError";
    }
  },
}));

import { GET } from "../route";
import { requireAdmin } from "@/lib/auth";
import { getBusinessProfile } from "@saas/services";
import { fetchImageBytesFromR2, R2NotFoundError } from "@/lib/storage/r2";

const mockRequireAdmin = requireAdmin as ReturnType<typeof vi.fn>;
const mockGetBusinessProfile = getBusinessProfile as ReturnType<typeof vi.fn>;
const mockFetchImageBytesFromR2 = fetchImageBytesFromR2 as ReturnType<typeof vi.fn>;

describe("GET /api/admin/business-profile/logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  it("returns_200_with_image_buffer_and_content_type", async () => {
    mockGetBusinessProfile.mockResolvedValue({
      id: "bp-1",
      ownerId: "admin-1",
      logoKey: "business-profiles/admin-1/logo",
    });
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    mockFetchImageBytesFromR2.mockResolvedValue({
      buffer,
      contentType: "image/png",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns_404_when_profile_null", async () => {
    mockGetBusinessProfile.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("returns_404_when_logo_key_null", async () => {
    mockGetBusinessProfile.mockResolvedValue({
      id: "bp-1",
      ownerId: "admin-1",
      logoKey: null,
    });

    const response = await GET();

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("returns_404_on_r2_not_found_error", async () => {
    mockGetBusinessProfile.mockResolvedValue({
      id: "bp-1",
      ownerId: "admin-1",
      logoKey: "business-profiles/admin-1/logo",
    });
    mockFetchImageBytesFromR2.mockRejectedValue(
      new R2NotFoundError("business-profiles/admin-1/logo"),
    );

    const response = await GET();

    expect(response.status).toBe(404);
  });

  it("returns_500_and_logs_on_generic_r2_error", async () => {
    mockGetBusinessProfile.mockResolvedValue({
      id: "bp-1",
      ownerId: "admin-1",
      logoKey: "business-profiles/admin-1/logo",
    });
    const genericError = new Error("connection reset");
    mockFetchImageBytesFromR2.mockRejectedValue(genericError);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();

    expect(response.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[GET /api/admin/business-profile/logo] R2 fetch error",
      genericError,
    );
    consoleSpy.mockRestore();
  });

  it("propagates_next_redirect_when_not_admin", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;/login;307",
    });
    mockRequireAdmin.mockRejectedValue(redirectError);

    await expect(GET()).rejects.toThrow("NEXT_REDIRECT");
  });
});
