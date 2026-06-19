import { describe, it, expect, vi, beforeEach } from "vitest";

const { FileTooLargeErrorMock } = vi.hoisted(() => {
  class FileTooLargeErrorMock extends Error {
    constructor(msg: string) { super(msg); this.name = "FileTooLargeError"; }
  }
  return { FileTooLargeErrorMock };
});

vi.mock("@saas/services", () => ({
  upsertBusinessProfile: vi.fn(),
  getBusinessProfile: vi.fn(),
  setBusinessProfileLogoKey: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/storage/r2", () => ({
  detectImageFormat: vi.fn(),
  imageContentType: vi.fn(),
  assertImageSize: vi.fn(),
  buildLogoKey: vi.fn(),
  uploadImageToR2: vi.fn(),
  deletePdfFromR2: vi.fn(),
  FileTooLargeError: FileTooLargeErrorMock,
}));

import { upsertBusinessProfileAction, uploadBusinessProfileLogoAction, removeBusinessProfileLogoAction } from "../business-profile";
import { upsertBusinessProfile, getBusinessProfile, setBusinessProfileLogoKey } from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { detectImageFormat, imageContentType, assertImageSize, buildLogoKey, uploadImageToR2, deletePdfFromR2 } from "@/lib/storage/r2";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedUpsertBusinessProfile = vi.mocked(upsertBusinessProfile);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedGetBusinessProfile = vi.mocked(getBusinessProfile);
const mockedSetBusinessProfileLogoKey = vi.mocked(setBusinessProfileLogoKey);
const mockedDetectImageFormat = vi.mocked(detectImageFormat);
const mockedImageContentType = vi.mocked(imageContentType);
const mockedAssertImageSize = vi.mocked(assertImageSize);
const mockedBuildLogoKey = vi.mocked(buildLogoKey);
const mockedUploadImageToR2 = vi.mocked(uploadImageToR2);
const mockedDeletePdfFromR2 = vi.mocked(deletePdfFromR2);

const fakeAdmin = {
  id: "admin-user-id",
  email: "admin@test.com",
  role: "admin",
  name: "Admin",
} as unknown as Awaited<ReturnType<typeof requireAdmin>>;

const mockProfile = {
  id: "profile-1",
  ownerId: "admin-user-id",
  name: "ACME Corp",
  legalForm: null,
  siret: null,
  tvaIntra: null,
  address: null,
  email: null,
  phone: null,
  iban: null,
  bic: null,
  logoKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const LOGO_KEY = "business-profiles/admin-user-id/logo";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF_MAGIC = Buffer.from([0x47, 0x49, 0x46, 0x38]);

function makeFormData(buf: Buffer, filename: string): FormData {
  const file = new File([new Uint8Array(buf)], filename, { type: "application/octet-stream" });
  const fd = new FormData();
  fd.append("logo", file);
  return fd;
}

const validInput = { name: "ACME Corp" };

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireAdmin.mockResolvedValue(fakeAdmin);
  mockedUpsertBusinessProfile.mockResolvedValue(mockProfile as never);
  mockedBuildLogoKey.mockReturnValue(LOGO_KEY);
  mockedUploadImageToR2.mockResolvedValue(undefined);
  mockedSetBusinessProfileLogoKey.mockResolvedValue(mockProfile as never);
  mockedGetBusinessProfile.mockResolvedValue(mockProfile as never);
  mockedDeletePdfFromR2.mockResolvedValue(undefined);
});

describe("upsertBusinessProfileAction", () => {
  it("calls_upsert_service_with_user_id", async () => {
    await upsertBusinessProfileAction(validInput);
    expect(mockedUpsertBusinessProfile.mock.calls[0][0]).toBe("admin-user-id");
  });

  it("returns_ok_on_valid_input", async () => {
    const result = await upsertBusinessProfileAction(validInput);
    expect(result).toEqual({ ok: true, data: mockProfile });
  });

  it("returns_validation_error_on_invalid_input", async () => {
    const result = await upsertBusinessProfileAction({});
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
    });
  });

  it("normalizes_empty_strings_to_undefined", async () => {
    await upsertBusinessProfileAction({
      name: "X",
      siret: "",
      email: "",
      iban: "",
      bic: "",
    });
    const mappedInput = mockedUpsertBusinessProfile.mock.calls[0][1];
    expect(mappedInput.siret).toBeUndefined();
    expect(mappedInput.email).toBeUndefined();
    expect(mappedInput.iban).toBeUndefined();
    expect(mappedInput.bic).toBeUndefined();
  });

  it("revalidates_business_profile_path", async () => {
    await upsertBusinessProfileAction(validInput);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/settings/business-profile");
  });
});

