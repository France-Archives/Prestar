import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));
vi.mock("./reportsService", () => ({
  getStudentDashboard: vi.fn(),
}));

import { apiClient } from "@/services/apiClient";
import { approveCor, getCorDocument, listAcademicTerms, listCorQueue, listMyVerifications, rejectCor, submitCor } from "./verificationService";

beforeEach(() => vi.clearAllMocks());

describe("live verification service", () => {
  it("normalizes raw academic term lists and numeric IDs", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [{
        id: 6,
        name: "Current term",
        startDate: "2026-08-01",
        endDate: "2026-12-31",
        corDeadline: "2026-12-31",
        status: "Active",
      }],
    });

    await expect(listAcademicTerms()).resolves.toEqual([{
      id: "6",
      name: "Current term",
      startDate: "2026-08-01",
      endDate: "2026-12-31",
      corDeadline: "2026-12-31",
      status: "ACTIVE",
    }]);
    expect(apiClient.get).toHaveBeenCalledWith("/academic-terms");
  });

  it("maps raw verification history into the Client status and date contract", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [{
        verification_id: 11,
        term_id: 6,
        termName: "Current term",
        status: "Rejected",
        submitted_at: "2026-10-20T12:00:00.000Z",
        reviewed_at: "2026-10-21T12:00:00.000Z",
        valid_from: null,
        valid_until: null,
        remarks: "Missing signature",
      }],
    });

    await expect(listMyVerifications()).resolves.toMatchObject([{
      id: "11",
      academicTermId: "6",
      status: "REJECTED",
      rejectionReason: "Missing signature",
      effectiveFrom: null,
      reviewedAt: "2026-10-21T12:00:00.000Z",
    }]);
    expect(apiClient.get).toHaveBeenCalledWith("/me/verifications");
  });

  it("submits only the filename because the Server has no document upload contract", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        verification_id: 30,
        term_id: 6,
        termName: "Current term",
        status: "Pending",
        submitted_at: "2026-10-20T12:00:00.000Z",
      },
    });

    const file = new File(["private-document-bytes"], "registration.pdf", { type: "application/pdf" });
    await expect(submitCor({ academicTermId: "6", file })).resolves.toMatchObject({
      id: "30",
      status: "PENDING",
      originalFileName: "",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/me/verifications", {
      proof_file: "registration.pdf",
    });
  });

  it("uses the existing staff approval route and maps the returned record", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        verification_id: 30,
        term_id: 6,
        termName: "Current term",
        status: "Approved",
        valid_from: "2026-10-20",
        valid_until: "2026-12-31",
      },
    });

    await expect(approveCor("30")).resolves.toMatchObject({
      id: "30",
      status: "APPROVED",
      effectiveFrom: "2026-10-20",
      validUntil: "2026-12-31",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/staff/verifications/30/approve", {});
  });

  it("loads the real staff verification queue with the requested status", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [{
        verification_id: 30,
        term_id: 6,
        termName: "Current term",
        status: "Pending",
        submitted_at: "2026-10-20T12:00:00.000Z",
        student: { id: 9, name: "Example Student", student_number: "S-009" },
      }],
    });

    await expect(listCorQueue({ status: "PENDING" })).resolves.toMatchObject([{
      id: "30",
      status: "PENDING",
      student: { id: "9", name: "Example Student", studentNumber: "S-009" },
    }]);
    expect(apiClient.get).toHaveBeenCalledWith("/staff/verifications", {
      params: { status: "Pending" },
    });
  });

  it("requires a rejection reason and sends it to the real staff endpoint", async () => {
    await expect(rejectCor("30", { reason: "  " })).rejects.toMatchObject({
      message: "A reason is required to reject a COR.",
    });
    expect(apiClient.post).not.toHaveBeenCalled();

    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        verification_id: 30,
        term_id: 6,
        termName: "Current term",
        status: "Rejected",
        remarks: "Missing signature",
      },
    });
    await expect(rejectCor("30", { reason: "Missing signature" })).resolves.toMatchObject({
      id: "30",
      status: "REJECTED",
      rejectionReason: "Missing signature",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/staff/verifications/30/reject", {
      reason: "Missing signature",
    });
  });

  it("fetches the private COR document from the staff document endpoint", async () => {
    const document = new Blob(["cor contents"], { type: "application/pdf" });
    vi.mocked(apiClient.get).mockResolvedValue({ data: document });

    await expect(getCorDocument("30")).resolves.toBe(document);
    expect(apiClient.get).toHaveBeenCalledWith("/staff/verifications/30/document", {
      responseType: "blob",
    });
  });
});
