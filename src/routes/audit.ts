import { Router, Request, Response } from "express";
import { prisma } from "../prismaClient";
import { getDefaultSalonId } from "../salonContext";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { isAdminLike } from "../middleware/supabaseAuth";

const auditRouter = Router();

function mapAuditLog(log: any) {
  return {
    id: log.id,
    salonId: log.salonId,
    userId: log.userId,
    action: log.action,
    tableName: log.tableName,
    recordId: log.recordId,
    timestamp: log.timestamp.toISOString(),
    oldValue: log.oldValue ?? undefined,
    newValue: log.newValue ?? undefined,
    ipAddress: log.ipAddress ?? undefined,
    userAgent: log.userAgent ?? undefined,
  };
}

auditRouter.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Only tenant_admin, super_admin (admin-like) or manager can access audit logs
    const canAccess = isAdminLike(req.user) || req.user?.tenantRole === 'manager';
    if (!canAccess) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const salonId = req.user.salonId;
    const { dateFrom, dateTo, userId, tableName } = req.query as {
      dateFrom?: string;
      dateTo?: string;
      userId?: string;
      tableName?: string;
    };

    const where: any = { salonId };

    if (userId) {
      where.userId = userId;
    }

    if (tableName) {
      where.tableName = tableName;
    }

    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (!isNaN(from.getTime())) {
          where.timestamp.gte = from;
        }
      }
      if (dateTo) {
        const to = new Date(dateTo);
        if (!isNaN(to.getTime())) {
          // Include the entire day
          to.setHours(23, 59, 59, 999);
          where.timestamp.lte = to;
        }
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 1000, // Limit to prevent huge responses
    });

    res.json(logs.map(mapAuditLog));
  } catch (error) {
    console.error("Error fetching audit logs", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

export { auditRouter };

