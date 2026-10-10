// Server/routes/borrowRequestRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import {
  cancelRequest,
  confirmPickup,
  createRequest,
  listMyRequests,
  listRequests,
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

router.post("/", studentsOnly, validateCreateBorrowRequest, createRequest);
router.get("/mine", studentsOnly, validateRequestListQuery, listMyRequests);
router.get("/", staffOnly, validateRequestListQuery, listRequests);
router.post("/:id/review", staffOnly, validateRequestId, validateReviewBorrowRequest, reviewRequest);
router.post("/:id/confirm-pickup", staffOnly, validateRequestId, confirmPickup);
router.post("/:id/cancel", studentsOnly, validateRequestId, cancelRequest);

export default router;
