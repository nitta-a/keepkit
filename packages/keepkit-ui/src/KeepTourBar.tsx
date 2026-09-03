"use client";

import { type UseKeepNavigatorResult, useKeepNavigator } from "@keepkit/core/react";
import type { HTMLAttributes, ReactNode } from "react";
import { type KeepTourShortcutsOptions, useKeepTourShortcuts } from "./hooks/useKeepTourShortcuts";
import { useKeepUiLabels, useUiLabel } from "./ui-context";

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
  shortcutOptions?: Omit<KeepTourShortcutsOptions, "onNext" | "onPrev">;
  progress?: ReactNode;
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
  shortcutOptions,
  progress,
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

  return (
    <nav {...props} data-keepkit="tour-bar" aria-label={props["aria-label"] ?? labels.pagination}>
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
      >
        {previousLabel}
      </TourAction>
      <TourAction
        href={nextHref}
        disabled={!navigation.hasNext}
        onClick={nextHref ? onNext : resolvedNext}
        data-keep-action="tour-next"
      >
        {nextItemLabel}
      </TourAction>
      {backHref || onBack ? (
        <TourAction href={backHref} onClick={onBack} data-keep-action="tour-back">
          {listLabel}
        </TourAction>
      ) : null}
    </nav>
  );
}

type TourActionProps = {
  href?: string;
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
  children?: ReactNode;
  "data-keep-action": string;
};

function TourAction({ href, disabled = false, onClick, children, ...props }: TourActionProps) {
  if (href && !disabled) {
    return (
      <a {...props} href={href} onClick={() => void onClick?.()}>
        {children}
      </a>
    );
  }
  return (
    <button {...props} type="button" disabled={disabled} onClick={() => void onClick?.()}>
      {children}
    </button>
  );
}

export const KeepNavigator = KeepTourBar;

function navigateTo(item: unknown, href?: string): void {
  if (!item || !href || typeof window === "undefined") return;
  window.location.assign(href);
}
