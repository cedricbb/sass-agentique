// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/actions/projects", () => ({
  transitionStatusAction: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }) => result.ok),
}));

import { ProjectStatusActions } from "../ProjectStatusActions";
import { transitionStatusAction } from "@/app/actions/projects";

describe("ProjectStatusActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("S1 — status draft → 2 boutons (Démarrer, Annuler)", () => {
    render(<ProjectStatusActions projectId="p-1" projectName="Test" currentStatus="draft" />);

    expect(screen.getByTestId("transition-active-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("transition-cancelled-trigger")).toBeInTheDocument();
  });

  it("S2 — status active → 3 boutons (Pause, Livré, Annuler)", () => {
    render(<ProjectStatusActions projectId="p-1" projectName="Test" currentStatus="active" />);

    expect(screen.getByTestId("transition-on_hold-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("transition-delivered-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("transition-cancelled-trigger")).toBeInTheDocument();
  });

  it("S3 — status delivered → message terminal, 0 bouton", () => {
    render(<ProjectStatusActions projectId="p-1" projectName="Test" currentStatus="delivered" />);

    expect(screen.getByText(/Aucune action possible/)).toBeInTheDocument();
    expect(screen.queryByTestId("transition-active-trigger")).not.toBeInTheDocument();
  });

  it("S4 — click Démarrer (draft→active, sans confirm) → action directe + redirect", async () => {
    vi.mocked(transitionStatusAction).mockResolvedValue({
      ok: true,
      data: { id: "p-1", status: "active" } as never,
    });
    render(<ProjectStatusActions projectId="p-1" projectName="Test" currentStatus="draft" />);

    fireEvent.click(screen.getByTestId("transition-active-trigger"));

    await waitFor(() => {
      expect(transitionStatusAction).toHaveBeenCalledWith("p-1", "active");
      expect(mockPush).toHaveBeenCalledWith("/admin/projects");
    });
  });

  it("S5 — click Annuler (draft→cancelled, avec confirm) → dialog → confirm → action + redirect", async () => {
    vi.mocked(transitionStatusAction).mockResolvedValue({
      ok: true,
      data: { id: "p-1", status: "cancelled" } as never,
    });
    render(<ProjectStatusActions projectId="p-1" projectName="Test" currentStatus="draft" />);

    fireEvent.click(screen.getByTestId("transition-cancelled-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("transition-cancelled-confirm")).toBeInTheDocument();
    });

    expect(transitionStatusAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("transition-cancelled-confirm"));

    await waitFor(() => {
      expect(transitionStatusAction).toHaveBeenCalledWith("p-1", "cancelled");
      expect(mockPush).toHaveBeenCalledWith("/admin/projects");
    });
  });
});
