"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { channelName } from "@/lib/supabase/broadcast";
import type { DaySlots } from "@/lib/slots";
import { formatSlotLabel } from "@/lib/slots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBooking, type BookingState } from "./actions";

type DoctorLite = { id: string; name: string };

type Props = {
  slug: string;
  tenantId: string;
  doctors: DoctorLite[];
  days: DaySlots[];
  initialTaken: string[]; // klucze "doctorId|isoUtc"
};

type Selected = { doctorId: string; doctorName: string; startTime: string } | null;

function key(doctorId: string, iso: string): string {
  return `${doctorId}|${iso}`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Przekierowanie..." : "Zarezerwuj i zaplac"}
    </Button>
  );
}

export function BookingCalendar({ slug, tenantId, doctors, days, initialTaken }: Props) {
  const [taken, setTaken] = useState<Set<string>>(() => new Set(initialTaken));
  const [selected, setSelected] = useState<Selected>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [state, formAction] = useFormState<BookingState, FormData>(createBooking, {
    error: null,
  });

  // Realtime: subskrypcja Broadcast per lekarz. Anon klient, kanal publiczny.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channels = doctors.map((doc) => {
      const ch = supabase.channel(channelName(tenantId, doc.id));
      ch.on("broadcast", { event: "taken" }, (msg) => {
        const iso = (msg.payload as { start_time?: string } | undefined)?.start_time;
        if (!iso) return;
        const k = key(doc.id, new Date(iso).toISOString());
        setTaken((prev) => {
          const next = new Set(prev);
          next.add(k);
          return next;
        });
        setSelected((cur) =>
          cur && key(cur.doctorId, cur.startTime) === k ? null : cur
        );
      });
      ch.on("broadcast", { event: "freed" }, (msg) => {
        const iso = (msg.payload as { start_time?: string } | undefined)?.start_time;
        if (!iso) return;
        const k = key(doc.id, new Date(iso).toISOString());
        setTaken((prev) => {
          const next = new Set(prev);
          next.delete(k);
          return next;
        });
      });
      ch.subscribe();
      return ch;
    });

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [doctors, tenantId]);

  const selectedKey = selected ? key(selected.doctorId, selected.startTime) : null;
  const selectedTaken = selectedKey ? taken.has(selectedKey) : false;

  const totalAvailable = useMemo(() => {
    let n = 0;
    for (const doc of doctors)
      for (const day of days)
        for (const s of day.slots) if (!taken.has(key(doc.id, s.startTime))) n++;
    return n;
  }, [doctors, days, taken]);

  return (
    <div className="space-y-8 pb-40">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Wolne terminy:{" "}
        <span className="font-bold text-foreground">{totalAvailable}</span> · aktualizacja
        na zywo
      </p>

      {doctors.map((doc) => (
        <section key={doc.id} className="border-2 border-border">
          <h2 className="border-b-2 border-border bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wide text-primary-foreground">
            {doc.name}
          </h2>
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 md:grid-cols-5">
            {days.map((day) => (
              <div key={day.dateKey} className="bg-background p-2">
                <div className="mb-2 text-center text-xs font-bold uppercase tracking-wide">
                  {day.label}
                </div>
                <div className="flex flex-col gap-1">
                  {day.slots.map((slot) => {
                    const k = key(doc.id, slot.startTime);
                    const isTaken = taken.has(k);
                    const isSelected = selectedKey === k;
                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        disabled={isTaken}
                        onClick={() => {
                          setNotice(null);
                          setSelected({
                            doctorId: doc.id,
                            doctorName: doc.name,
                            startTime: slot.startTime,
                          });
                        }}
                        className={[
                          "border-2 border-border px-1 py-1 text-xs font-bold tabular-nums transition-none",
                          isTaken
                            ? "cursor-not-allowed bg-muted text-muted-foreground line-through"
                            : isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-background hover:bg-secondary",
                        ].join(" ")}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                  {day.slots.length === 0 && (
                    <span className="text-center text-[10px] text-muted-foreground">
                      —
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Panel rezerwacji — sticky na dole gdy slot wybrany */}
      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-border bg-background">
          <div className="mx-auto max-w-5xl p-4">
            {selectedTaken ? (
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-bold uppercase">
                  Ten slot zostal wlasnie zajety. Wybierz inny.
                </p>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Zamknij
                </Button>
              </div>
            ) : (
              <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="doctorId" value={selected.doctorId} />
                <input type="hidden" name="startTime" value={selected.startTime} />

                <div className="text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Wybrany termin
                  </p>
                  <p className="font-bold">
                    {selected.doctorName} · {formatSlotLabel(selected.startTime)}
                  </p>
                </div>

                <div className="flex-1">
                  <Label htmlFor="patientName">Imie i nazwisko</Label>
                  <Input
                    id="patientName"
                    name="patientName"
                    required
                    minLength={2}
                    autoComplete="name"
                    placeholder="Jan Kowalski"
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2 sm:w-64">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelected(null)}
                  >
                    Anuluj
                  </Button>
                  <SubmitButton />
                </div>
              </form>
            )}

            {state.error && !selectedTaken && (
              <p className="mt-2 border-2 border-border bg-destructive px-3 py-2 text-xs font-bold uppercase text-destructive-foreground">
                {state.error}
              </p>
            )}
            {notice && <p className="mt-2 text-xs font-bold uppercase">{notice}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
