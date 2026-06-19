import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn();
  const MockS3Client = vi.fn(() => ({ send: mockSend }));
  return {
    S3Client: MockS3Client,
    PutObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
    __mockSend: mockSend,
    __MockS3Client: MockS3Client,
  };
});

import {
  getR2Client,
  __resetR2ClientForTests,
  buildReportKey,
  buildInvoiceKey,
  buildQuoteKey,
  isPdfMagicBytes,
  assertPdfSize,
  uploadPdfToR2,
  deletePdfFromR2,
  FileTooLargeError,
  R2UploadError,
  R2DeleteError,
  detectImageFormat,
  imageContentType,
  assertImageSize,
  buildLogoKey,
  uploadImageToR2,
  fetchImageBytesFromR2,
  R2NotFoundError,
} from "../r2";

const { S3Client: MockS3Client, __mockSend } = (await import(
  "@aws-sdk/client-s3"
)) as Record<string, unknown> as { S3Client: unknown; __mockSend: ReturnType<typeof vi.fn> };

const R2_ENV = {
  R2_ENDPOINT: "https://test.r2.cloudflarestorage.com",
  R2_ACCESS_KEY_ID: "test-key",
  R2_SECRET_ACCESS_KEY: "test-secret",
  R2_BUCKET: "test-bucket",
};

describe("r2 storage helper", () => {
  beforeEach(() => {
    __resetR2ClientForTests();
    vi.stubEnv("R2_ENDPOINT", R2_ENV.R2_ENDPOINT);
    vi.stubEnv("R2_ACCESS_KEY_ID", R2_ENV.R2_ACCESS_KEY_ID);
    vi.stubEnv("R2_SECRET_ACCESS_KEY", R2_ENV.R2_SECRET_ACCESS_KEY);
    vi.stubEnv("R2_BUCKET", R2_ENV.R2_BUCKET);
    vi.clearAllMocks();
  });

  it("getR2Client returns lazy singleton", () => {
    const a = getR2Client();
    const b = getR2Client();
    expect(a).toBe(b);
    expect(MockS3Client).toHaveBeenCalledTimes(1);
  });

  it("__resetR2ClientForTests resets singleton", () => {
    const a = getR2Client();
    __resetR2ClientForTests();
    const b = getR2Client();
    expect(a).not.toBe(b);
    expect(MockS3Client).toHaveBeenCalledTimes(2);
  });

  it("buildReportKey matches expected format", () => {
    const key = buildReportKey();
    expect(key).toMatch(/^reports\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
  });

  it("buildInvoiceKey matches expected format", () => {
    const key = buildInvoiceKey();
    expect(key).toMatch(/^invoices\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
  });

  it("buildQuoteKey matches expected format", () => {
    const key = buildQuoteKey();
    expect(key).toMatch(/^quotes\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
  });

  it("isPdfMagicBytes returns true for PDF", () => {
    expect(isPdfMagicBytes(Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(
      true,
    );
  });

  it("isPdfMagicBytes returns false for JPEG", () => {
    expect(isPdfMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
  });

  it("isPdfMagicBytes returns false for buffer < 4 bytes", () => {
    expect(isPdfMagicBytes(Buffer.from([0x25, 0x50]))).toBe(false);
  });

  it("assertPdfSize throws FileTooLargeError for > 10 MB", () => {
    const buf = Buffer.alloc(10 * 1024 * 1024 + 1);
    expect(() => assertPdfSize(buf)).toThrow(FileTooLargeError);
  });

  it("assertPdfSize passes for exactly 10 MB", () => {
    const buf = Buffer.alloc(10 * 1024 * 1024);
    expect(() => assertPdfSize(buf)).not.toThrow();
  });

  it("uploadPdfToR2 wraps SDK error in R2UploadError", async () => {
    const sdkErr = new Error("network fail");
    __mockSend.mockRejectedValueOnce(sdkErr);
    const err = await uploadPdfToR2("reports/2026/05/abc.pdf", Buffer.from("pdf")).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(R2UploadError);
    expect((err as R2UploadError).cause).toBe(sdkErr);
  });

  it("deletePdfFromR2 wraps SDK error in R2DeleteError", async () => {
    const sdkErr = new Error("network fail");
    __mockSend.mockRejectedValueOnce(sdkErr);
    const err = await deletePdfFromR2("reports/2026/05/abc.pdf").catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(R2DeleteError);
    expect((err as R2DeleteError).cause).toBe(sdkErr);
  });

  it("detect_image_format_returns_png_for_png_magic_bytes", () => {
    expect(detectImageFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe("png");
  });

  it("detect_image_format_returns_jpeg_for_jpeg_magic_bytes", () => {
    expect(detectImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
  });

  it("detect_image_format_returns_null_for_pdf_and_short_buffer", () => {
    expect(detectImageFormat(Buffer.from([0x25, 0x50, 0x44, 0x46]))).toBeNull();
    expect(detectImageFormat(Buffer.from([0x89]))).toBeNull();
  });

  it("image_content_type_maps_correctly", () => {
    expect(imageContentType("png")).toBe("image/png");
    expect(imageContentType("jpeg")).toBe("image/jpeg");
  });

  it("assert_image_size_passes_within_limit", () => {
    expect(() => assertImageSize(Buffer.alloc(2 * 1024 * 1024))).not.toThrow();
  });

  it("assert_image_size_throws_over_limit", () => {
    expect(() => assertImageSize(Buffer.alloc(2 * 1024 * 1024 + 1))).toThrow(FileTooLargeError);
  });

  it("build_logo_key_returns_expected_format", () => {
    expect(buildLogoKey("owner-123")).toBe("business-profiles/owner-123/logo");
  });

  it("build_logo_key_throws_for_empty_owner_id", () => {
    expect(() => buildLogoKey("")).toThrow();
  });

  it("upload_image_to_r2_calls_put_with_content_type", async () => {
    __mockSend.mockResolvedValueOnce({});
    await uploadImageToR2("business-profiles/owner-123/logo", Buffer.from([0x89, 0x50]), "image/png");
    const { PutObjectCommand: MockPut } = (await import("@aws-sdk/client-s3")) as Record<string, unknown> as { PutObjectCommand: ReturnType<typeof vi.fn> };
    expect(MockPut).toHaveBeenCalledWith(expect.objectContaining({ ContentType: "image/png" }));
  });

  it("upload_image_to_r2_wraps_sdk_error", async () => {
    const sdkErr = new Error("sdk fail");
    __mockSend.mockRejectedValueOnce(sdkErr);
    const err = await uploadImageToR2("business-profiles/owner-123/logo", Buffer.from([0x89, 0x50]), "image/png").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(R2UploadError);
    expect((err as R2UploadError).cause).toBe(sdkErr);
  });

  it("fetch_image_bytes_returns_buffer_and_content_type", async () => {
    const fakeBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    __mockSend.mockResolvedValueOnce({
      Body: { transformToByteArray: () => Promise.resolve(fakeBytes) },
      ContentType: "image/png",
    });
    const result = await fetchImageBytesFromR2("business-profiles/owner-123/logo");
    expect(result.buffer).toEqual(Buffer.from(fakeBytes));
    expect(result.contentType).toBe("image/png");
  });

  it("fetch_image_bytes_throws_r2_not_found_on_no_such_key", async () => {
    __mockSend.mockRejectedValueOnce({ name: "NoSuchKey" });
    const err = await fetchImageBytesFromR2("business-profiles/owner-123/logo").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(R2NotFoundError);
  });
});
