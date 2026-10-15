/**
 * Demonstration data. Every seeded resource description starts with "[Demo]" and every
 * seeded requester email ends with "@demo.example", so demo records are easy to identify.
 *
 * Re-running the seed replaces previous demo data only; records you created yourself are kept.
 * Dates are relative to "today" in the app timezone so the dashboard always has current data;
 * the pattern itself is fixed (no randomness). Confirmed bookings never overlap — the database
 * exclusion constraint would reject the seed if they did.
 */
import { PrismaClient, type Prisma, type ResourceType } from "@prisma/client";
import { addLocalDays, todayLocal, zonedToUtc } from "../src/lib/utils/time";

const prisma = new PrismaClient();
const DEMO = "[Demo]";

const resources: { key: string; name: string; type: ResourceType; location: string | null; capacity: number | null; description: string; isActive?: boolean }[] = [
  { key: "roomA", name: "Meeting Room A", type: "MEETING_ROOM", location: "Level 2, East wing", capacity: 8, description: "Screen, whiteboard and video-conferencing camera." },
  { key: "roomB", name: "Conference Room B", type: "CONFERENCE_ROOM", location: "Level 3", capacity: 20, description: "Large table, dual projectors and room microphones." },
  { key: "training", name: "Training Room", type: "TRAINING_ROOM", location: "Ground floor", capacity: 30, description: "Classroom layout with 15 desks." },
  { key: "focus", name: "Focus Pod 1", type: "WORKSPACE", location: "Level 2, Quiet zone", capacity: 1, description: "Single-person booth for calls." },
  { key: "shared", name: "Shared Workspace", type: "WORKSPACE", location: "Level 1", capacity: 12, description: "Hot-desk area with standing desks." },
  { key: "projector", name: "Projector 01", type: "EQUIPMENT", location: "IT store", capacity: null, description: "Portable 1080p projector with HDMI and USB-C adapters." },
  { key: "laptop", name: "Laptop 01", type: "EQUIPMENT", location: "IT store", capacity: null, description: "Presentation laptop with office suite installed." },
  { key: "oldProjector", name: "Projector 02 (retired)", type: "EQUIPMENT", location: "IT store", capacity: null, description: "Out of service — kept for booking history.", isActive: false },
];

const people = [
  ["Nadeesha Perera", "nadeesha"],
  ["Kasun Fernando", "kasun"],
  ["Amaya Silva", "amaya"],
  ["Ruwan Jayasinghe", "ruwan"],
  ["Ishara Wickramasinghe", "ishara"],
  ["Dilan Rajapaksha", "dilan"],
] as const;

type Plan = { day: number; key: string; start: string; end: string; purpose: string; who: number; cancelled?: boolean };

// day = offset from today. Cancelled rows may overlap confirmed ones (they don't block).
const plans: Plan[] = [
  { day: -6, key: "roomA", start: "09:00", end: "10:00", purpose: "Weekly product sync", who: 0 },
  { day: -6, key: "training", start: "13:00", end: "17:00", purpose: "New starter induction", who: 2 },
  { day: -4, key: "roomB", start: "10:00", end: "12:00", purpose: "Quarterly business review", who: 1 },
  { day: -4, key: "projector", start: "10:00", end: "12:00", purpose: "QBR presentation", who: 1 },
  { day: -3, key: "oldProjector", start: "14:00", end: "15:00", purpose: "Vendor demo", who: 3 },
  { day: -2, key: "roomA", start: "15:00", end: "16:00", purpose: "Hiring panel", who: 4, cancelled: true },
  { day: -1, key: "focus", start: "11:00", end: "12:00", purpose: "Customer call", who: 5 },
  { day: 0, key: "roomA", start: "08:30", end: "09:30", purpose: "Daily stand-up", who: 0 },
  { day: 0, key: "roomA", start: "09:30", end: "11:00", purpose: "Sprint planning", who: 0 },
  { day: 0, key: "roomA", start: "14:00", end: "15:00", purpose: "Design review", who: 2 },
  { day: 0, key: "roomB", start: "10:00", end: "11:00", purpose: "Leadership meeting", who: 1, cancelled: true },
  { day: 0, key: "roomB", start: "13:00", end: "16:00", purpose: "Partner workshop", who: 3 },
  { day: 0, key: "shared", start: "09:00", end: "17:00", purpose: "Visiting team workspace", who: 5 },
  { day: 0, key: "laptop", start: "13:00", end: "16:00", purpose: "Partner workshop slides", who: 3 },
  { day: 1, key: "roomA", start: "09:00", end: "10:00", purpose: "Weekly product sync", who: 0 },
  { day: 1, key: "training", start: "09:00", end: "12:30", purpose: "Security awareness training", who: 4 },
  { day: 1, key: "projector", start: "09:00", end: "12:30", purpose: "Security training", who: 4 },
  { day: 2, key: "roomB", start: "11:00", end: "12:00", purpose: "Budget planning", who: 1 },
  { day: 2, key: "focus", start: "15:00", end: "15:45", purpose: "Interview", who: 2 },
  { day: 2, key: "focus", start: "15:45", end: "16:30", purpose: "Interview", who: 2 },
  { day: 3, key: "roomA", start: "10:00", end: "11:00", purpose: "Client onboarding", who: 5 },
  { day: 3, key: "roomA", start: "10:30", end: "11:30", purpose: "Retrospective", who: 0, cancelled: true },
  { day: 4, key: "training", start: "14:00", end: "16:00", purpose: "Excel workshop", who: 3 },
  { day: 6, key: "roomB", start: "09:30", end: "12:00", purpose: "All-hands rehearsal", who: 1 },
  { day: 8, key: "shared", start: "10:00", end: "15:00", purpose: "Hackathon prep", who: 4 },
];

async function main() {
  const today = todayLocal();

  // Remove previous demo data only (reservations first because of the foreign key).
  const oldDemo = await prisma.resource.findMany({ where: { description: { startsWith: DEMO } }, select: { id: true } });
  const oldIds = oldDemo.map((r) => r.id);
  await prisma.reservation.deleteMany({ where: { resourceId: { in: oldIds } } });
  await prisma.resource.deleteMany({ where: { id: { in: oldIds } } });

  const ids: Record<string, string> = {};
  for (const r of resources) {
    const created = await prisma.resource.create({
      data: {
        name: r.name,
        type: r.type,
        location: r.location,
        capacity: r.capacity,
        description: `${DEMO} ${r.description}`,
        isActive: r.isActive ?? true,
      },
    });
    ids[r.key] = created.id;
  }

  const rows: Prisma.ReservationCreateManyInput[] = plans.map((p) => {
    const date = addLocalDays(today, p.day);
    const startsAt = zonedToUtc(date, p.start);
    const [name, handle] = people[p.who];
    return {
      resourceId: ids[p.key],
      requesterName: name,
      requesterEmail: `${handle}@demo.example`,
      purpose: p.purpose,
      startsAt,
      endsAt: zonedToUtc(date, p.end),
      status: p.cancelled ? "CANCELLED" : "CONFIRMED",
      cancelledAt: p.cancelled ? new Date(startsAt.getTime() - 24 * 60 * 60 * 1000) : null,
    };
  });
  // Insert in chronological order so reference numbers read naturally.
  rows.sort((a, b) => (a.startsAt as Date).getTime() - (b.startsAt as Date).getTime());
  await prisma.reservation.createMany({ data: rows });

  console.log(`Seeded ${resources.length} demo resources and ${rows.length} demo reservations (today = ${today}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
