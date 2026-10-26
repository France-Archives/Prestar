import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAcademicTerm } = vi.hoisted(() => ({ createAcademicTerm: vi.fn() }));

vi.mock("@/services/adminService", () => ({
  createAcademicTerm,
  updateAcademicTerm: vi.fn(),
}));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ success: vi.fn() }) }));

import AcademicTermForm from "./AcademicTermForm";

describe("AcademicTermForm validation", () => {
  beforeEach(() => createAcademicTerm.mockReset());

  it("rejects an end date before the start date and a deadline before the start date", () => {
    render(<AcademicTermForm onClose={vi.fn()} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "First Semester" } });
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2027-08-10" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2027-08-09" } });
    fireEvent.change(screen.getByLabelText("COR deadline"), { target: { value: "2027-08-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save term" }));

    expect(screen.getByText("The end date cannot be before the start date.")).toBeTruthy();
    expect(screen.getByText("The COR deadline cannot be before the start date.")).toBeTruthy();
    expect(createAcademicTerm).not.toHaveBeenCalled();
  });

  it("allows an end date equal to the start date when the deadline is within the term", () => {
    render(<AcademicTermForm onClose={vi.fn()} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "One-day term" } });
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2027-08-10" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2027-08-10" } });
    fireEvent.change(screen.getByLabelText("COR deadline"), { target: { value: "2027-08-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save term" }));

    expect(createAcademicTerm).toHaveBeenCalledWith({
      name: "One-day term",
      startDate: "2027-08-10",
      endDate: "2027-08-10",
      corDeadline: "2027-08-10",
      status: "UPCOMING",
    });
  });
});
