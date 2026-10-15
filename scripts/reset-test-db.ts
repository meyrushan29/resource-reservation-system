/**
 * Prepares the isolated test database: applies migrations and empties all tables.
 *
 * Refuses to run unless DATABASE_URL points at a database whose name ends in "_test",
 * so it can never wipe the development database by accident.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

function assertTestDatabase(url: string | undefined): string {
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.test.example to .env.test.");
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) {
    throw new Error(`Refusing to reset database "${dbName}": test database names must end in "_test".`);
  }
  return dbName;
}

async function main() {
  const dbName = assertTestDatabase(process.env.DATABASE_URL);
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });

  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      "TRUNCATE TABLE reservations, resources RESTART IDENTITY CASCADE",
    );
  } finally {
    await prisma.$disconnect();
  }
  console.log(`Test database "${dbName}" migrated and emptied.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
