// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/actions/prestations", () => ({
  archivePrestationAction: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }) => result.ok),
}));

import { ArchivePrestationButton } from "../ArchivePrestationButton";
import { archivePrestationAction } from "@/app/actions/prestations";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("ArchivePrestationButton", () => {
  it("A1 — trigger ouvre le dialog", () => {
    render(<ArchivePrestationButton id="p-1" prestationName="Mon service" />);
    expect(screen.queryByText(/catalogue/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("archive-prestation-trigger"));

    expect(screen.getByText(/catalogue/i)).toBeInTheDocument();
  });

  it("A2 — confirm → archivePrestationAction(id) + redirect", async () => {
    vi.mocked(archivePrestationAction).mockResolvedValue({ ok: true, data: null } as never);

    render(<ArchivePrestationButton id="p-1" prestationName="Mon service" />);
    fireEvent.click(screen.getByTestId("archive-prestation-trigger"));
    fireEvent.click(screen.getByTestId("archive-prestation-confirm"));

    await waitFor(() => {
      expect(archivePrestationAction).toHaveBeenCalledWith("p-1");
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin/prestations");
    });
  });

  it("A3 — prestationName affiché dans le title du dialog", async () => {
    render(<ArchivePrestationButton id="p-1" prestationName="Site Web Premium" />);
    fireEvent.click(screen.getByTestId("archive-prestation-trigger"));

    expect(screen.getByText(/Site Web Premium/)).toBeInTheDocument();
  });
});
