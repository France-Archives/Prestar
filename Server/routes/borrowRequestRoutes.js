// Server/routes/borrowRequestRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import {
  approveRequest,
  cancelRequest,
  confirmHandover,
  createRequest,
  getAvailableCopies,
  listMyRequests,
  listRequestsQueue,
  rejectHandover,
  rejectRequest,
  reviewRequest,
} from "../controllers/borrowRequestController.js";
import {
  validateApproveBorrowRequest,
  validateCreateBorrowRequest,
  validatePickupHandover,
  validateRejectBorrowRequest,
  validateRejectPickup,
  validateRequestId,
  validateRequestListQuery,
  validateReviewBorrowRequest,
} from "../validators/borrowRequestValidator.js";

const router = Router();
const staffOnly = requireRole(["Admin", "Librarian"]);
const studentsOnly = requireRole(["Student"]);

router.use(authMiddleware);

// 1. POST /api/borrow-requests [Student]
router.post("/", studentsOnly, validateCreateBorrowRequest, createRequest);

// 1b. POST /api/borrow-requests/:id/cancel [Student]
router.post("/:id/cancel", studentsOnly, validateRequestId, cancelRequest);

// 2. GET /api/borrow-requests/mine [Student]
router.get("/mine", studentsOnly, validateRequestListQuery, listMyRequests);

// 3. GET /api/borrow-requests?status=Pending&page=&limit= [Librarian, Admin]
router.get("/", staffOnly, validateRequestListQuery, listRequestsQueue);

// 4. GET /api/borrow-requests/:id/available-copies [Librarian, Admin]
router.get(
  "/:id/available-copies",
  staffOnly,
  validateRequestId,
  getAvailableCopies,
);

// 5. POST /api/borrow-requests/:id/review [Librarian, Admin]
router.post(
  "/:id/review",
  staffOnly,
  validateRequestId,
  validateReviewBorrowRequest,
  reviewRequest,
);

// 5b. POST /api/borrow-requests/:id/approve [Librarian, Admin]
router.post(
  "/:id/approve",
  staffOnly,
  validateRequestId,
  validateApproveBorrowRequest,
  approveRequest,
);

// 5c. POST /api/borrow-requests/:id/reject [Librarian, Admin]
router.post(
  "/:id/reject",
  staffOnly,
  validateRequestId,
  validateRejectBorrowRequest,
  rejectRequest,
);

// 5d. POST /api/borrow-requests/:id/confirm-handover (or /pickup) [Librarian, Admin]
router.post(
  "/:id/confirm-handover",
  staffOnly,
  validateRequestId,
  validatePickupHandover,
  confirmHandover,
);
router.post(
  "/:id/pickup",
  staffOnly,
  validateRequestId,
  validatePickupHandover,
  confirmHandover,
);

// 5e. POST /api/borrow-requests/:id/reject-handover [Librarian, Admin]
router.post(
  "/:id/reject-handover",
  staffOnly,
  validateRequestId,
  validateRejectPickup,
  rejectHandover,
);

export default router;
