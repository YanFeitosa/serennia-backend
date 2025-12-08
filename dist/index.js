"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
// Forced reload after migration v2
const express_1 = __importDefault(require("express"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const prismaClient_1 = require("./prismaClient");
const salonContext_1 = require("./salonContext");
const auth_1 = require("./routes/auth");
const register_1 = require("./routes/register");
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
const expenses_1 = require("./routes/expenses");
const payments_1 = require("./routes/payments");
const commissions_1 = require("./routes/commissions");
const salons_1 = require("./routes/salons");
const auth_2 = require("./middleware/auth");
const errorHandler_1 = require("./middleware/errorHandler");
const rateLimiter_1 = require("./middleware/rateLimiter");
const app = (0, express_1.default)();
// Parse multiple CORS origins from environment variable (comma-separated)
const CORS_ORIGINS = process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(',').map(origin => origin.trim())
    : [];
if (CORS_ORIGINS.length === 0) {
    console.warn("WARNING: FRONTEND_ORIGIN not set. CORS will be disabled.");
}
else {
    console.log("✅ CORS enabled for origins:", CORS_ORIGINS);
}
app.use(express_1.default.json());
app.use((req, res, next) => {
    // CORS configuration
    const origin = req.headers.origin;
    // Check if request origin is in allowed origins
    if (origin && CORS_ORIGINS.includes(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
    }
    else if (process.env.NODE_ENV !== 'production' && origin) {
        // In development, allow any origin if not in production
        res.header("Access-Control-Allow-Origin", origin);
        console.warn(`⚠️ CORS: Allowing origin ${origin} (development mode)`);
    }
    res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,x-salon-id");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
    }
    next();
});
app.use("/auth", auth_1.authRouter);
app.use("/register", register_1.registerRouter);
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
app.use("/expenses", rateLimiter_1.apiRateLimiter, auth_2.authMiddleware, expenses_1.expensesRouter);
app.use("/payments", payments_1.paymentsRouter);
app.use("/commissions", rateLimiter_1.apiRateLimiter, auth_2.authMiddleware, commissions_1.commissionsRouter);
app.use("/salons", rateLimiter_1.apiRateLimiter, auth_2.authMiddleware, salons_1.salonsRouter);
// Health check - public endpoint accessible from any origin (for load balancers, monitoring, etc.)
app.get("/health", async (_req, res) => {
    // Allow any origin for health checks
    res.header("Access-Control-Allow-Origin", "*");
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
        if (!salonId) {
            res.status(400).json({ error: 'Salon context required' });
            return;
        }
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
app.patch("/salon", rateLimiter_1.apiRateLimiter, auth_2.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { name, defaultCommissionRate, commissionMode, fixedCostsMonthly, variableCostRate, rolePermissions, theme, 
        // WhatsApp Integration
        whatsappApiUrl, whatsappApiKey, whatsappInstanceId, whatsappPhone, whatsappConnected, 
        // Payment Integration
        paymentProvider, mpAccessToken, mpPublicKey, stripeSecretKey, stripePublishableKey, } = req.body;
        const salonId = req.user.salonId;
        if (!salonId) {
            res.status(400).json({ error: 'Salon context required' });
            return;
        }
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
        if (theme !== undefined) {
            if (theme !== null && typeof theme !== "object") {
                res.status(400).json({ error: "theme must be an object or null" });
                return;
            }
            data.theme = theme;
        }
        // WhatsApp Integration fields
        if (whatsappApiUrl !== undefined)
            data.whatsappApiUrl = whatsappApiUrl;
        if (whatsappApiKey !== undefined)
            data.whatsappApiKey = whatsappApiKey;
        if (whatsappInstanceId !== undefined)
            data.whatsappInstanceId = whatsappInstanceId;
        if (whatsappPhone !== undefined)
            data.whatsappPhone = whatsappPhone;
        if (whatsappConnected !== undefined)
            data.whatsappConnected = whatsappConnected;
        // Payment Integration fields
        if (paymentProvider !== undefined) {
            if (paymentProvider !== null && paymentProvider !== 'mercadopago' && paymentProvider !== 'stripe') {
                res.status(400).json({ error: "paymentProvider must be 'mercadopago', 'stripe', or null" });
                return;
            }
            data.paymentProvider = paymentProvider;
        }
        if (mpAccessToken !== undefined)
            data.mpAccessToken = mpAccessToken;
        if (mpPublicKey !== undefined)
            data.mpPublicKey = mpPublicKey;
        if (stripeSecretKey !== undefined)
            data.stripeSecretKey = stripeSecretKey;
        if (stripePublishableKey !== undefined)
            data.stripePublishableKey = stripePublishableKey;
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
// Test WhatsApp Connection
app.post("/salon/test-whatsapp", rateLimiter_1.apiRateLimiter, auth_2.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        if (!salonId) {
            res.status(400).json({ success: false, error: 'Salon context required' });
            return;
        }
        const salon = await prismaClient_1.prisma.salon.findUnique({
            where: { id: salonId },
            select: {
                whatsappApiUrl: true,
                whatsappApiKey: true,
                whatsappInstanceId: true,
            },
        });
        if (!salon) {
            res.status(404).json({ success: false, error: 'Salão não encontrado' });
            return;
        }
        if (!salon.whatsappApiUrl || !salon.whatsappApiKey || !salon.whatsappInstanceId) {
            res.status(400).json({ success: false, error: 'Configurações do WhatsApp incompletas' });
            return;
        }
        // Test connection to Evolution API
        try {
            const response = await fetch(`${salon.whatsappApiUrl}/instance/connectionState/${salon.whatsappInstanceId}`, {
                method: 'GET',
                headers: {
                    'apikey': salon.whatsappApiKey,
                },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                res.json({ success: false, error: errorData.message || 'Falha ao conectar com a API' });
                return;
            }
            const data = await response.json();
            const isConnected = data.state === 'open' || data.instance?.state === 'open';
            // Update connection status
            await prismaClient_1.prisma.salon.update({
                where: { id: salonId },
                data: { whatsappConnected: isConnected },
            });
            res.json({ success: isConnected, error: isConnected ? undefined : 'WhatsApp não está conectado' });
        }
        catch (fetchError) {
            console.error('Error testing WhatsApp connection:', fetchError);
            res.json({ success: false, error: 'Não foi possível conectar à API do WhatsApp' });
        }
    }
    catch (error) {
        console.error("Error testing WhatsApp connection", error);
        res.status(500).json({ success: false, error: "Erro ao testar conexão" });
    }
});
// Test Payment Connection
app.post("/salon/test-payment", rateLimiter_1.apiRateLimiter, auth_2.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        if (!salonId) {
            res.status(400).json({ success: false, error: 'Salon context required' });
            return;
        }
        const salon = await prismaClient_1.prisma.salon.findUnique({
            where: { id: salonId },
            select: {
                paymentProvider: true,
                mpAccessToken: true,
                stripeSecretKey: true,
            },
        });
        if (!salon) {
            res.status(404).json({ success: false, error: 'Salão não encontrado' });
            return;
        }
        if (!salon.paymentProvider) {
            res.status(400).json({ success: false, error: 'Nenhum provedor de pagamento configurado' });
            return;
        }
        if (salon.paymentProvider === 'mercadopago') {
            if (!salon.mpAccessToken) {
                res.json({ success: false, error: 'Access Token do Mercado Pago não configurado' });
                return;
            }
            // Test Mercado Pago connection
            try {
                const response = await fetch('https://api.mercadopago.com/users/me', {
                    headers: {
                        'Authorization': `Bearer ${salon.mpAccessToken}`,
                    },
                });
                if (!response.ok) {
                    res.json({ success: false, error: 'Access Token inválido' });
                    return;
                }
                res.json({ success: true });
            }
            catch (fetchError) {
                res.json({ success: false, error: 'Não foi possível conectar ao Mercado Pago' });
            }
        }
        else if (salon.paymentProvider === 'stripe') {
            if (!salon.stripeSecretKey) {
                res.json({ success: false, error: 'Secret Key do Stripe não configurada' });
                return;
            }
            // Test Stripe connection
            try {
                const response = await fetch('https://api.stripe.com/v1/balance', {
                    headers: {
                        'Authorization': `Bearer ${salon.stripeSecretKey}`,
                    },
                });
                if (!response.ok) {
                    res.json({ success: false, error: 'Secret Key inválida' });
                    return;
                }
                res.json({ success: true });
            }
            catch (fetchError) {
                res.json({ success: false, error: 'Não foi possível conectar ao Stripe' });
            }
        }
        else {
            res.json({ success: false, error: 'Provedor de pagamento não suportado' });
        }
    }
    catch (error) {
        console.error("Error testing payment connection", error);
        res.status(500).json({ success: false, error: "Erro ao testar conexão" });
    }
});
// Error handling middleware (must be last)
app.use(errorHandler_1.errorHandler);
const PORT = parseInt(process.env.PORT || '4000', 10);
// Function to kill process on port (Windows)
async function killPort(port) {
    try {
        const execAsync = (0, util_1.promisify)(child_process_1.exec);
        // Try to find and kill the process on Windows
        const command = `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }`;
        await execAsync(`powershell -Command "${command}"`);
        // Wait a bit for the port to be released
        await new Promise(resolve => setTimeout(resolve, 1500));
        return true;
    }
    catch (error) {
        // Port might not be in use or process might not exist - that's okay
        return false;
    }
}
let serverInstance = null;
let isStarting = false;
async function startServer() {
    if (isStarting) {
        console.log('⏳ Servidor já está sendo iniciado, aguardando...');
        return;
    }
    isStarting = true;
    try {
        // Try to kill port first if it's in use
        const killed = await killPort(PORT);
        if (killed) {
            console.log(`✅ Porta ${PORT} foi liberada`);
        }
        serverInstance = app.listen(PORT, () => {
            console.log(`✅ Backend running on http://localhost:${PORT}`);
            isStarting = false;
        });
        serverInstance.on('error', async (error) => {
            if (error.code === 'EADDRINUSE') {
                console.log(`\n⚠️  Porta ${PORT} já está em uso. Tentando liberar a porta...`);
                const killed = await killPort(PORT);
                if (killed) {
                    console.log(`✅ Porta ${PORT} liberada. Reiniciando servidor...`);
                    isStarting = false;
                    // Retry after a short delay
                    setTimeout(() => {
                        startServer();
                    }, 1500);
                }
                else {
                    console.error(`\n❌ Erro: Não foi possível liberar a porta ${PORT}!`);
                    console.error(`\n💡 Soluções:`);
                    console.error(`   1. Execute: npm run kill:port`);
                    console.error(`   2. Ou execute: npm run dev:clean (mata a porta e inicia automaticamente)`);
                    console.error(`   3. Ou encontre e encerre o processo manualmente usando:`);
                    console.error(`      Get-NetTCPConnection -LocalPort ${PORT} | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force\n`);
                    isStarting = false;
                    process.exit(1);
                }
            }
            else {
                console.error('Erro ao iniciar servidor:', error);
                isStarting = false;
                process.exit(1);
            }
        });
    }
    catch (error) {
        console.error('Erro ao iniciar servidor:', error);
        isStarting = false;
        process.exit(1);
    }
}
startServer();
