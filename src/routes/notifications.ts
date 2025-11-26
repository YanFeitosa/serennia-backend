import { Router, Request, Response } from "express";
import { prisma } from "../prismaClient";
import { getDefaultSalonId } from "../salonContext";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const notificationsRouter = Router();

function mapNotification(n: any) {
  return {
    id: n.id,
    userId: n.userId,
    salonId: n.salonId ?? undefined,
    message: n.message,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
    link: n.link ?? undefined,
    type: n.type ?? undefined,
  };
}

notificationsRouter.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.userId,
        salonId: req.user.salonId,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(notifications.map(mapNotification));
  } catch (error) {
    console.error("Error fetching notifications", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

notificationsRouter.post("/:id/read", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.userId,
        salonId: req.user.salonId,
      },
    });

    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { read: true },
    });

    res.json(mapNotification(updated));
  } catch (error) {
    console.error("Error marking notification as read", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

notificationsRouter.post("/read-all", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    await prisma.notification.updateMany({
      where: {
        userId: req.user.userId,
        salonId: req.user.salonId,
        read: false,
      },
      data: { read: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking all notifications as read", error);
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

export { notificationsRouter };

