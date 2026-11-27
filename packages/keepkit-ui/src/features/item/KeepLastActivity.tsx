"use client";

import type { KeepItem } from "@keepkit/core/core";
import type { HTMLAttributes } from "react";
import { useKeepUiLabels, useUiLabel } from "../../foundation/ui-context";

export type KeepActivityKind = "opened" | "inactive";
export type KeepLastActivityProps<TMeta = Record<string, unknown>> = HTMLAttributes<HTMLSpanElement> & {
  item: KeepItem<TMeta>;
  kind?: KeepActivityKind;
};

export function KeepLastActivity<TMeta = Record<string, unknown>>({
  item,
  kind = "inactive",
  ...props
}: KeepLastActivityProps<TMeta>) {
  const { locale } = useKeepUiLabels();
  const openedLabel = useUiLabel("activityOpened");
  const neverOpenedLabel = useUiLabel("activityNeverOpened");
  const inactiveSuffix = useUiLabel("activityInactiveSuffix");
  if (item.lastOpenedAt === undefined) {
    return (
      <span {...props} data-keep-card-part="activity">
        {neverOpenedLabel}
      </span>
    );
  }
  const age = Math.max(0, Date.now() - item.lastOpenedAt);
  const label =
    kind === "opened"
      ? `${openedLabel} ${formatRelativeAge(age, locale)}`
      : `${formatInactiveAge(age, locale)}${isCjkLocale(locale) ? "" : " "}${inactiveSuffix}`;
  return (
    <span {...props} data-keep-card-part="activity">
      <time dateTime={new Date(item.lastOpenedAt).toISOString()}>{label}</time>
    </span>
  );
}

function formatRelativeAge(milliseconds: number, locale?: string): string {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const unit = milliseconds < 60 * 1000 ? "minute" : milliseconds < hour ? "hour" : "day";
  const value =
    unit === "minute"
      ? Math.floor(milliseconds / (60 * 1000))
      : unit === "hour"
        ? Math.floor(milliseconds / hour)
        : Math.floor(milliseconds / day);
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-value, unit);
}

function formatInactiveAge(milliseconds: number, locale?: string): string {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const unit = milliseconds < hour ? "minute" : milliseconds < day ? "hour" : "day";
  const value =
    unit === "minute"
      ? Math.max(1, Math.round(milliseconds / (60 * 1000)))
      : unit === "hour"
        ? Math.max(1, Math.round(milliseconds / hour))
        : Math.max(1, Math.round(milliseconds / day));
  const formatted = new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "long" }).format(value);
  return isCjkLocale(locale) ? formatted.replace(/\s+/g, "") : formatted;
}

function isCjkLocale(locale?: string): boolean {
  return /^(?:ja|ko|zh)/i.test(locale ?? "");
}
