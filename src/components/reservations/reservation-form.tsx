"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CalendarCheck2, CheckCircle2, CircleSlash, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { FormField, fieldA11y } from "@/components/shared/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createReservationAction, updateReservationAction } from "@/lib/actions/reservations";
import { cn } from "@/lib/utils";
import { formatReference } from "@/lib/utils/format";
import { formatLocalDateLabel, formatTime, isValidDateString, isValidTimeString, zonedToUtc } from "@/lib/utils/time";
import {
  reservationInputSchema,
  type ReservationFormValues,
  type ReservationInput,
} from "@/lib/validations/reservation";

export interface ResourceOption {
  id: string;
  name: string;
  isActive: boolean;
  location?: string | null;
  capacity?: number | null;
}

interface BookingSummary {
  id: string;
  number: number;
  purpose: string;
  startsAt: string;
  endsAt: string;
}

interface AvailabilityResponse {
  available: boolean;
  reason?: "RESOURCE_INACTIVE" | "RESOURCE_NOT_FOUND" | "CONFLICT";
  conflicts: BookingSummary[];
  schedule: BookingSummary[];
}

type CheckState = { key: string; data?: AvailabilityResponse; error?: string };

export function ReservationForm({
  resources,
  defaults,
  reservationId,
  minDate,
}: {
  resources: ResourceOption[];
  defaults: ReservationFormValues;
  reservationId?: string;
  minDate?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<{ title: string; message: string } | null>(null);
  const [check, setCheck] = useState<CheckState | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const isEdit = Boolean(reservationId);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ReservationFormValues, unknown, ReservationInput>({
    resolver: zodResolver(reservationInputSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const busy = isSubmitting || isPending;

  const [resourceId, date, startTime, endTime] = useWatch({
    control,
    name: ["resourceId", "date", "startTime", "endTime"],
  });
  const selected = resources.find((r) => r.id === resourceId);

  // Build the availability query only when the inputs describe a valid interval.
  const query = (() => {
    if (!resourceId || !date || !startTime || !endTime) return null;
    if (!isValidDateString(date) || !isValidTimeString(startTime) || !isValidTimeString(endTime)) return null;
    if (endTime <= startTime) return null;
    const params = new URLSearchParams({
      resourceId,
      start: zonedToUtc(date, startTime).toISOString(),
      end: zonedToUtc(date, endTime).toISOString(),
    });
    if (reservationId) params.set("excludeId", reservationId);
    return params.toString();
  })();

  const checkKey = query ? `${query}#${refreshCount}` : null;

  useEffect(() => {
    if (!query || !checkKey) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/availability?${query}`, { signal: controller.signal, cache: "no-store" });
        const body = await response.json();
        if (!response.ok) setCheck({ key: checkKey, error: body?.error?.message ?? "Could not check availability." });
        else setCheck({ key: checkKey, data: body as AvailabilityResponse });
      } catch (error) {
        if ((error as Error).name !== "AbortError") setCheck({ key: checkKey, error: "Could not check availability." });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, checkKey]);

  const current = check && check.key === checkKey ? check : null;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = reservationId
      ? await updateReservationAction(reservationId, values)
      : await createReservationAction(values);
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        if (messages?.[0]) setError(field as keyof ReservationFormValues, { message: messages[0] });
      }
      const title =
        result.error.code === "CONFLICT"
          ? "Time slot unavailable"
          : result.error.code === "RESOURCE_INACTIVE"
            ? "Resource unavailable"
            : "Reservation not saved";
      setFormError({ title, message: result.error.message });
      toast.error(result.error.message);
      // Re-check availability so the panel reflects the latest bookings.
      setRefreshCount((n) => n + 1);
      return;
    }
    toast.success(isEdit ? "Reservation updated" : "Reservation confirmed");
    startTransition(() => router.push(`/reservations/${result.data.id}`));
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-5" aria-busy={busy}>
      <div className="grid content-start gap-5 lg:col-span-3">
        {formError && (
          <Alert variant="destructive" role="alert">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>{formError.title}</AlertTitle>
            <AlertDescription>{formError.message}</AlertDescription>
          </Alert>
        )}

        <FormField
          id="resourceId"
          label="Resource"
          required
          error={errors.resourceId?.message}
          hint="Only active resources can be booked."
        >
          <NativeSelect {...fieldA11y("resourceId", errors.resourceId?.message, true)} {...register("resourceId")}>
            <option value="" disabled>
              Select a resource
            </option>
            {resources.map((r) => (
              <option key={r.id} value={r.id} disabled={!r.isActive}>
                {r.name}
                {r.location ? ` — ${r.location}` : ""}
                {!r.isActive ? " (inactive)" : ""}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="requesterName" label="Requester name" required error={errors.requesterName?.message}>
            <Input
              {...fieldA11y("requesterName", errors.requesterName?.message)}
              {...register("requesterName")}
              autoComplete="name"
              placeholder="e.g. Nadeesha Perera"
            />
          </FormField>
          <FormField id="requesterEmail" label="Requester email" error={errors.requesterEmail?.message}>
            <Input
              {...fieldA11y("requesterEmail", errors.requesterEmail?.message)}
              {...register("requesterEmail")}
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
            />
          </FormField>
        </div>

        <FormField id="purpose" label="Purpose" required error={errors.purpose?.message}>
          <Textarea
            {...fieldA11y("purpose", errors.purpose?.message)}
            {...register("purpose")}
            rows={2}
            placeholder="e.g. Sprint planning with the platform team"
          />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-3">
          <FormField id="date" label="Date" required error={errors.date?.message}>
            <Input {...fieldA11y("date", errors.date?.message)} {...register("date")} type="date" min={minDate} />
          </FormField>
          <FormField id="startTime" label="Start time" required error={errors.startTime?.message}>
            <Input
              {...fieldA11y("startTime", errors.startTime?.message)}
              {...register("startTime")}
              type="time"
              step={300}
            />
          </FormField>
          <FormField id="endTime" label="End time" required error={errors.endTime?.message}>
            <Input {...fieldA11y("endTime", errors.endTime?.message)} {...register("endTime")} type="time" step={300} />
          </FormField>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Reservations start and end on the same day. Back-to-back bookings are allowed: a booking ending at 11:00 does
          not block one starting at 11:00.
        </p>

        <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={busy}>
            Back
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            {busy ? "Saving…" : isEdit ? "Save changes" : "Confirm reservation"}
          </Button>
        </div>
      </div>

      <aside aria-label="Availability" className="lg:col-span-2">
        <div className="rounded-xl border bg-muted/30 p-4 lg:sticky lg:top-20">
          <h2 className="text-sm font-semibold">Availability</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Informational only — availability is checked again when you submit.
          </p>
          <div aria-live="polite" data-testid="availability-status">
            {!query ? (
              <p className="text-sm text-muted-foreground">
                Choose a resource, date and a valid time range to check availability.
              </p>
            ) : !current ? (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking availability…
              </p>
            ) : current.error ? (
              <p className="text-sm text-destructive">{current.error}</p>
            ) : current.data?.available ? (
              <p className="flex items-start gap-2 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {selected?.name ?? "Resource"} is available {startTime}–{endTime}.
              </p>
            ) : current.data?.reason === "RESOURCE_INACTIVE" ? (
              <p className="flex items-start gap-2 text-sm font-medium text-zinc-700">
                <CircleSlash className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                This resource is inactive and cannot be booked.
              </p>
            ) : (
              <div className="text-sm text-amber-900">
                <p className="flex items-start gap-2 font-medium">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Conflicts with an existing booking
                </p>
                <ul className="mt-1 ml-6 list-disc">
                  {current.data?.conflicts.map((c) => (
                    <li key={c.id}>
                      {formatTime(new Date(c.startsAt))}–{formatTime(new Date(c.endsAt))} · {c.purpose}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {current?.data && date && isValidDateString(date) && (
            <div className="mt-4 border-t pt-3">
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Booked on {formatLocalDateLabel(date)}
              </h3>
              {current.data.schedule.length === 0 ? (
                <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarCheck2 className="size-4" aria-hidden="true" /> No other bookings that day.
                </p>
              ) : (
                <ul className="grid gap-1.5">
                  {current.data.schedule.map((b) => {
                    const clash = current.data?.conflicts.some((c) => c.id === b.id);
                    return (
                      <li
                        key={b.id}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm",
                          clash && "border-amber-300 bg-amber-50",
                        )}
                      >
                        <span className="tabular-nums">
                          {formatTime(new Date(b.startsAt))} – {formatTime(new Date(b.endsAt))}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {formatReference(b.number)}
                          {clash ? " · overlaps" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </aside>
    </form>
  );
}
