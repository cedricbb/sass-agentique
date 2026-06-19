// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockUploadBusinessProfileLogoAction = vi.fn();
const mockRemoveBusinessProfileLogoAction = vi.fn();
vi.mock("@/app/actions/business-profile", () => ({
  uploadBusinessProfileLogoAction: (...args: unknown[]) =>
    mockUploadBusinessProfileLogoAction(...args),
  removeBusinessProfileLogoAction: (...args: unknown[]) =>
    mockRemoveBusinessProfileLogoAction(...args),
}));

const mockToastResult = vi.fn();
vi.mock("@/lib/toast", () => ({
  toastResult: (...args: unknown[]) => mockToastResult(...args),
}));

const mockRouterRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) =>
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...props} />,
}));

vi.mock("lucide-react", () => ({
  Upload: () => null,
  Trash2: () => null,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    disabled,
    onClick,
    "data-testid": testId,
    type,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    "data-testid"?: string;
    type?: "button" | "submit" | "reset";
  }) => (
    <button type={type ?? "button"} disabled={disabled} onClick={onClick} data-testid={testId}>
      {children}
    </button>
  ),
}));

import { BusinessProfileLogo } from "../BusinessProfileLogo";

function makePngFile(sizeBytes: number = 100): File {
  const bytes = new Uint8Array(sizeBytes);
  bytes[0] = 0x89;
  bytes[1] = 0x50;
  bytes[2] = 0x4e;
  bytes[3] = 0x47;
  return new File([bytes], "logo.png", { type: "image/png" });
}

function selectFile(input: HTMLElement, file: File) {
  Object.defineProperty(input, "files", {
    value: [file],
    configurable: true,
  });
  fireEvent.change(input);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("BusinessProfileLogo", () => {
  it("renders_logo_preview_when_has_logo", () => {
    render(<BusinessProfileLogo hasLogo={true} version="2024-01-01T00:00:00.000Z" />);

    const img = screen.getByTestId("business-profile-logo-preview");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      "src",
      "/api/admin/business-profile/logo?v=2024-01-01T00:00:00.000Z",
    );
  });

  it("renders_no_logo_message_when_no_logo", () => {
    render(<BusinessProfileLogo hasLogo={false} version="" />);

    expect(screen.queryByTestId("business-profile-logo-preview")).not.toBeInTheDocument();
    expect(screen.getByText("Aucun logo")).toBeInTheDocument();
  });

  it("calls_upload_action_with_form_data_on_valid_file", async () => {
    mockUploadBusinessProfileLogoAction.mockResolvedValue({ ok: true, data: {} });
    mockToastResult.mockReturnValue(true);

    render(<BusinessProfileLogo hasLogo={false} version="" />);

    const fileInput = screen.getByTestId("logo-file-input");
    const clickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

    fireEvent.click(screen.getByTestId("logo-upload-button"));
    expect(clickSpy).toHaveBeenCalledOnce();

    selectFile(fileInput, makePngFile());

    await waitFor(() => {
      expect(mockUploadBusinessProfileLogoAction).toHaveBeenCalledOnce();
      const formData: FormData = mockUploadBusinessProfileLogoAction.mock.calls[0][0];
      expect(formData.get("logo")).toBeInstanceOf(File);
    });
    expect(mockRouterRefresh).toHaveBeenCalledOnce();
  });

  it("rejects_file_exceeding_2mb_without_calling_action", async () => {
    render(<BusinessProfileLogo hasLogo={false} version="" />);

    const fileInput = screen.getByTestId("logo-file-input");
    selectFile(fileInput, makePngFile(3 * 1024 * 1024));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("2 MB");
    });
    expect(mockUploadBusinessProfileLogoAction).not.toHaveBeenCalled();
  });

  it("rejects_non_png_jpeg_file_without_calling_action", async () => {
    render(<BusinessProfileLogo hasLogo={false} version="" />);

    const fileInput = screen.getByTestId("logo-file-input");
    const gifFile = new File([new Uint8Array([0x47, 0x49, 0x46])], "logo.gif", {
      type: "image/gif",
    });
    selectFile(fileInput, gifFile);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("PNG ou un JPEG");
    });
    expect(mockUploadBusinessProfileLogoAction).not.toHaveBeenCalled();
  });

  it("calls_remove_action_and_refreshes_on_success", async () => {
    mockRemoveBusinessProfileLogoAction.mockResolvedValue({ ok: true, data: {} });
    mockToastResult.mockReturnValue(true);

    render(<BusinessProfileLogo hasLogo={true} version="v1" />);

    fireEvent.click(screen.getByTestId("logo-remove-button"));

    await waitFor(() => {
      expect(mockRemoveBusinessProfileLogoAction).toHaveBeenCalledOnce();
    });
    expect(mockRouterRefresh).toHaveBeenCalledOnce();
  });

  it("disables_buttons_while_pending", async () => {
    let resolveUpload: (v: unknown) => void;
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });
    mockUploadBusinessProfileLogoAction.mockReturnValue(uploadPromise);
    mockToastResult.mockReturnValue(false);

    render(<BusinessProfileLogo hasLogo={true} version="v1" />);

    const fileInput = screen.getByTestId("logo-file-input");
    selectFile(fileInput, makePngFile());

    await waitFor(() => {
      expect(screen.getByTestId("logo-upload-button")).toBeDisabled();
      expect(screen.getByTestId("logo-remove-button")).toBeDisabled();
    });

    resolveUpload!({ ok: false, error: { code: "ERR", message: "err", status: 400 } });

    await waitFor(() => {
      expect(screen.getByTestId("logo-upload-button")).not.toBeDisabled();
    });
  });
});
