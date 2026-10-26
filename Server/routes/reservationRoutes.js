// Server/routes/reservationRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import {
  cancel,
  create,
  listMine,
  listQueue,
} from "../controllers/reservationController.js";

const router = Router();
const studentsOnly = requireRole(["Student"]);
const staffOnly = requireRole(["Admin", "Librarian"]);

router.use(authMiddleware);

// Student endpoints
router.post("/", studentsOnly, create);
router.get("/mine", studentsOnly, listMine);
router.post("/:id/cancel", studentsOnly, cancel);

// Staff endpoints
router.get("/", staffOnly, listQueue);

export default router;
