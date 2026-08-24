import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma client singleton. In dev, Next.js hot-reloads modules on every
 * request, which would otherwise open a new connection pool each time —
 * stashing the instance on `globalThis` avoids that.
 *
 * PostgreSQL for both local development and production — see
 * prisma/schema.prisma's datasource comment. `DATABASE_URL` must always be
 * a real Postgres connection string (local dev points at its own database,
 * production at its own); there is no SQLite-file fallback any more.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — see .env.example.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
