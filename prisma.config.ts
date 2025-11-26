import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prioriza DATABASE_URL do process.env (para scripts de migração)
// caso contrário usa do .env
// @ts-ignore - process está disponível em runtime
const databaseUrl = typeof process !== 'undefined' && process.env?.DATABASE_URL || env("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
