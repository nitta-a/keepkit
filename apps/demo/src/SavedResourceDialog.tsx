import type { KeepSavePopoverPanelContext } from "@keepkit/ui/save-popover";
import { useLayoutEffect, useRef } from "react";
import type { DemoMeta } from "./main";

export function SavedResourceDialog({
  panelId,
  dialogLabel,
  content,
  requestClose,
  triggerRef,
}: KeepSavePopoverPanelContext<DemoMeta>) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      dialog.close();
      queueMicrotask(() => {
        const trigger = triggerRef.current;
        if (dialog.isConnected || !trigger?.isConnected) return;
        if (!trigger.matches(":disabled")) {
          trigger.focus();
          return;
        }
        // The last collection write can keep the trigger disabled beyond the dialog's unmount.
        const previousFocus = document.activeElement;
        const observer = new MutationObserver(() => {
          if (trigger.matches(":disabled")) return;
          observer.disconnect();
          if (document.activeElement === previousFocus) trigger.focus();
        });
        observer.observe(trigger, { attributes: true, attributeFilter: ["disabled"] });
      });
    };
  }, [triggerRef]);

  async function dismiss() {
    if (!(await requestClose())) ref.current?.querySelector<HTMLElement>('[role="alert"]')?.focus();
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape fires native cancel; Done is also keyboard accessible.
    <dialog
      ref={ref}
      id={panelId}
      className="saved-resource-dialog"
      aria-labelledby={`${panelId}-heading`}
      onCancel={(event) => {
        event.preventDefault();
        void dismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) void dismiss();
      }}
    >
      <div className="saved-resource-content">
        <h2 id={`${panelId}-heading`}>{dialogLabel}</h2>
        {content}
        <button type="button" className="primary-button" onClick={() => void dismiss()}>
          Done
        </button>
      </div>
    </dialog>
  );
}
