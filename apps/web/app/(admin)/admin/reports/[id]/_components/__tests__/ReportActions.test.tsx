// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("@/app/actions/reports", () => ({
  markReportIssuedAction: vi.fn(),
  deleteReportAction: vi.fn(),
}));

const mockRefresh = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: mockRefresh, push: mockPush })),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ReportActions } from "../ReportActions";
import {
  markReportIssuedAction,
  deleteReportAction,
} from "@/app/actions/reports";
import { toastResult, toast } from "@/lib/toast";

const mockMarkIssued = markReportIssuedAction as ReturnType<typeof vi.fn>;
const mockDeleteReport = deleteReportAction as ReturnType<typeof vi.fn>;
const mockToastResult = toastResult as unknown as ReturnType<typeof vi.fn>;

afterEach(() => cleanup());

describe("ReportActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders mark-issued button when draft", () => {
    render(<ReportActions reportId="r1" isIssued={false} />);
    expect(
      screen.getByTestId("report-mark-issued-button"),
    ).toBeInTheDocument();
  });

  it("hides mark-issued button when issued", () => {
    render(<ReportActions reportId="r1" isIssued={true} />);
    expect(
      screen.queryByTestId("report-mark-issued-button"),
    ).not.toBeInTheDocument();
  });

  it("disables delete button when issued", () => {
    render(<ReportActions reportId="r1" isIssued={true} />);
    expect(screen.getByTestId("report-delete-trigger")).toBeDisabled();
  });

  it("calls markReportIssuedAction and refreshes on mark-issued click", async () => {
    mockMarkIssued.mockResolvedValue({ ok: true, data: null });
    mockToastResult.mockReturnValue(true);

    render(<ReportActions reportId="r1" isIssued={false} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("report-mark-issued-button"));
    });

    expect(mockMarkIssued).toHaveBeenCalledWith("r1");
    expect(mockToastResult).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("opens AlertDialog when delete trigger clicked", async () => {
    render(<ReportActions reportId="r1" isIssued={false} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("report-delete-trigger"));
    });

    expect(screen.getByTestId("report-delete-confirm")).toBeInTheDocument();
  });

  it("calls deleteReportAction and navigates on confirm delete", async () => {
    mockDeleteReport.mockResolvedValue({ ok: true, data: null });

    render(<ReportActions reportId="r1" isIssued={false} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("report-delete-trigger"));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("report-delete-confirm"));
    });

    expect(mockDeleteReport).toHaveBeenCalledWith("r1");
    expect(toast.success).toHaveBeenCalledWith("Rapport supprimé.");
    expect(mockPush).toHaveBeenCalledWith("/admin/reports");
  });

  it("shows error toast when delete returns REPORT_DELETE_LOCKED", async () => {
    mockDeleteReport.mockResolvedValue({
      ok: false,
      error: { code: "REPORT_DELETE_LOCKED" },
    });

    render(<ReportActions reportId="r1" isIssued={false} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("report-delete-trigger"));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("report-delete-confirm"));
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Un rapport émis ne peut pas être supprimé.",
    );
  });
});
