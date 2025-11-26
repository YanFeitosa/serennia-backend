import "dotenv/config";
// Forced reload after migration v2
import express, { Request, Response, NextFunction } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { prisma } from "./prismaClient";
import { getDefaultSalonId, mapSalonSettings } from "./salonContext";
import { authRouter } from "./routes/auth";
import { registerRouter } from "./routes/register";
import { clientsRouter } from "./routes/clients";
import { collaboratorsRouter } from "./routes/collaborators";
import { categoriesRouter } from "./routes/categories";
import { servicesRouter } from "./routes/services";
import { productsRouter } from "./routes/products";
import { appointmentsRouter } from "./routes/appointments";
import { ordersRouter } from "./routes/orders";
import { notificationsRouter } from "./routes/notifications";
import { auditRouter } from "./routes/audit";
import { messagesRouter } from "./routes/messages";
import { totemRouter } from "./routes/totem";
import { expensesRouter } from "./routes/expenses";
import { authMiddleware, AuthRequest } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import { apiRateLimiter, createRateLimiter } from "./middleware/rateLimiter";
import {
  UserRole,
  CollaboratorStatus,
  AppointmentStatus,
  AppointmentOrigin,
  OrderStatus,
  OrderItemType,
  PaymentMethod,
  PaymentStatus,
  NotificationType,
  AuditAction,
  CategoryType,
} from "./types/enums";

const app = express();

const CORS_ORIGIN = process.env.FRONTEND_ORIGIN;
if (!CORS_ORIGIN) {
  console.warn("WARNING: FRONTEND_ORIGIN not set. CORS will be disabled.");
}

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  // CORS configuration
  const origin = req.headers.origin;

  // Allow requests from configured origin or any origin in development
  if (CORS_ORIGIN) {
    res.header("Access-Control-Allow-Origin", CORS_ORIGIN);
  } else if (process.env.NODE_ENV !== 'production' && origin) {
    // In development, allow any origin if FRONTEND_ORIGIN is not set
    res.header("Access-Control-Allow-Origin", origin);
    console.warn(`⚠️ CORS: Allowing origin ${origin} (development mode)`);
  }

  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization"
  );
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use("/auth", authRouter);
app.use("/register", registerRouter);
app.use("/clients", apiRateLimiter, authMiddleware, clientsRouter);
app.use("/collaborators", apiRateLimiter, authMiddleware, collaboratorsRouter);
app.use("/categories", apiRateLimiter, authMiddleware, categoriesRouter);
app.use("/services", apiRateLimiter, authMiddleware, servicesRouter);
app.use("/products", apiRateLimiter, authMiddleware, productsRouter);
app.use("/appointments", apiRateLimiter, authMiddleware, appointmentsRouter);
app.use("/orders", apiRateLimiter, authMiddleware, ordersRouter);
app.use("/notifications", apiRateLimiter, notificationsRouter);
app.use("/audit-logs", apiRateLimiter, auditRouter);
app.use("/messages", apiRateLimiter, authMiddleware, messagesRouter);
app.use("/totem", totemRouter);
app.use("/expenses", apiRateLimiter, authMiddleware, expensesRouter);

app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "up" });
  } catch (error) {
    console.error("Health check failed", error);
    res.status(500).json({ status: "error", database: "down" });
  }
});

app.get("/salon", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const salon = await prisma.salon.findUnique({ where: { id: salonId } });

    if (!salon) {
      res.status(404).json({ error: "Salon not found" });
      return;
    }

    res.json(mapSalonSettings(salon));
  } catch (error) {
    console.error("Error fetching salon settings", error);
    res.status(500).json({ error: "Failed to fetch salon settings" });
  }
});

app.patch("/salon", apiRateLimiter, authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      name,
      defaultCommissionRate,
      commissionMode,
      fixedCostsMonthly,
      variableCostRate,
      rolePermissions,
      theme,
    } = req.body as {
      name?: string;
      defaultCommissionRate?: number;
      commissionMode?: string;
      fixedCostsMonthly?: number;
      variableCostRate?: number;
      rolePermissions?: any;
      theme?: any;
    };

    const salonId = req.user.salonId;

    const data: any = {};
    if (name !== undefined) data.name = name;

    if (defaultCommissionRate !== undefined) {
      if (
        typeof defaultCommissionRate !== "number" ||
        !Number.isFinite(defaultCommissionRate) ||
        defaultCommissionRate < 0 ||
        defaultCommissionRate > 1
      ) {
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
      if (
        typeof fixedCostsMonthly !== "number" ||
        !Number.isFinite(fixedCostsMonthly) ||
        fixedCostsMonthly < 0
      ) {
        res.status(400).json({ error: "fixedCostsMonthly must be a non-negative number" });
        return;
      }
      data.fixedCostsMonthly = fixedCostsMonthly;
    }

    if (variableCostRate !== undefined) {
      if (
        typeof variableCostRate !== "number" ||
        !Number.isFinite(variableCostRate) ||
        variableCostRate < 0 ||
        variableCostRate > 1
      ) {
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

    const updated = await prisma.salon.update({
      where: { id: salonId },
      data,
    });

    res.json(mapSalonSettings(updated));
  } catch (error) {
    console.error("Error updating salon settings", error);
    res.status(500).json({ error: "Failed to update salon settings" });
  }
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

// Function to kill process on port (Windows)
async function killPort(port: number): Promise<boolean> {
  try {
    const execAsync = promisify(exec);

    // Try to find and kill the process on Windows
    const command = `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }`;

    await execAsync(`powershell -Command "${command}"`);
    // Wait a bit for the port to be released
    await new Promise(resolve => setTimeout(resolve, 1500));
    return true;
  } catch (error) {
    // Port might not be in use or process might not exist - that's okay
    return false;
  }
}

let serverInstance: any = null;
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

    serverInstance.on('error', async (error: NodeJS.ErrnoException) => {
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
        } else {
          console.error(`\n❌ Erro: Não foi possível liberar a porta ${PORT}!`);
          console.error(`\n💡 Soluções:`);
          console.error(`   1. Execute: npm run kill:port`);
          console.error(`   2. Ou execute: npm run dev:clean (mata a porta e inicia automaticamente)`);
          console.error(`   3. Ou encontre e encerre o processo manualmente usando:`);
          console.error(`      Get-NetTCPConnection -LocalPort ${PORT} | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force\n`);
          isStarting = false;
          process.exit(1);
        }
      } else {
        console.error('Erro ao iniciar servidor:', error);
        isStarting = false;
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    isStarting = false;
    process.exit(1);
  }
}

startServer();
