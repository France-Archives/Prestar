// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  listFinesPage: vi.fn(),
  listPaymentsPage: vi.fn(),
  getUnpaidFineById: vi.fn(),
  recordPayment: vi.fn(),
  waiveFine: vi.fn(),
  listAuditLogs: vi.fn(),
  listAcademicTerms: vi.fn(),
  user: {
    id: "admin", email: "admin@example.test", role: "ADMIN", accountStatus: "ACTIVE",
    emailVerifiedAt: null, emailVerified: true, displayName: "Admin",
    student: null, librarian: null,
  },
}));

vi.mock("@/services/finesService", () => ({
  listFinesPage: mocks.listFinesPage,
  listPaymentsPage: mocks.listPaymentsPage,
  getUnpaidFineById: mocks.getUnpaidFineById,
  recordPayment: mocks.recordPayment,
  waiveFine: mocks.waiveFine,
  listFines: vi.fn(),
  listPayments: vi.fn(),
  createFine: vi.fn(),
  getMyPenalties: vi.fn(),
}));
vi.mock("@/services/adminService", () => ({
  listAuditLogs: mocks.listAuditLogs,
  listAcademicTerms: mocks.listAcademicTerms,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));

const fine = {
  id: "41", penaltyId: "41", amount: 200, paidAmount: 0, balance: 200,
  status: "UNPAID", fineType: "DAMAGED_BOOK", fineTypeLabel: "Damaged Book",
  recordedAt: "2026-10-24T10:00:00.000Z", student: {
    id: "7", userId: "9", studentNumber: "SN-7", firstName: "Ada", lastName: "Lovelace",
  },
  bookTitle: "Algorithms", book: { id: "12", title: "Algorithms", isbn: "9781234567890" },
  loanId: "17", notes: null,
};

let FinesManagementPage: typeof import("./librarian/pages/FinesManagementPage").default;
let PaymentRecordingPage: typeof import("./librarian/pages/PaymentRecordingPage").default;
let AuditLogsPage: typeof import("./admin/pages/AuditLogsPage").default;
let AcademicTermsPage: typeof import("./admin/pages/AcademicTermsPage").default;

beforeAll(async () => {
  vi.stubEnv("VITE_USE_MOCKS", "false");
  [FinesManagementPage, PaymentRecordingPage, AuditLogsPage, AcademicTermsPage] = await Promise.all([
    import("./librarian/pages/FinesManagementPage").then((module) => module.default),
    import("./librarian/pages/PaymentRecordingPage").then((module) => module.default),
    import("./admin/pages/AuditLogsPage").then((module) => module.default),
    import("./admin/pages/AcademicTermsPage").then((module) => module.default),
  ]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("separated fines and payments pages", () => {
  it("keeps payment recording controls off the Fines page", async () => {
    mocks.listFinesPage.mockResolvedValue({ data: [fine], meta: { page: 1, pageSize: 15, total: 1 } });
    render(<MemoryRouter><FinesManagementPage /></MemoryRouter>);

    expect(await screen.findByRole("link", { name: "Record payment" })).toBeTruthy();
    expect(screen.queryByLabelText("Official receipt no.")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Payment history" })).toBeNull();
  });

  it("preselects a fine and locks the full payment amount while requiring a receipt", async () => {
    mocks.listFinesPage.mockResolvedValue({ data: [fine], meta: { page: 1, pageSize: 15, total: 1 } });
    mocks.listPaymentsPage.mockResolvedValue({ data: [], meta: { page: 1, pageSize: 15, total: 0 } });
    mocks.getUnpaidFineById.mockResolvedValue(fine);
    render(<MemoryRouter initialEntries={["/staff/payments?fineId=41"]}><PaymentRecordingPage /></MemoryRouter>);

    const amount = await screen.findByLabelText("Amount (₱)") as HTMLInputElement;
    const receipt = screen.getByLabelText(/Official receipt no\./) as HTMLInputElement;
    expect(amount.readOnly).toBe(true);
    expect(amount.value).toBe("200");
    expect(receipt.required).toBe(true);
    expect(screen.getAllByText(/Ada Lovelace/).length).toBeGreaterThan(0);
  });

  it("exposes the action filter on Audit Logs", async () => {
    mocks.listAuditLogs.mockResolvedValue({ data: [], meta: { page: 1, pageSize: 15, total: 0 } });
    render(<MemoryRouter><AuditLogsPage /></MemoryRouter>);

    const action = await screen.findByLabelText("Action") as HTMLSelectElement;
    expect(action.options[0]?.textContent).toBe("All actions");
    expect(Array.from(action.options).some((option) => option.value === "FINE_WAIVED")).toBe(true);
    expect(Array.from(action.options).some((option) => option.value === "PAYMENT_RECORDED")).toBe(true);
  });

  it("renders the terms list without live write actions", async () => {
    mocks.listAcademicTerms.mockResolvedValue([{
      id: "2", name: "Second Semester", startDate: "2026-01-01", endDate: "2026-05-31",
      corDeadline: "2026-01-15", status: "ACTIVE",
    }]);
    render(<MemoryRouter><AcademicTermsPage /></MemoryRouter>);

    expect(await screen.findByText("Second Semester")).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/read-only/i)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Add term" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
