// Server/routes/adminRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  createAdminAccount,
  createLibrarianAccount,
} from "../controllers/adminController.js";

const router = Router();

// Only Admins can access these routes
router.use(authMiddleware, requireRole(["Admin"]));

// Librarian creation endpoints
router.post("/librarians", createLibrarianAccount);
router.post("/create-librarian", createLibrarianAccount);

// Admin creation endpoints
router.post("/admins", createAdminAccount);
router.post("/create-admin", createAdminAccount);

export default router;
