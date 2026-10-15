"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { FormField, fieldA11y } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createResourceAction, updateResourceAction } from "@/lib/actions/resources";
import {
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  resourceInputSchema,
  type ResourceFormValues,
  type ResourceInput,
} from "@/lib/validations/resource";

export interface ResourceFormDefaults {
  name: string;
  description: string;
  type: ResourceInput["type"] | "";
  location: string;
  capacity: string;
  isActive: boolean;
}

export function ResourceForm({ resourceId, defaults }: { resourceId?: string; defaults?: ResourceFormDefaults }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(resourceId);

  const form = useForm<ResourceFormValues, unknown, ResourceInput>({
    resolver: zodResolver(resourceInputSchema),
    defaultValues: (defaults ?? {
      name: "",
      description: "",
      type: "",
      location: "",
      capacity: "",
      isActive: true,
    }) as ResourceFormValues,
    mode: "onTouched",
  });
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = form;
  const busy = isPending || isSubmitting;

  const onSubmit = handleSubmit(async (values) => {
    const result = resourceId ? await updateResourceAction(resourceId, values) : await createResourceAction(values);
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        if (messages?.[0]) setError(field as keyof ResourceFormValues, { message: messages[0] });
      }
      toast.error(result.error.message);
      return;
    }
    toast.success(isEdit ? "Resource updated" : "Resource created");
    startTransition(() => router.push(`/resources/${result.data.id}`));
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5" aria-busy={busy}>
      <FormField id="name" label="Name" required error={errors.name?.message}>
        <Input {...fieldA11y("name", errors.name?.message)} {...register("name")} placeholder="e.g. Meeting Room A" autoComplete="off" />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="type" label="Type" required error={errors.type?.message}>
          <NativeSelect {...fieldA11y("type", errors.type?.message)} {...register("type")}>
            <option value="" disabled>
              Select a type
            </option>
            {RESOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {RESOURCE_TYPE_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField
          id="capacity"
          label="Capacity"
          hint="Number of people. Leave empty for equipment."
          error={errors.capacity?.message}
        >
          <Input
            {...fieldA11y("capacity", errors.capacity?.message, true)}
            {...register("capacity")}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="e.g. 8"
          />
        </FormField>
      </div>

      <FormField id="location" label="Location" error={errors.location?.message}>
        <Input {...fieldA11y("location", errors.location?.message)} {...register("location")} placeholder="e.g. Level 2, East wing" />
      </FormField>

      <FormField id="description" label="Description" error={errors.description?.message}>
        <Textarea
          {...fieldA11y("description", errors.description?.message)}
          {...register("description")}
          rows={3}
          placeholder="Equipment, accessibility notes, booking guidance…"
        />
      </FormField>

      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
            <div className="space-y-0.5">
              <label htmlFor="isActive" className="text-sm font-medium">
                Active
              </label>
              <p id="isActive-hint" className="text-xs text-muted-foreground">
                Inactive resources stay visible with their history but cannot receive new reservations.
              </p>
            </div>
            <Switch
              id="isActive"
              aria-describedby="isActive-hint"
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              onBlur={field.onBlur}
            />
          </div>
        )}
      />

      <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          {busy ? "Saving…" : isEdit ? "Save changes" : "Create resource"}
        </Button>
      </div>
    </form>
  );
}
