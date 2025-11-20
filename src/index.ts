import "dotenv/config";
import express from "express";
import { PrismaClient } from "./generated/prisma/client";

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "up" });
  } catch (error) {
    console.error("Health check failed", error);
    res.status(500).json({ status: "error", database: "down" });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