describe("uploadBusinessProfileLogoAction", () => {
  it("upload_png_calls_r2_and_sets_logo_key", async () => {
    mockedDetectImageFormat.mockReturnValueOnce("png");
    mockedImageContentType.mockReturnValueOnce("image/png");

    const result = await uploadBusinessProfileLogoAction(makeFormData(PNG_MAGIC, "logo.png"));

    expect(result).toEqual({ ok: true, data: mockProfile });
    expect(mockedUploadImageToR2).toHaveBeenCalledWith(LOGO_KEY, expect.any(Buffer), "image/png");
    expect(mockedSetBusinessProfileLogoKey).toHaveBeenCalledWith("admin-user-id", LOGO_KEY);
  });

  it("upload_jpeg_uses_correct_content_type", async () => {
    mockedDetectImageFormat.mockReturnValueOnce("jpeg");
    mockedImageContentType.mockReturnValueOnce("image/jpeg");
    mockedSetBusinessProfileLogoKey.mockResolvedValueOnce({ ...mockProfile, logoKey: LOGO_KEY } as never);

    const result = await uploadBusinessProfileLogoAction(makeFormData(JPEG_MAGIC, "logo.jpg"));

    expect(result).toEqual({ ok: true, data: expect.objectContaining({ logoKey: LOGO_KEY }) });
    expect(mockedUploadImageToR2).toHaveBeenCalledWith(LOGO_KEY, expect.any(Buffer), "image/jpeg");
  });

  it("upload_no_file_returns_file_required", async () => {
    const fd = new FormData();
    const result = await uploadBusinessProfileLogoAction(fd);

    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "FILE_REQUIRED" }) });
    expect(mockedUploadImageToR2).not.toHaveBeenCalled();
  });

  it("upload_invalid_format_returns_invalid_image", async () => {
    mockedDetectImageFormat.mockReturnValueOnce(null);

    const result = await uploadBusinessProfileLogoAction(makeFormData(GIF_MAGIC, "logo.gif"));

    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "INVALID_IMAGE" }) });
    expect(mockedUploadImageToR2).not.toHaveBeenCalled();
  });

  it("upload_too_large_returns_file_too_large", async () => {
    mockedDetectImageFormat.mockReturnValueOnce("png");
    mockedAssertImageSize.mockImplementationOnce(() => { throw new FileTooLargeErrorMock("Le fichier dépasse 2 MB"); });

    const result = await uploadBusinessProfileLogoAction(makeFormData(PNG_MAGIC, "logo.png"));

    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "FILE_TOO_LARGE" }) });
    expect(mockedUploadImageToR2).not.toHaveBeenCalled();
  });

  it("upload_no_profile_rollbacks_r2_and_fails", async () => {
    mockedDetectImageFormat.mockReturnValueOnce("png");
    mockedImageContentType.mockReturnValueOnce("image/png");
    mockedSetBusinessProfileLogoKey.mockResolvedValueOnce(null);

    const result = await uploadBusinessProfileLogoAction(makeFormData(PNG_MAGIC, "logo.png"));

    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "BUSINESS_PROFILE_REQUIRED" }) });
    expect(mockedDeletePdfFromR2).toHaveBeenCalledWith(LOGO_KEY);
  });
});

describe("removeBusinessProfileLogoAction", () => {
  it("remove_with_logo_deletes_r2_and_nullifies", async () => {
    const profileWithLogo = { ...mockProfile, logoKey: LOGO_KEY };
    mockedGetBusinessProfile.mockResolvedValueOnce(profileWithLogo as never);
    mockedSetBusinessProfileLogoKey.mockResolvedValueOnce({ ...mockProfile, logoKey: null } as never);

    const result = await removeBusinessProfileLogoAction();

    expect(result).toEqual({ ok: true, data: expect.objectContaining({ logoKey: null }) });
    expect(mockedDeletePdfFromR2).toHaveBeenCalledWith(LOGO_KEY);
    expect(mockedSetBusinessProfileLogoKey).toHaveBeenCalledWith("admin-user-id", null);
  });

  it("remove_without_logo_is_noop", async () => {
    mockedGetBusinessProfile.mockResolvedValueOnce(mockProfile as never);

    const result = await removeBusinessProfileLogoAction();

    expect(result).toEqual({ ok: true, data: mockProfile });
    expect(mockedDeletePdfFromR2).not.toHaveBeenCalled();
    expect(mockedSetBusinessProfileLogoKey).not.toHaveBeenCalled();
  });
});
