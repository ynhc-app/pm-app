/* eslint-disable @typescript-eslint/no-require-imports */
import { PrismaClient } from "@/generated/prisma/client";
import path from "path";

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";

  if (dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://")) {
    // Use standard Prisma engine with pg adapter for PostgreSQL
    const pool = new Pool({ connectionString: dbUrl });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  } else {
    // SQLite adapter with better-sqlite3
    // PrismaBetterSqlite3 constructor takes { url: string, ...options }
    const { PrismaBetterSqlite3 } = eval("require")(
      "@prisma/adapter-better-sqlite3"
    );

    // Resolve absolute path to the database file
    // DATABASE_URL format: "file:./dev.db" or "file:dev.db" or "file:/abs/path/dev.db"
    const rawPath = dbUrl.replace(/^file:/, "");

    let absolutePath: string;
    if (path.isAbsolute(rawPath)) {
      absolutePath = rawPath;
    } else {
      // Relative paths resolve from the project root (process.cwd())
      // e.g., "file:./dev.db" -> "<projectRoot>/dev.db"
      absolutePath = path.resolve(process.cwd(), rawPath);
    }

    const adapter = new PrismaBetterSqlite3({ url: absolutePath });
    return new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
