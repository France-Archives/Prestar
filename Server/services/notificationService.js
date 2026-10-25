// Server/services/notificationService.js
import { Notification } from "../models/index.js";
import { Op } from "sequelize";

export function formatNotification(item) {
  const plain = typeof item.get === "function" ? item.get({ plain: true }) : item;
  return {
    id: String(plain.notification_id),
    type: plain.type,
    title: plain.title,
    message: plain.message,
    relatedEntityType: plain.related_entity_type || null,
    relatedEntityId: plain.related_entity_id ? String(plain.related_entity_id) : null,
    readAt: plain.read_at ? new Date(plain.read_at).toISOString() : null,
    createdAt: plain.created_at ? new Date(plain.created_at).toISOString() : new Date().toISOString(),
  };
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  relatedEntityType = null,
  relatedEntityId = null,
  transaction = null,
}) {
  if (!userId || !type || !message) {
    throw new Error("userId, type, and message are required for creating a notification.");
  }

  const notification = await Notification.create(
    {
      user_id: userId,
      type,
      title: title || type,
      message,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      read_at: null,
    },
    { transaction },
  );

  return formatNotification(notification);
}

export async function listUserNotifications(userId, { page = 1, pageSize = 20, unreadOnly = false } = {}) {
  const where = { user_id: userId };
  if (unreadOnly) {
    where.read_at = null;
  }

  const limit = Math.max(1, Math.min(100, Number(pageSize) || 20));
  const offset = Math.max(0, (Number(page) - 1) * limit);

  const { rows, count } = await Notification.findAndCountAll({
    where,
    order: [["created_at", "DESC"]],
    limit,
    offset,
  });

  return {
    items: rows.map(formatNotification),
    total: count,
    page: Number(page),
    pageSize: limit,
    totalPages: Math.ceil(count / limit),
  };
}

export async function getUnreadNotificationCount(userId) {
  return await Notification.count({
    where: {
      user_id: userId,
      read_at: null,
    },
  });
}

export async function markNotificationRead(userId, notificationId) {
  const notification = await Notification.findOne({
    where: {
      notification_id: notificationId,
      user_id: userId,
    },
  });

  if (!notification) {
    const error = new Error("Notification not found.");
    error.status = 404;
    throw error;
  }

  if (!notification.read_at) {
    notification.read_at = new Date();
    await notification.save();
  }

  return formatNotification(notification);
}

export async function markAllNotificationsRead(userId) {
  await Notification.update(
    { read_at: new Date() },
    {
      where: {
        user_id: userId,
        read_at: null,
      },
    },
  );
  return { message: "All notifications marked as read." };
}
