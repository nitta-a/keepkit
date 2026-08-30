import { KeepButton, KeepProvider, type StorageAdapter } from "@keepkit/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";

const item = {
  id: "render-props-item",
  targetType: "article",
  meta: { title: "Render props item" },
};

function createStorage(): StorageAdapter<typeof item.meta> {
  let saved = false;
  return {
    getAll: async () => (saved ? [{ ...item, savedAt: 1, updatedAt: 1 }] : []),
    set: async () => {
      saved = true;
    },
    remove: async () => {
      saved = false;
    },
    clear: async () => {
      saved = false;
    },
  };
}

test("supports render props and asChild while toggling", async () => {
  render(
    <KeepProvider storage={createStorage()}>
      <KeepButton item={item} asChild>
        {(state) => (
          <a href="/saved" data-testid="save-link">
            {String(state.isSaved)}
          </a>
        )}
      </KeepButton>
    </KeepProvider>,
  );

  const link = await screen.findByTestId("save-link");
  expect(link).toHaveTextContent("false");
  fireEvent.click(link);
  await waitFor(() => expect(link).toHaveTextContent("true"));
  expect(link).toHaveAttribute("aria-pressed", "true");
});
