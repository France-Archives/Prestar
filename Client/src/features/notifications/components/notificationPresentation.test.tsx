// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { NotificationItem } from "@/types";
import NotificationItemCard from "./NotificationItem";
import { getNotificationLink, getNotificationPresentation } from "./notificationPresentation";

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

const item = (type: string, relatedEntityType: NotificationItem["relatedEntityType"] = "BORROWING_REQUEST"): NotificationItem => ({
  id: "n-1",
  type: type as NotificationItem["type"],
  title: "Notification",
  message: "Details",
  relatedEntityType,
  relatedEntityId: "req-7",
  readAt: null,
  createdAt: "2026-10-25T00:00:00.000Z",
});

describe("notification presentation and destinations", () => {
  it.each([
    ["BORROW_REQUEST_APPROVED", "success", "Ready to pick up"],
    ["BORROW_REQUEST_REJECTED", "danger", undefined],
    ["BORROW_REQUEST_EXPIRED", "warning", undefined],
    ["HANDOVER_REJECTED", "danger", undefined],
    ["LOAN_ISSUED", "success", undefined],
    ["RESERVATION_CONFIRMED", "info", undefined],
    ["RESERVATION_OFFERED", "success", "Ready to pick up"],
  ])("maps %s to the expected tone and badge", (type, tone, badge) => {
    expect(getNotificationPresentation(type).tone).toBe(tone);
    expect(getNotificationPresentation(type).badge).toBe(badge);
    expect(getNotificationPresentation(type).icon).toBeTruthy();
  });

  it("uses a generic bell for an unknown future type", () => {
    expect(getNotificationPresentation("NEW_SERVER_EVENT").icon).toBe(getNotificationPresentation("GENERAL").icon);
  });

  it.each([
    ["BORROW_REQUEST_APPROVED", "/app/requests"],
    ["BORROW_REQUEST_REJECTED", "/app/requests"],
    ["BORROW_REQUEST_EXPIRED", "/app/requests"],
    ["HANDOVER_REJECTED", "/app/requests"],
    ["LOAN_ISSUED", "/app/borrowing"],
    ["RESERVATION_CONFIRMED", "/app/reservations?reservationId=req-7"],
    ["RESERVATION_OFFERED", "/app/reservations?reservationId=req-7"],
  ])("links %s to its student destination", (type, path) => {
    const entity = type.startsWith("RESERVATION_") ? "RESERVATION" : type === "LOAN_ISSUED" ? "LOAN" : "BORROWING_REQUEST";
    expect(getNotificationLink(item(type, entity), "STUDENT")).toBe(path);
  });

  it("marks an unread notification read before navigating", async () => {
    const onRead = vi.fn(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      return true;
    });
    render(
      <MemoryRouter initialEntries={["/app/notifications"]}>
        <NotificationItemCard item={item("BORROW_REQUEST_APPROVED")} role="STUDENT" onRead={onRead} />
        <Routes>
          <Route path="*" element={<Location />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pick up details" }));
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/app/requests"));
    expect(onRead).toHaveBeenCalledWith("n-1");
  });
});
