// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getMyPenalties: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "student-1",
      email: "student@example.test",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerifiedAt: null,
      emailVerified: true,
      displayName: "Test Student",
      student: null,
      librarian: null,
    },
    logout: mocks.logout,
  }),
}));
vi.mock("@/services/finesService", () => ({ getMyPenalties: mocks.getMyPenalties }));

import Sidebar from "./Sidebar";

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar collapsed={false} drawerOpen isDesktop={false} onCloseDrawer={vi.fn()} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("student penalties sidebar badge", () => {
  it("shows the unpaid penalty count when the outstanding balance is positive", async () => {
    mocks.getMyPenalties.mockResolvedValue({
      fines: [{ balance: 100 }, { balance: 50 }, { balance: 0 }],
      totalBalance: 150,
      message: "Cash only.",
    });
    renderSidebar();

    expect(await screen.findByLabelText("2 unpaid penalties")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Penalties/ })).toBeTruthy();
  });

  it("does not show a badge when there is no outstanding balance", async () => {
    mocks.getMyPenalties.mockResolvedValue({ fines: [], totalBalance: 0, message: "Cash only." });
    renderSidebar();

    await waitFor(() => expect(mocks.getMyPenalties).toHaveBeenCalledOnce());
    expect(screen.queryByLabelText(/unpaid penalties/)).toBeNull();
    expect(screen.getByRole("link", { name: "Penalties" })).toBeTruthy();
  });
});
