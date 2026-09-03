"use client";

import type { KeepItem } from "@keepkit/core/core";
import { type UseKeepNavigatorResult, useKeepNavigator } from "@keepkit/core/react";
import { type HTMLAttributes, type ReactNode, useId } from "react";
import { getMetaTitle, renderRoot } from "../../foundation/shared";
import { useKeepUiLabels, useUiLabel } from "../../foundation/ui-context";
import { type KeepTourShortcutsOptions, useKeepTourShortcuts } from "./hooks/useKeepTourShortcuts";
import { KeepShortcutHint } from "./KeepShortcutHint";

export type KeepTourBarProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  navigation?: UseKeepNavigatorResult<TMeta>;
  currentId?: string;
  initialIndex?: number;
  showProgress?: boolean;
  prevHref?: string;
  nextHref?: string;
  backHref?: string;
  onPrev?: () => void | Promise<void>;
  onNext?: () => void | Promise<void>;
  onBack?: () => void | Promise<void>;
  prevLabel?: string;
  nextLabel?: string;
  backLabel?: string;
  keyboardShortcuts?: boolean;
  showShortcutHint?: boolean;
  shortcutOptions?: Omit<KeepTourShortcutsOptions, "onNext" | "onPrev">;
  progress?: ReactNode;
  getItemTitle?: (item: KeepItem<TMeta>) => ReactNode;
  children?: ReactNode;
  asChild?: boolean;
};

/** Headless previous/current/next navigation with optional URL links and keyboard shortcuts. */
export function KeepTourBar<TMeta = Record<string, unknown>>({
  navigation: providedNavigation,
  currentId,
  initialIndex,
  showProgress = true,
  prevHref,
  nextHref,
  backHref,
  onPrev,
  onNext,
  onBack,
  prevLabel,
  nextLabel,
  backLabel,
  keyboardShortcuts = false,
  showShortcutHint = false,
  shortcutOptions,
  progress,
  getItemTitle = (item) => getMetaTitle(item.meta) ?? item.id,
  children,
  asChild = false,
  ...props
}: KeepTourBarProps<TMeta>) {
  const ownNavigation = useKeepNavigator<TMeta>({ currentId, initialIndex });
  const navigation = providedNavigation ?? ownNavigation;
  const previousLabel = useUiLabel("previousPage", prevLabel);
  const nextItemLabel = useUiLabel("nextPage", nextLabel);
  const listLabel = useUiLabel("allItems", backLabel);
  const { labels } = useKeepUiLabels();
  const resolvedPrev = onPrev ?? (() => navigateTo(navigation.goToPrev(), prevHref));
  const resolvedNext = onNext ?? (() => navigateTo(navigation.goToNext(), nextHref));
  useKeepTourShortcuts({
    ...shortcutOptions,
    enabled: keyboardShortcuts && (shortcutOptions?.enabled ?? true),
    onNext: () => {
      return resolvedNext();
    },
    onPrev: () => {
      return resolvedPrev();
    },
  });

  const body = (
    <>
      {showProgress ? (
        <span data-keepkit="tour-progress" aria-live="polite">
          {progress ?? `${navigation.currentPosition ?? 0} / ${navigation.items.length}`}
        </span>
      ) : null}
      <TourAction
        href={prevHref}
        disabled={!navigation.hasPrev}
        onClick={prevHref ? onPrev : resolvedPrev}
        data-keep-action="tour-prev"
        shortcut={showShortcutHint ? (shortcutOptions?.prevKeys?.[0] ?? "K") : undefined}
        preview={
          navigation.prevItem ? (
            <>
              {previousLabel}: {getItemTitle(navigation.prevItem)}
            </>
          ) : undefined
        }
      >
        {previousLabel}
      </TourAction>
      <TourAction
        href={nextHref}
        disabled={!navigation.hasNext}
        onClick={nextHref ? onNext : resolvedNext}
        data-keep-action="tour-next"
        shortcut={showShortcutHint ? (shortcutOptions?.nextKeys?.[0] ?? "J") : undefined}
        preview={
          navigation.nextItem ? (
            <>
              {nextItemLabel}: {getItemTitle(navigation.nextItem)}
            </>
          ) : undefined
        }
      >
        {nextItemLabel}
      </TourAction>
      {backHref || onBack ? (
        <TourAction href={backHref} onClick={onBack} data-keep-action="tour-back">
          {listLabel}
        </TourAction>
      ) : null}
    </>
  );
  return renderRoot(
    asChild,
    children,
    { ...props, "data-keepkit": "tour-bar", "aria-label": props["aria-label"] ?? labels.pagination },
    body,
    "KeepTourBar",
  );
}

type TourActionProps = {
  href?: string;
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
  children?: ReactNode;
  "data-keep-action": string;
  preview?: ReactNode;
  shortcut?: string;
};

function TourAction({ href, disabled = false, onClick, children, preview, shortcut, ...props }: TourActionProps) {
  const previewId = useId();
  const content = (
    <>
      <span data-tour-label="true">{children}</span>
      {shortcut ? <KeepShortcutHint shortcut={shortcut} /> : null}
      {preview ? (
        <small id={previewId} data-tour-preview="true">
          {preview}
        </small>
      ) : null}
    </>
  );
  if (href && !disabled) {
    return (
      <a
        {...props}
        href={href}
        onClick={() => void onClick?.()}
        aria-label={String(children)}
        aria-describedby={preview ? previewId : undefined}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      {...props}
      type="button"
      disabled={disabled}
      onClick={() => void onClick?.()}
      aria-label={String(children)}
      aria-describedby={preview ? previewId : undefined}
    >
      {content}
    </button>
  );
}

export const KeepNavigator = KeepTourBar;

function navigateTo(item: unknown, href?: string): void {
  if (!item || !href || typeof window === "undefined") return;
  window.location.assign(href);
}
