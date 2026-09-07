"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { updateSettingsAction } from "@/lib/actions/settings-actions";
import { listTimezones } from "@/lib/utils/timezones";
import type { ActionResult } from "@/lib/utils/result";
import type { Profile } from "@/lib/data/profiles";

const initialState: ActionResult<Profile> = { ok: false, code: "validation", message: "" };
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CRON_HONORS_HOUR = process.env.NEXT_PUBLIC_CRON_MODE !== "daily";

export function SettingsForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, initialState);
  const [dailyReportsEnabled, setDailyReportsEnabled] = useState(profile.daily_reports_enabled);
  const fieldErrors = !state.ok ? state.fieldErrors : undefined;
  const timezones = listTimezones();
  const preferredHour = Number(profile.preferred_report_time.split(":")[0] ?? 8);

  useEffect(() => {
    if (state.ok) toast.success("Settings saved.");
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report settings</CardTitle>
        <CardDescription>Configure where and when daily reports are sent.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="dailyReportsEnabled" value={String(dailyReportsEnabled)} />
          <Field label="Company name" htmlFor="companyName">
            <Input id="companyName" name="companyName" defaultValue={profile.company_name ?? ""} />
          </Field>

          <Field label="Report recipient email" htmlFor="reportEmail" error={fieldErrors?.reportEmail?.[0]}>
            <Input
              id="reportEmail"
              name="reportEmail"
              type="email"
              required
              defaultValue={profile.report_email ?? ""}
              invalid={Boolean(fieldErrors?.reportEmail)}
            />
          </Field>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Daily reports</p>
              <p className="text-xs text-muted-foreground">Automatically check all monitored products every day.</p>
            </div>
            <Switch checked={dailyReportsEnabled} onCheckedChange={setDailyReportsEnabled} aria-label="Toggle daily reports" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Preferred report hour"
              htmlFor="preferredReportHour"
              hint={CRON_HONORS_HOUR ? "Your local time." : "Reports currently run once daily at a fixed time; this preference is not yet honored."}
            >
              <NativeSelect id="preferredReportHour" name="preferredReportHour" defaultValue={preferredHour} disabled={!CRON_HONORS_HOUR}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Timezone" htmlFor="timezone" error={fieldErrors?.timezone?.[0]}>
              <NativeSelect id="timezone" name="timezone" defaultValue={profile.timezone} invalid={Boolean(fieldErrors?.timezone)}>
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          {!state.ok && state.message && !fieldErrors && (
            <div role="alert" className="rounded-md border border-status-failed bg-status-failed-bg px-3 py-2 text-sm text-status-failed">
              {state.message}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save settings
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
