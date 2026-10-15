"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/errors";
import { cancelReservation, createReservation, updateReservation } from "@/lib/services/reservations";

function revalidateReservationViews(id: string, resourceId: string) {
  revalidatePath("/");
  revalidatePath("/reservations");
  revalidatePath(`/reservations/${id}`);
  revalidatePath("/calendar");
  revalidatePath(`/resources/${resourceId}`);
}

export async function createReservationAction(values: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const reservation = await createReservation(values);
    revalidateReservationViews(reservation.id, reservation.resourceId);
    return { id: reservation.id };
  });
}

export async function updateReservationAction(id: string, values: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const reservation = await updateReservation(id, values);
    revalidateReservationViews(reservation.id, reservation.resourceId);
    return { id: reservation.id };
  });
}

export async function cancelReservationAction(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const reservation = await cancelReservation(id);
    revalidateReservationViews(reservation.id, reservation.resourceId);
    return { id: reservation.id };
  });
}
