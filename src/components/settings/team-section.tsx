"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, User, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createTeamMemberAction } from "@/lib/actions/team-actions";
import { formatDateTime } from "@/lib/utils/format";
import type { ActionResult } from "@/lib/utils/result";
import type { CreatedTeamMember } from "@/lib/actions/team-actions";
import type { Profile } from "@/lib/data/profiles";

export function TeamSection({ members, currentUserId }: { members: Profile[]; currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<CreatedTeamMember> | null>(null);
  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setResult(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const outcome = await createTeamMemberAction(null, formData);
      if (outcome.ok) {
        toast.success(`Account created for ${outcome.data.email}.`);
        setOpen(false);
      } else {
        setResult(outcome);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        <CardDescription>Everyone here shares the same LAETO product catalog.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {member.full_name ?? member.email}
                  {member.id === currentUserId && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.full_name ? member.email : `Joined ${formatDateTime(member.created_at)}`}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="outline" className="self-start">
              <UserPlus className="h-4 w-4" /> Add team member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add team member</DialogTitle>
              <DialogDescription>
                Create a login for a colleague. They&apos;ll see and edit the same product catalog you do.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Field label="Email" htmlFor="team-email" error={fieldErrors?.email?.[0]}>
                <Input id="team-email" name="email" type="email" required invalid={Boolean(fieldErrors?.email)} />
              </Field>

              <Field label="Password" htmlFor="team-password" error={fieldErrors?.password?.[0]} hint="At least 8 characters.">
                <Input
                  id="team-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  invalid={Boolean(fieldErrors?.password)}
                />
              </Field>

              {result && !result.ok && result.message && !fieldErrors && (
                <div role="alert" className="rounded-md border border-status-failed bg-status-failed-bg px-3 py-2 text-sm text-status-failed">
                  {result.message}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create account
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
