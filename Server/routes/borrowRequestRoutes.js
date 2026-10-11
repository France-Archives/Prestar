// Server/routes/borrowRequestRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import {
  createRequest,
  getAvailableCopies,
  listMyRequests,
  listRequestsQueue,
  reviewRequest,
} from "../controllers/borrowRequestController.js";
import {
  validateCreateBorrowRequest,
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

export default router;
