"use client";

import { useFormState, useFormStatus } from "react-dom";

import type { Dict } from "@/lib/i18n";
import { signIn, type StaffAuthState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton({ idle, pending }: { idle: string; pending: string }) {
  const { pending: isPending } = useFormStatus();
  return (
    <Button type="submit" disabled={isPending} className="w-full">
      {isPending ? pending : idle}
    </Button>
  );
}

export function LoginForm({ slug, dict }: { slug: string; dict: Dict["staff"] }) {
  const [state, formAction] = useFormState<StaffAuthState, FormData>(signIn, {
    error: null,
  });

  return (
    <form
      action={formAction}
      className="w-full max-w-sm space-y-4 border-2 border-border p-6 shadow-brutal"
    >
      <input type="hidden" name="slug" value={slug} />

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {dict.loginHeading}
        </p>
        <h1 className="text-2xl font-bold uppercase tracking-tight">{dict.loginTitle}</h1>
      </div>

      <div className="space-y-1">
        <Label htmlFor="email">{dict.email}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="password">{dict.password}</Label>
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

      <SubmitButton idle={dict.signIn} pending={dict.signingIn} />
    </form>
  );
}
