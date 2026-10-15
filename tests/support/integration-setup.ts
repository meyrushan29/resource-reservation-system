import { afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;
const dbName = url ? new URL(url).pathname.replace(/^\//, "") : "";
if (!dbName.endsWith("_test")) {
  throw new Error(
    `Integration tests must run against a database whose name ends in "_test" (got "${dbName || "none"}"). ` +
      "Use `npm run test:integration`, which loads .env.test.",
  );
}

const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.$executeRawUnsafe("TRUNCATE TABLE reservations, resources RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await prisma.$disconnect();
});
