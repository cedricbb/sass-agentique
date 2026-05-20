// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReportForm } from "../ReportForm";
import type { Client, Project } from "@saas/db";

Element.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUploadAndCreateReportAction = vi.fn();
vi.mock("@/app/actions/reports", () => ({
  uploadAndCreateReportAction: (...args: unknown[]) => mockUploadAndCreateReportAction(...args),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }) => result.ok),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const mockClients: Client[] = [
  {
    id: "c-1",
    name: "Acme Corp",
    slug: "acme",
    type: "company",
    email: null,
    phone: null,
    billingAddress: null,
    notes: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "c-2",
    name: "Beta Inc",
    slug: "beta",
    type: "company",
    email: null,
    phone: null,
    billingAddress: null,
    notes: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
] as Client[];

const mockProjects: Project[] = [
  {
    id: "p-1",
    clientId: "c-1",
    name: "Project Alpha",
    slug: "alpha",
    status: "active",
    description: null,
    startedAt: null,
    deliveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "p-2",
    clientId: "c-2",
    name: "Project Beta",
    slug: "beta",
    status: "active",
    description: null,
    startedAt: null,
    deliveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
] as Project[];

function renderForm() {
  return render(<ReportForm clients={mockClients} projects={mockProjects} />);
}

describe("ReportForm", () => {
  it("T1: renders all 7 testids", () => {
    renderForm();
    expect(screen.getByTestId("report-file-input")).toBeInTheDocument();
    expect(screen.getByTestId("report-client-select")).toBeInTheDocument();
    expect(screen.getByTestId("report-project-select")).toBeInTheDocument();
    expect(screen.getByTestId("report-title-input")).toBeInTheDocument();
    expect(screen.getByTestId("report-kind-select")).toBeInTheDocument();
    expect(screen.getByTestId("report-summary-input")).toBeInTheDocument();
    expect(screen.getByTestId("report-form-submit")).toBeInTheDocument();
  });

  it("T2: rejects non-PDF file", async () => {
    renderForm();
    const input = screen.getByTestId("report-file-input");
    const txtFile = new File(["hello"], "test.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [txtFile] } });
    expect(await screen.findByText("Le fichier doit être un PDF.")).toBeInTheDocument();
  });

  it("T3: rejects >10MB file", async () => {
    renderForm();
    const input = screen.getByTestId("report-file-input");
    const largeBuffer = new Uint8Array(10 * 1024 * 1024 + 1);
    const largeFile = new File([largeBuffer], "big.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [largeFile] } });
    expect(await screen.findByText("Le fichier dépasse 10 Mo.")).toBeInTheDocument();
  });

  it("T4: submit button disabled when file/clientId/title missing", () => {
    renderForm();
    const submitButton = screen.getByTestId("report-form-submit");
    expect(submitButton).toBeDisabled();
  });

  it("T5: happy path submit + router.push", async () => {
    mockUploadAndCreateReportAction.mockResolvedValue({ ok: true, data: { id: "r-1" } });
    renderForm();

    const fileInput = screen.getByTestId("report-file-input");
    const pdfFile = new File([new Uint8Array(100)], "report.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    const titleInput = screen.getByTestId("report-title-input");
    fireEvent.change(titleInput, { target: { value: "Mon rapport" } });

    const clientTrigger = screen.getByTestId("report-client-select");
    fireEvent.click(clientTrigger);
    const clientOption = await screen.findByText("Acme Corp");
    fireEvent.click(clientOption);

    const submitButton = screen.getByTestId("report-form-submit");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUploadAndCreateReportAction).toHaveBeenCalledWith(expect.any(FormData));
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin/reports/r-1");
    });
  });

  it("T6: projects filtered by selected clientId", async () => {
    renderForm();

    const clientTrigger = screen.getByTestId("report-client-select");
    fireEvent.click(clientTrigger);
    const clientOption = await screen.findByText("Acme Corp");
    fireEvent.click(clientOption);

    const projectTrigger = screen.getByTestId("report-project-select");
    fireEvent.click(projectTrigger);

    await waitFor(() => {
      expect(screen.getByText("Project Alpha")).toBeInTheDocument();
      expect(screen.queryByText("Project Beta")).not.toBeInTheDocument();
    });
  });
});
