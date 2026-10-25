import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/services/apiClient", () => ({
  apiClient: { get },
}));

describe("adminService live read-only endpoints", () => {
  let service: typeof import("./adminService");

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCKS", "false");
    get.mockReset();
    service = await import("./adminService");
  });

  it("maps the plain academic terms response", async () => {
    get.mockResolvedValue({
      data: [{
        id: 2, termId: 2, name: "Second Semester", startDate: "2026-01-01",
        endDate: "2026-05-31", corDeadline: "2026-01-15", status: "Active",
      }],
    });

    await expect(service.listAcademicTerms()).resolves.toEqual([{
      id: "2", name: "Second Semester", startDate: "2026-01-01",
      endDate: "2026-05-31", corDeadline: "2026-01-15", status: "ACTIVE",
    }]);
    expect(get).toHaveBeenCalledWith("/academic-terms");
  });

  it("sends all audit-log filters and maps the meta pagination shape", async () => {
    get.mockResolvedValue({
      data: {
        data: [{
          id: "18", auditId: "18", actorUserId: "3", actorName: "Staff",
          actorRole: "LIBRARIAN", action: "PAYMENT_RECORDED", entityType: "PAYMENT",
          entityId: "9", summary: "Recorded payment.", createdAt: "2026-10-24T10:00:00.000Z",
        }],
        meta: { page: 2, pageSize: 15, total: 21 },
      },
    });
    const params = {
      from: "2026-10-01",
      to: "2026-10-31",
      actorRole: "LIBRARIAN" as const,
      action: "PAYMENT_RECORDED",
      search: "receipt",
      page: 2,
      pageSize: 15,
    };

    const result = await service.listAuditLogs(params);

    expect(get).toHaveBeenCalledWith("/admin/audit-logs", { params });
    expect(result.data[0]).toMatchObject({
      id: "18", actorUserId: "3", entityId: "9", action: "PAYMENT_RECORDED",
    });
    expect(result.meta).toEqual({ page: 2, pageSize: 15, total: 21 });
  });

  it("rejects unavailable term writes without making a request", async () => {
    await expect(service.createAcademicTerm({
      name: "Term", startDate: "2026-01-01", endDate: "2026-05-31", corDeadline: "2026-01-15",
    })).rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
    expect(get).not.toHaveBeenCalled();
  });

  it("rejects malformed live term data", async () => {
    get.mockResolvedValue({ data: [{ id: "bad" }] });
    await expect(service.listAcademicTerms()).rejects.toThrow("incomplete academic term");
  });
});
