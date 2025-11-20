import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { prisma } from "./prismaClient";
import { getDefaultSalonId, mapSalonSettings } from "./salonContext";
import { clientsRouter } from "./routes/clients";
import { collaboratorsRouter } from "./routes/collaborators";
import { categoriesRouter } from "./routes/categories";
import { servicesRouter } from "./routes/services";
import { productsRouter } from "./routes/products";
import { appointmentsRouter } from "./routes/appointments";
import { ordersRouter } from "./routes/orders";
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

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization"
  );

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use("/clients", clientsRouter);
app.use("/collaborators", collaboratorsRouter);
app.use("/categories", categoriesRouter);
app.use("/services", servicesRouter);
app.use("/products", productsRouter);
app.use("/appointments", appointmentsRouter);
app.use("/orders", ordersRouter);

app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "up" });
  } catch (error) {
    console.error("Health check failed", error);
    res.status(500).json({ status: "error", database: "down" });
  }
});

app.get("/salon", async (_req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();
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

app.patch("/salon", async (req: Request, res: Response) => {
  try {
    const { name, defaultCommissionRate, commissionMode } = req.body as {
      name?: string;
      defaultCommissionRate?: number;
      commissionMode?: string;
    };

    const salonId = await getDefaultSalonId();

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

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
