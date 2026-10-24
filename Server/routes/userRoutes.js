// Server/routes/userRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { getUsers } from "../controllers/userController.js";

const router = Router();

// Staff (Admin, Librarian) can get all users sorted by role and status
router.get("/", authMiddleware, requireRole(["Admin", "Librarian"]), getUsers);

export default router;
