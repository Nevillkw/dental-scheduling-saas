"use client";

import { useFormState, useFormStatus } from "react-dom";

import { signIn, type StaffAuthState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Logowanie..." : "Zaloguj"}
    </Button>
  );
}

export function LoginForm({ slug }: { slug: string }) {
  const [state, formAction] = useFormState<StaffAuthState, FormData>(signIn, {
    error: null,
  });

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4 border-2 border-border p-6 shadow-brutal">
      <input type="hidden" name="slug" value={slug} />

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Panel personelu
        </p>
        <h1 className="text-2xl font-bold uppercase tracking-tight">Logowanie</h1>
      </div>

      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="password">Haslo</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      {state.error && (
        <p className="border-2 border-border bg-destructive px-3 py-2 text-xs font-bold uppercase text-destructive-foreground">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
