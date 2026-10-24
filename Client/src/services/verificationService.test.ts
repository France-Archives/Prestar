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
import { approveCor, listAcademicTerms, listMyVerifications, submitCor } from "./verificationService";

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

  it("submits multipart FormData with the captured photo file to the live verification endpoint", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        verification_id: 30,
        term_id: 6,
        termName: "Current term",
        status: "Pending",
        submitted_at: "2026-10-20T12:00:00.000Z",
      },
    });

    const file = new File(["fake-image-bytes"], "cor_captured.jpg", { type: "image/jpeg" });
    await expect(submitCor({ academicTermId: "6", file })).resolves.toMatchObject({
      id: "30",
      status: "PENDING",
      originalFileName: "",
    });
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(apiClient.post).mock.calls[0];
    expect(url).toBe("/me/verifications");
    expect(body).toBeInstanceOf(FormData);
    const fd = body as FormData;
    const uploadedFile = fd.get("file") as File;
    expect(uploadedFile.name).toBe("cor_captured.jpg");
    expect(uploadedFile.type).toBe("image/jpeg");
    expect(fd.get("academicTermId")).toBe("6");
    expect(config).toEqual({ headers: { "Content-Type": undefined } });
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

  it("maps staff verification queue with extended student and reviewer fields", async () => {
    const { listCorQueue } = await import("./verificationService");
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [{
        id: 42,
        academicTermId: 6,
        termName: "1st Semester 2026-2027",
        status: "Pending",
        proof_file: "cor_42_test.jpg",
        submittedAt: "2026-10-22T08:00:00.000Z",
        student: {
          id: "std-1",
          studentNumber: "2023-00123",
          name: "Maria Santos",
          email: "maria@wmsu.edu.ph",
          college: "College of Science",
          course: "BSCS",
          yearLevel: 3,
          studentType: "Regular",
        },
        reviewer: {
          id: "staff-1",
          name: "Librarian Cruz",
          email: "cruz@wmsu.edu.ph",
          role: "Librarian",
        },
      }],
    });

    const queue = await listCorQueue({ status: "PENDING", search: "Maria" });
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      id: "42",
      termName: "1st Semester 2026-2027",
      status: "PENDING",
      originalFileName: "cor_42_test.jpg",
      student: {
        id: "std-1",
        studentNumber: "2023-00123",
        name: "Maria Santos",
        email: "maria@wmsu.edu.ph",
        college: "College of Science",
        course: "BSCS",
        yearLevel: 3,
        studentType: "Regular",
      },
      reviewer: {
        id: "staff-1",
        name: "Librarian Cruz",
        email: "cruz@wmsu.edu.ph",
        role: "Librarian",
      },
    });
    expect(apiClient.get).toHaveBeenCalledWith("/staff/verifications", {
      params: { status: "Pending", search: "Maria" },
    });
  });

  it("fetches document blob and extracts filename for staff review", async () => {
    const { getCorDocumentInfo } = await import("./verificationService");
    const fakeBlob = new Blob(["image-bytes"], { type: "image/jpeg" });
    vi.mocked(apiClient.get).mockResolvedValue({
      data: fakeBlob,
      headers: {
        "content-disposition": 'inline; filename="cor_student_123.jpg"',
        "content-type": "image/jpeg",
      },
    });

    const globalCreateObjectURL = vi.fn().mockReturnValue("blob:http://localhost/test-blob");
    globalThis.URL.createObjectURL = globalCreateObjectURL;

    const info = await getCorDocumentInfo("42");
    expect(info.simulated).toBe(false);
    expect(info.fileName).toBe("cor_student_123.jpg");
    expect(info.url).toBe("blob:http://localhost/test-blob");
    expect(apiClient.get).toHaveBeenCalledWith("/staff/verifications/42/document", {
      responseType: "blob",
    });
  });

  it("fetches single verification detail for staff and student", async () => {
    const { getStaffVerification, getMyVerification } = await import("./verificationService");
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        id: 55,
        academicTermId: 6,
        termName: "1st Semester 2026-2027",
        status: "Approved",
        proof_file: "cor_55.jpg",
        student: { id: "std-55", name: "Juan Luna", studentNumber: "2024-00001" },
      },
    });

    const staffDetail = await getStaffVerification("55");
    expect(staffDetail.id).toBe("55");
    expect(staffDetail.student.name).toBe("Juan Luna");
    expect(apiClient.get).toHaveBeenCalledWith("/staff/verifications/55");

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        id: 55,
        academicTermId: 6,
        termName: "1st Semester 2026-2027",
        status: "Approved",
        proof_file: "cor_55.jpg",
      },
    });

    const myDetail = await getMyVerification("55");
    expect(myDetail.id).toBe("55");
    expect(apiClient.get).toHaveBeenCalledWith("/me/verifications/55");
  });
});
