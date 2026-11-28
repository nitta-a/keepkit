import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { forwardRef } from "react";
import { expect, test } from "vitest";
import type { KeepUiIcons } from "../src/foundation/ui-context";
import {
  KeepBulkActions,
  KeepButton,
  type KeepButtonIconProps,
  KeepCollectionFilter,
  KeepCollectionManager,
  KeepItemCard,
  KeepItemStatusBadge,
  KeepList,
  KeepProvider,
  KeepPruneStaleButton,
  KeepSavePopover,
  KeepUiProvider,
} from "../src/index";

const item = { id: "article", meta: { title: "Article" }, savedAt: 1, updatedAt: 1, collectionId: "Reading" };
type Meta = typeof item.meta;

function storage(initial: KeepItem<Meta>[] = []): StorageAdapter<Meta> {
  const items = new Map(initial.map((entry) => [entry.id, entry]));
  return {
    getAll: async () => [...items.values()],
    set: async (entry) => void items.set(entry.id, entry),
    remove: async (id) => void items.delete(id),
    clear: async () => items.clear(),
  };
}

test("popover and list share decorative icons while local saved wins over the provider remove slot", async () => {
  const Bookmark = forwardRef<SVGSVGElement, KeepButtonIconProps>((props, ref) => <svg ref={ref} {...props} />);
  const icons: KeepUiIcons = {
    save: Bookmark,
    remove: <b>Trash glyph</b>,
    collection: <b>Folder glyph</b>,
  };
  render(
    <KeepProvider storage={storage()}>
      <KeepUiProvider icons={icons}>
        <KeepSavePopover item={item} buttonProps={{ icons: { saved: "Local check" }, iconClassName: "bookmark" }} />
        <KeepList aria-label="Saved articles" itemCardProps={{ presentation: "reading" }} />
        <KeepCollectionFilter />
        <KeepCollectionManager allowCreate={false} />
      </KeepUiProvider>
    </KeepProvider>,
  );
  const trigger = await screen.findByRole("button", { name: "Save: Article" });
  expect(trigger.querySelector("svg.bookmark")?.getAttribute("aria-hidden")).toBe("true");
  fireEvent.click(trigger);
  const dialog = await screen.findByRole("dialog");
  expect(trigger.textContent).toBe("Local checkSaved");
  const collection = within(dialog).getByRole("combobox", { name: "Collection" });
  const fieldIcon = within(dialog).getByText("Folder glyph");
  expect(collection.closest("label")?.contains(fieldIcon)).toBe(true);
  expect(fieldIcon.closest("[aria-hidden=true]")).not.toBeNull();
  expect(fieldIcon.closest("[data-keep-field-icon]")?.getAttribute("data-has-custom-icon")).toBe("true");
  const card = await within(screen.getByRole("group", { name: "Saved articles" })).findByRole("listitem");
  expect(within(card).getByText("Folder glyph").closest("[data-keep-card-part=collection-badge]")?.textContent).toBe(
    "Folder glyphReading",
  );
  expect(within(card).getByText("Trash glyph").closest("button")?.getAttribute("data-has-custom-icon")).toBe("true");
  const filter = screen.getAllByRole("combobox", { name: "Collection" }).find((control) => control !== collection);
  expect(filter?.closest("label")?.querySelector("[data-keep-icon]")?.textContent).toBe("Folder glyph");
  const manager = screen.getByRole("region", { name: "Manage collections" });
  expect(within(manager).getByRole("listitem").querySelector("[data-keep-icon]")?.textContent).toBe("Folder glyph");
});

test("partial slots leave the default CSS glyph active; hidden button text retains its localized name", async () => {
  render(
    <KeepProvider storage={storage()}>
      <KeepUiProvider icons={{ saved: "Global check" }} labelOptions={{ save: { text: "Bookmark", visible: false } }}>
        <KeepButton item={item} showLabel={false} />
      </KeepUiProvider>
    </KeepProvider>,
  );
  const button = await screen.findByRole("button", { name: "Bookmark: Article" });
  expect(button.hasAttribute("data-has-custom-icon")).toBe(false);
  expect(button.textContent).toBe("");
  fireEvent.click(button);
  await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("true"));
  expect(button.getAttribute("data-has-custom-icon")).toBe("true");
  expect(button.textContent).toBe("Global check");
  fireEvent.click(button);
  await waitFor(() => expect(button.hasAttribute("data-has-custom-icon")).toBe(false));
});

