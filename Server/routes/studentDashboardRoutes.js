import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import { getStudentDashboard } from "../controllers/studentDashboardController.js";

const router = Router();

router.get("/me/dashboard", authMiddleware, requireRole(["Student"]), getStudentDashboard);
router.get("/student-dashboard", authMiddleware, requireRole(["Student"]), getStudentDashboard);

export default router;
