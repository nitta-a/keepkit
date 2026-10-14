"use client";

import type { KeepItem } from "@keepkit/core/core";
import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { getErrorMessage } from "../../foundation/shared";
import { useUiLabel } from "../../foundation/ui-context";

export type KeepReorderableItemState = {
  index: number;
  isDragging: boolean;
  dragHandleProps: {
    role: "button";
    tabIndex: 0;
    draggable: true;
    "data-drag-handle": "true";
    "aria-label": string;
    "aria-grabbed": boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  };
  moveUp: () => void;
  moveDown: () => void;
};

export type KeepReorderableListProps<TItem extends { id: string } = KeepItem> = Omit<
  HTMLAttributes<HTMLUListElement>,
  "children" | "onChange"
> & {
  items: readonly TItem[];
  onReorder: (orderedIds: string[]) => void | Promise<void>;
  renderItem: (item: TItem, state: KeepReorderableItemState) => ReactNode;
  itemLabel?: (item: TItem, index: number) => string;
};

/** Accessible drag-and-drop list with keyboard up/down fallback and no styling assumptions. */
export function KeepReorderableList<TItem extends { id: string } = KeepItem>({
  items,
  onReorder,
  renderItem,
  itemLabel,
  ...props
}: KeepReorderableListProps<TItem>) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const moveLabel = useUiLabel("moveItem");
  const movedLabel = useUiLabel("reorderMoved");
  const failedLabel = useUiLabel("reorderFailed");
  const getItemLabel = (item: TItem, index: number) => itemLabel?.(item, index) ?? `${moveLabel} ${index + 1}`;
  const ids = items.map((item) => item.id);

  async function commit(nextIds: string[], index: number) {
    const item = items[index];
    if (!item || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setAnnouncement("");
    setError("");
    try {
      await onReorder(nextIds);
      setAnnouncement(`${getItemLabel(item, index)}: ${movedLabel} ${nextIds.indexOf(item.id) + 1}/${nextIds.length}`);
    } catch (cause) {
      setError(getErrorMessage(cause, failedLabel));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function move(index: number, targetIndex: number) {
    if (targetIndex < 0 || targetIndex >= ids.length || targetIndex === index) return;
    const next = [...ids];
    const [id] = next.splice(index, 1);
    if (id === undefined) return;
    next.splice(targetIndex, 0, id);
    void commit(next, index);
  }

  function moveToInsertion(index: number, insertionIndex: number) {
    const next = [...ids];
    const [id] = next.splice(index, 1);
    if (id === undefined) return;
    const targetIndex = Math.min(
      Math.max(0, insertionIndex > index ? insertionIndex - 1 : insertionIndex),
      next.length,
    );
    next.splice(targetIndex, 0, id);
    if (next[index] === id) return;
    void commit(next, index);
  }

  return (
    <>
      <ul {...props} aria-busy={pending || props["aria-busy"]} data-keepkit="reorderable-list">
        {items.map((item, index) => {
          const moveUp = () => move(index, index - 1);
          const moveDown = () => move(index, index + 1);
          const onHandleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
            if (event.key === " ") {
              event.preventDefault();
              if (draggedId === item.id) {
                setDraggedId(null);
                setDropTargetIndex(null);
              } else {
                setDraggedId(item.id);
                setDropTargetIndex(index);
              }
            } else if (event.key === "Escape") {
              event.preventDefault();
              setDraggedId(null);
              setDropTargetIndex(null);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              moveUp();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              moveDown();
            }
          };
          const state: KeepReorderableItemState = {
            index,
            isDragging: draggedId === item.id,
            moveUp,
            moveDown,
            dragHandleProps: {
              role: "button",
              tabIndex: 0,
              draggable: true,
              "data-drag-handle": "true",
              "aria-label": getItemLabel(item, index),
              "aria-grabbed": draggedId === item.id,
              onDragStart: () => {
                setDraggedId(item.id);
                setDropTargetIndex(index);
              },
              onDragEnd: () => {
                setDraggedId(null);
                setDropTargetIndex(null);
              },
              onKeyDown: onHandleKeyDown,
            },
          };
          return (
            <li
              key={item.id}
              data-reorder-index={index}
              data-dragging={draggedId === item.id ? "true" : undefined}
              data-drop-target={
                draggedId && draggedId !== item.id
                  ? dropTargetIndex === index
                    ? "before"
                    : dropTargetIndex === index + 1
                      ? "after"
                      : undefined
                  : undefined
              }
              onDragOver={(event) => {
                if (!draggedId || draggedId === item.id) return;
                event.preventDefault();
                const bounds = event.currentTarget.getBoundingClientRect();
                const insertionIndex = event.clientY > bounds.top + bounds.height / 2 ? index + 1 : index;
                setDropTargetIndex(insertionIndex);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget === event.target) setDropTargetIndex(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!draggedId || draggedId === item.id) return;
                const sourceIndex = ids.indexOf(draggedId);
                setDraggedId(null);
                setDropTargetIndex(null);
                moveToInsertion(sourceIndex, dropTargetIndex ?? index);
              }}
            >
              {renderItem(item, state)}
            </li>
          );
        })}
      </ul>
      <span role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}
