// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("focuses Cancel first for destructive actions", () => {
    render(
      <ConfirmDialog
        title="Delete item?"
        message="This removes the item."
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("alertdialog", { name: "Delete item?" })).toBeTruthy();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        title="Continue?"
        message="This submits the request."
        confirmLabel="Submit"
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("blocks close controls and disables both buttons while loading", () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        title="Working?"
        message="The action is running."
        confirmLabel="Save"
        loading
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Working?" });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: /Working\.\.\./ }).hasAttribute("disabled")).toBe(true);
  });

  it("shows a failed action inside the dialog and keeps it open", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error("The action failed."));
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        title="Save change?"
        message="The change will be saved."
        confirmLabel="Save"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain("The action failed.");
    expect(screen.getByRole("dialog", { name: "Save change?" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each(["Student", "Librarian", "Admin"] as const)(
    "%s action does not call the service on cancel and only runs once on confirm",
    async (role) => {
      const user = userEvent.setup();
      const service = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      function Scenario() {
        const [open, setOpen] = useState(true);
        return open ? (
          <ConfirmDialog
            title={`${role} action?`}
            message="This action changes a record."
            confirmLabel="Confirm action"
            onConfirm={service}
            onClose={() => {
              onClose();
              setOpen(false);
            }}
          />
        ) : null;
      }

      const view = render(<Scenario />);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(service).not.toHaveBeenCalled();
      view.unmount();

      render(
        <ConfirmDialog
          title={`${role} action?`}
          message="This action changes a record."
          confirmLabel="Confirm action"
          onConfirm={service}
          onClose={onClose}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Confirm action" }));
      expect(service).toHaveBeenCalledOnce();
    },
  );

  it("does not call an action twice on a double click", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const service = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(
      <ConfirmDialog
        title="Submit?"
        message="This submits the form."
        confirmLabel="Submit"
        onConfirm={service}
        onClose={vi.fn()}
      />,
    );

    await user.dblClick(screen.getByRole("button", { name: "Submit" }));
    expect(service).toHaveBeenCalledOnce();
    finish();
  });
});
