// Server/routes/staffDashboardRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { getBooksToRelease, getStaffDashboard } from "../controllers/staffDashboardController.js";

const router = Router();

// Librarians and Admins can view the staff circulation dashboard
router.get("/staff/dashboard", authMiddleware, requireRole(["Librarian", "Admin"]), getStaffDashboard);

// Librarians and Admins can view the queue of books awaiting release
router.get("/staff/books-to-release", authMiddleware, requireRole(["Librarian", "Admin"]), getBooksToRelease);

export default router;

