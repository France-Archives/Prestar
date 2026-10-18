import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("@/services/apiClient", () => ({ apiGet: vi.fn() }));

import { apiGet } from "@/services/apiClient";
import { getStudentDashboard } from "@/services/reportsService";
import type { StudentDashboardData } from "@/types";

beforeEach(() => vi.clearAllMocks());

describe("live student dashboard", () => {
  it("loads the dashboard through the shared API client", async () => {
    const dashboard = { recommended: null, recentNotifications: null, unreadCount: null } as StudentDashboardData;
    vi.mocked(apiGet).mockResolvedValue(dashboard);

    await expect(getStudentDashboard()).resolves.toBe(dashboard);
    expect(apiGet).toHaveBeenCalledWith("/me/dashboard");
  });
});
