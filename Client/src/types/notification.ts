import type { ISODateTime, UUID } from "./api";
import type { NotificationType, RelatedEntityType } from "./enums";

// notifications -> NotificationItem
export interface NotificationItem {
  id: UUID;
  type: NotificationType;
  title: string; // titles are proposed (TC-20)
  message: string;
  relatedEntityType: RelatedEntityType | null;
  relatedEntityId: UUID | null;
  readAt: ISODateTime | null; // null = unread
  createdAt: ISODateTime;
}