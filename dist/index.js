"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const prismaClient_1 = require("./prismaClient");
const salonContext_1 = require("./salonContext");
const auth_1 = require("./routes/auth");
const clients_1 = require("./routes/clients");
const collaborators_1 = require("./routes/collaborators");
const categories_1 = require("./routes/categories");
const services_1 = require("./routes/services");
const products_1 = require("./routes/products");
const appointments_1 = require("./routes/appointments");
const orders_1 = require("./routes/orders");
const notifications_1 = require("./routes/notifications");
const audit_1 = require("./routes/audit");
const messages_1 = require("./routes/messages");
const totem_1 = require("./routes/totem");
const auth_2 = require("./middleware/auth");
const errorHandler_1 = require("./middleware/errorHandler");
const rateLimiter_1 = require("./middleware/rateLimiter");
const app = (0, express_1.default)();
const CORS_ORIGIN = process.env.FRONTEND_ORIGIN;
if (!CORS_ORIGIN) {
    console.warn("WARNING: FRONTEND_ORIGIN not set. CORS will be disabled.");
}
app.use(express_1.default.json());
app.use((req, res, next) => {
    if (CORS_ORIGIN) {
        res.header("Access-Control-Allow-Origin", CORS_ORIGIN);
        res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
        res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
    }
    next();
});
app.use("/auth", auth_1.authRouter);
app.use("/clients", rateLimiter_1.apiRateLimiter, auth_2.authMiddleware, clients_1.clientsRouter);
app.use("/collaborators", rateLimiter_1.apiRateLimiter, auth_2.authMiddleware, collaborators_1.collaboratorsRouter);
app.use("/categories", rateLimiter_1.apiRateLimiter, auth_2.authMiddleware, categories_1.categoriesRouter);
app.use("/services", rateLimiter_1.apiRateLimiter, auth_2.authMiddleware, services_1.servicesRouter);
app.use("/products", rateLimiter_1.apiRateLimiter, auth_2.authMiddleware, products_1.productsRouter);
app.use("/appointments", rateLimiter_1.apiRateLimiter, auth_2.authMiddleware, appointments_1.appointmentsRouter);
app.use("/orders", rateLimiter_1.apiRateLimiter, auth_2.authMiddleware, orders_1.ordersRouter);
app.use("/notifications", rateLimiter_1.apiRateLimiter, notifications_1.notificationsRouter);
app.use("/audit-logs", rateLimiter_1.apiRateLimiter, audit_1.auditRouter);
app.use("/messages", rateLimiter_1.apiRateLimiter, auth_2.authMiddleware, messages_1.messagesRouter);
app.use("/totem", totem_1.totemRouter);
app.get("/health", async (_req, res) => {
    try {
        await prismaClient_1.prisma.$queryRaw `SELECT 1`;
        res.json({ status: "ok", database: "up" });
    }
    catch (error) {
        console.error("Health check failed", error);
        res.status(500).json({ status: "error", database: "down" });
    }
});
app.get("/salon", auth_2.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const salon = await prismaClient_1.prisma.salon.findUnique({ where: { id: salonId } });
        if (!salon) {
            res.status(404).json({ error: "Salon not found" });
            return;
        }
        res.json((0, salonContext_1.mapSalonSettings)(salon));
    }
    catch (error) {
        console.error("Error fetching salon settings", error);
        res.status(500).json({ error: "Failed to fetch salon settings" });
    }
});
app.patch("/salon", auth_2.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { name, defaultCommissionRate, commissionMode, fixedCostsMonthly, variableCostRate, rolePermissions, } = req.body;
        const salonId = req.user.salonId;
        const data = {};
        if (name !== undefined)
            data.name = name;
        if (defaultCommissionRate !== undefined) {
            if (typeof defaultCommissionRate !== "number" ||
                !Number.isFinite(defaultCommissionRate) ||
                defaultCommissionRate < 0 ||
                defaultCommissionRate > 1) {
                res.status(400).json({ error: "defaultCommissionRate must be between 0 and 1" });
                return;
            }
            data.defaultCommissionRate = defaultCommissionRate;
        }
        if (commissionMode !== undefined) {
            if (commissionMode !== "service" && commissionMode !== "professional") {
                res
                    .status(400)
                    .json({ error: "commissionMode must be 'service' or 'professional'" });
                return;
            }
            data.commissionMode = commissionMode;
        }
        if (fixedCostsMonthly !== undefined) {
            if (typeof fixedCostsMonthly !== "number" ||
                !Number.isFinite(fixedCostsMonthly) ||
                fixedCostsMonthly < 0) {
                res.status(400).json({ error: "fixedCostsMonthly must be a non-negative number" });
                return;
            }
            data.fixedCostsMonthly = fixedCostsMonthly;
        }
        if (variableCostRate !== undefined) {
            if (typeof variableCostRate !== "number" ||
                !Number.isFinite(variableCostRate) ||
                variableCostRate < 0 ||
                variableCostRate > 1) {
                res.status(400).json({ error: "variableCostRate must be between 0 and 1" });
                return;
            }
            data.variableCostRate = variableCostRate;
        }
        if (rolePermissions !== undefined) {
            if (rolePermissions !== null && typeof rolePermissions !== "object") {
                res.status(400).json({ error: "rolePermissions must be an object or null" });
                return;
            }
            data.rolePermissions = rolePermissions;
        }
        const updated = await prismaClient_1.prisma.salon.update({
            where: { id: salonId },
            data,
        });
        res.json((0, salonContext_1.mapSalonSettings)(updated));
    }
    catch (error) {
        console.error("Error updating salon settings", error);
        res.status(500).json({ error: "Failed to update salon settings" });
    }
});
// Error handling middleware (must be last)
app.use(errorHandler_1.errorHandler);
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
