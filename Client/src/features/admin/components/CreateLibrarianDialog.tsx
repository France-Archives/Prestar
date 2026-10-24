import Modal from "@/components/ui/Modal";
import * as adminService from "@/services/adminService";
import type { CreateStaffAccountRequest } from "@/types";
import StaffAccountForm from "./StaffAccountForm";

interface Props {
  onClose: () => void;
  onDone: () => void;
}

export default function CreateLibrarianDialog({ onClose, onDone }: Props) {
  const create = (request: CreateStaffAccountRequest) => adminService.createLibrarian(request);

  return (
    <Modal title="Create a Librarian account" wide onClose={onClose}>
      <StaffAccountForm role="Librarian" onCreate={create} onDone={onDone} onCancel={onClose} />
    </Modal>
  );
}
