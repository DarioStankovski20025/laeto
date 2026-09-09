"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
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
import type { ReportSettings } from "@/lib/data/report-settings";

const initialState: ActionResult<ReportSettings> = { ok: false, code: "validation", message: "" };

export function SettingsForm({ settings }: { settings: ReportSettings }) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, initialState);
  const [dailyReportsEnabled, setDailyReportsEnabled] = useState(settings.daily_reports_enabled);
  const fieldErrors = !state.ok ? state.fieldErrors : undefined;
  const timezones = listTimezones();

  useEffect(() => {
    if (state.ok) toast.success("Settings saved.");
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report settings</CardTitle>
        <CardDescription>Shared for the whole team — configure where and when daily reports are sent.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="dailyReportsEnabled" value={String(dailyReportsEnabled)} />
          <Field label="Company name" htmlFor="companyName">
            <Input id="companyName" name="companyName" defaultValue={settings.company_name ?? ""} />
          </Field>

          <Field label="Report recipient email" htmlFor="reportEmail" error={fieldErrors?.reportEmail?.[0]}>
            <Input
              id="reportEmail"
              name="reportEmail"
              type="email"
              required
              defaultValue={settings.report_email ?? ""}
              invalid={Boolean(fieldErrors?.reportEmail)}
            />
          </Field>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Daily reports</p>
              <p className="text-xs text-muted-foreground">
                Whether the report service should treat the feed as in service. Reports go out whenever the
                report service requests the feed — this app has no schedule of its own.
              </p>
            </div>
            <Switch checked={dailyReportsEnabled} onCheckedChange={setDailyReportsEnabled} aria-label="Toggle daily reports" />
          </div>

          <Field label="Timezone" htmlFor="timezone" error={fieldErrors?.timezone?.[0]}>
            <NativeSelect id="timezone" name="timezone" defaultValue={settings.timezone} invalid={Boolean(fieldErrors?.timezone)}>
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </NativeSelect>
          </Field>

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
