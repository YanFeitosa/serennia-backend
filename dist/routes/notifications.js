"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const auth_1 = require("../middleware/auth");
const notificationsRouter = (0, express_1.Router)();
exports.notificationsRouter = notificationsRouter;
function mapNotification(n) {
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
notificationsRouter.get("/", auth_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const notifications = await prismaClient_1.prisma.notification.findMany({
            where: {
                userId: req.user.userId,
                salonId: req.user.salonId,
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(notifications.map(mapNotification));
    }
    catch (error) {
        console.error("Error fetching notifications", error);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});
notificationsRouter.post("/:id/read", auth_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const notification = await prismaClient_1.prisma.notification.findFirst({
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
        const updated = await prismaClient_1.prisma.notification.update({
            where: { id: notification.id },
            data: { read: true },
        });
        res.json(mapNotification(updated));
    }
    catch (error) {
        console.error("Error marking notification as read", error);
        res.status(500).json({ error: "Failed to mark notification as read" });
    }
});
notificationsRouter.post("/read-all", auth_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        await prismaClient_1.prisma.notification.updateMany({
            where: {
                userId: req.user.userId,
                salonId: req.user.salonId,
                read: false,
            },
            data: { read: true },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error("Error marking all notifications as read", error);
        res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
});