test("resolves pending and failed mutations independently of the default and saved icon slots", async () => {
  const adapter = storage();
  let finishRead: ((items: KeepItem<Meta>[]) => void) | undefined;
  const read = new Promise<KeepItem<Meta>[]>((resolve) => (finishRead = resolve));
  adapter.getAll = () => read;
  let rejectWrite: ((error: Error) => void) | undefined;
  adapter.set = () => new Promise<void>((_, reject) => (rejectWrite = reject));
  render(
    <KeepProvider storage={adapter}>
      <KeepUiProvider icons={{ save: "Provider save", loading: "Provider pending", error: "Provider error" }}>
        <KeepButton item={item} icons={{ loading: "Local pending" }} iconOnly />
      </KeepUiProvider>
    </KeepProvider>,
  );
  const button = await screen.findByRole("button", { name: "Save: Article" });
  expect(button.textContent).toBe("Local pending");
  await act(async () => finishRead?.([]));
  expect(button.textContent).toBe("Provider save");
  fireEvent.click(button);
  await waitFor(() => expect(button.textContent).toBe("Local pending"));
  await act(async () => rejectWrite?.(new Error("Storage failed")));
  await waitFor(() => expect(button.textContent).toBe("Provider error"));
  expect(button.getAttribute("data-state")).toBe("error");
});

test("custom children, render functions, and asChild keep control of the rendered content", async () => {
  render(
    <KeepProvider storage={storage()}>
      <KeepUiProvider icons={{ save: "Save glyph", remove: "Remove glyph", collection: "Folder glyph" }}>
        <KeepButton item={item} asChild labels={{ loading: "Pending" }}>
          {({ isSaved }) => <a href="#item">{isSaved ? "Unmark" : "Mark"}</a>}
        </KeepButton>
        <KeepButton item={item}>Custom toggle</KeepButton>
        <KeepItemCard item={item}>
          <KeepItemCard.Remove>Custom action</KeepItemCard.Remove>
          <KeepItemCard.CollectionBadge>Custom folder</KeepItemCard.CollectionBadge>
        </KeepItemCard>
      </KeepUiProvider>
    </KeepProvider>,
  );
  const trigger = await screen.findByText("Mark");
  expect(trigger.tagName).toBe("A");
  expect(trigger.getAttribute("role")).toBe("button");
  fireEvent.keyDown(trigger, { key: "Enter" });
  await screen.findByText("Unmark");
  expect(trigger.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Custom toggle").tagName).toBe("BUTTON");
  expect(screen.getByRole("button", { name: "Custom action" })).toBeDefined();
  expect(screen.getByText("Custom folder")).toBeDefined();
  expect(document.querySelector("[data-keep-icon]")).toBeNull();
});

test("status icons prefer exact overrides, fall back to normalized slots, and retain names without text", () => {
  render(
    <KeepUiProvider
      icons={{ status: { available: "OK", removed: "Ban", deleted: "Trash", restricted: "Lock", unknown: "?" } }}
      labelOptions={{ statusAvailable: { visible: false } }}
    >
      <KeepItemStatusBadge />
      <KeepItemStatusBadge status="expired" />
      <KeepItemStatusBadge status="removed" />
      <KeepItemStatusBadge status="deleted" />
      <KeepItemStatusBadge status="private" aria-label="Private item" />
      <KeepItemStatusBadge status="restricted" />
      <KeepItemStatusBadge status="unknown" />
    </KeepUiProvider>,
  );
  expect(screen.getByRole("img", { name: "Available" }).textContent).toBe("OK");
  expect(screen.getByRole("img", { name: "Expired" }).querySelector('svg[data-status-icon="clock"]')).not.toBeNull();
  for (const [name, glyph] of [
    ["Removed", "Ban"],
    ["Deleted", "Trash"],
    ["Private item", "Lock"],
    ["Private", "Lock"],
    ["Unable to verify", "?"],
  ]) {
    const badge = screen.getByRole("img", { name });
    expect(badge.querySelector("[aria-hidden=true]")?.textContent).toBe(glyph);
    expect(badge.querySelector("svg")).toBeNull();
  }
});

test("item, stale-item and batch removal actions keep accessible labels when their decorative icon changes", async () => {
  const expired = { ...item, id: "expired", status: "expired" as const };
  render(
    <KeepProvider storage={storage([item, expired])}>
      <KeepUiProvider
        icons={{ remove: "R" }}
        labelOptions={{
          remove: { visible: false },
          removeFromList: { visible: false },
          deleteSelected: { visible: false },
        }}
      >
        <KeepList itemCardProps={{ showSaveButton: false }} />
        <KeepBulkActions defaultSelectedIds={[item.id]} confirmRemoval />
        <KeepPruneStaleButton />
      </KeepUiProvider>
    </KeepProvider>,
  );
  for (const name of ["Remove", "Remove from list", "Delete selected", "Remove unavailable items (1)"]) {
    const button = await screen.findByRole("button", { name });
    expect(button.querySelector("[aria-hidden=true]")?.textContent).toBe("R");
    expect(button.getAttribute("data-has-custom-icon")).toBe("true");
  }
  fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByRole("button", { name: "Delete selected" }).querySelector("[data-keep-icon]"),
  ).not.toBeNull();
});
