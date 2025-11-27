export type UserRole = "manager" | "receptionist" | "professional";
export type CollaboratorStatus = "active" | "inactive";
export type AppointmentStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "canceled"
  | "no_show"
  | "not_paid";
export type AppointmentOrigin = "whatsapp" | "app" | "totem" | "reception";
export type OrderStatus = "open" | "closed" | "paid";
export type OrderItemType = "service" | "product";
export type PaymentMethod = "cash" | "card" | "pix" | "online";
export type PaymentStatus = "pending" | "confirmed" | "failed";
export type NotificationType = "info" | "warning" | "error";
export type AuditAction = "INSERT" | "UPDATE" | "DELETE";
export type CategoryType = "service" | "product";
export type MessageChannel = "whatsapp" | "sms" | "email";
export type MessageStatus = "pending" | "sent" | "failed";
export type ExpenseType = "FIXED" | "VARIABLE";
