"use client";

import type { KeepItem } from "@keepkit/core/core";
import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { useState } from "react";

export type KeepReorderableItemState = {
  index: number;
  isDragging: boolean;
  dragHandleProps: {
    role: "button";
    tabIndex: 0;
    draggable: true;
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
  itemLabel = (_item, index) => `Move item ${index + 1}`,
  ...props
}: KeepReorderableListProps<TItem>) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const ids = items.map((item) => item.id);

  function commit(nextIds: string[]) {
    void onReorder(nextIds);
  }

  function move(index: number, targetIndex: number) {
    if (targetIndex < 0 || targetIndex >= ids.length || targetIndex === index) return;
    const next = [...ids];
    const [id] = next.splice(index, 1);
    if (id === undefined) return;
    next.splice(targetIndex, 0, id);
    commit(next);
  }

  return (
    <ul {...props} data-keepkit="reorderable-list">
      {items.map((item, index) => {
        const moveUp = () => move(index, index - 1);
        const moveDown = () => move(index, index + 1);
        const onHandleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
          if (event.key === "ArrowUp") {
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
            "aria-label": itemLabel(item, index),
            "aria-grabbed": draggedId === item.id,
            onDragStart: () => setDraggedId(item.id),
            onDragEnd: () => setDraggedId(null),
            onKeyDown: onHandleKeyDown,
          },
        };
        return (
          <li
            key={item.id}
            data-reorder-index={index}
            data-dragging={draggedId === item.id ? "true" : undefined}
            onDragOver={(event) => {
              if (draggedId && draggedId !== item.id) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!draggedId || draggedId === item.id) return;
              const sourceIndex = ids.indexOf(draggedId);
              setDraggedId(null);
              move(sourceIndex, index);
            }}
          >
            {renderItem(item, state)}
          </li>
        );
      })}
    </ul>
  );
}
