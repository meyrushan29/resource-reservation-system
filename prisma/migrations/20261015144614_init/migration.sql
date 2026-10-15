-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('MEETING_ROOM', 'CONFERENCE_ROOM', 'TRAINING_ROOM', 'WORKSPACE', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "type" "ResourceType" NOT NULL,
    "location" VARCHAR(100),
    "capacity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "resource_id" UUID NOT NULL,
    "requester_name" VARCHAR(100) NOT NULL,
    "requester_email" VARCHAR(254),
    "purpose" VARCHAR(200) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resources_name_key" ON "resources"("name");

-- CreateIndex
CREATE INDEX "resources_type_idx" ON "resources"("type");

-- CreateIndex
CREATE INDEX "resources_is_active_idx" ON "resources"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_number_key" ON "reservations"("number");

-- CreateIndex
CREATE INDEX "reservations_resource_id_starts_at_idx" ON "reservations"("resource_id", "starts_at");

-- CreateIndex
CREATE INDEX "reservations_starts_at_idx" ON "reservations"("starts_at");

-- CreateIndex
CREATE INDEX "reservations_status_starts_at_idx" ON "reservations"("status", "starts_at");

-- CreateIndex
CREATE INDEX "reservations_updated_at_idx" ON "reservations"("updated_at");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data integrity rules Prisma cannot express in schema.prisma
ALTER TABLE "resources"
  ADD CONSTRAINT "resources_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0);

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_valid_range" CHECK ("ends_at" > "starts_at");
