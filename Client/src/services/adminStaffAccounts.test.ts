import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("@/services/apiClient", () => ({
  apiClient: { post: vi.fn() },
}));

import { apiClient } from "@/services/apiClient";
import * as adminService from "./adminService";

const request = {
  email: "staff@example.com",
  password: "SecurePass123",
  firstName: "Morgan",
  lastName: "Lee",
  employeeNumber: "EMP-1",
  permissions: ["COR_REVIEW" as const],
};

beforeEach(() => vi.clearAllMocks());

describe("live staff account creation", () => {
  it("creates a Librarian with the Server request shape", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: "Created.", user: { role: "Librarian" } } });

    await expect(adminService.createLibrarian(request)).resolves.toEqual({ role: "Librarian" });
    expect(apiClient.post).toHaveBeenCalledWith("/admin/librarians", {
      email: request.email,
      password: request.password,
      firstName: request.firstName,
      lastName: request.lastName,
      employeeNumber: request.employeeNumber,
    });
  });

  it("creates an Admin with the Server request shape", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: "Created.", user: { role: "Admin" } } });

    await expect(adminService.createAdmin(request)).resolves.toEqual({ role: "Admin" });
    expect(apiClient.post).toHaveBeenCalledWith("/admin/admins", {
      email: request.email,
      password: request.password,
      firstName: request.firstName,
      lastName: request.lastName,
      employeeNumber: request.employeeNumber,
    });
  });

  it("normalizes Server errors", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error("Server validation failed."));
    await expect(adminService.createAdmin(request)).rejects.toMatchObject({
      code: "UNKNOWN",
      message: "Server validation failed.",
    });
  });
});
