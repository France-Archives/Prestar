// Server/routes/notificationRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from "../controllers/notificationController.js";

const router = Router();

router.use(authMiddleware);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.post("/:id/read", markAsRead);
router.post("/read-all", markAllAsRead);

export default router;
