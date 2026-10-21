// Server/controllers/notificationController.js
import {
  getUnreadNotificationCount,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationService.js";

export async function getNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const { page, pageSize, unreadOnly } = req.query;
    const result = await listUserNotifications(userId, {
      page,
      pageSize,
      unreadOnly: unreadOnly === "true",
    });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getUnreadCount(req, res, next) {
  try {
    const userId = req.user.id;
    const count = await getUnreadNotificationCount(userId);
    return res.status(200).json({ unreadCount: count });
  } catch (error) {
    return next(error);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;
    const updated = await markNotificationRead(userId, notificationId);
    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    const result = await markAllNotificationsRead(userId);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}
