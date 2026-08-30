import { KeepButton, KeepProvider } from "@keepkit/core/react";
import { LocalStorageAdapter } from "@keepkit/core/storage";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

test("hydrates from the same initial snapshot and synchronizes a Pages Router button", async () => {
  const storage = new LocalStorageAdapter({ key: "test:keep-items", storage: window.localStorage });
  render(
    <KeepProvider storage={storage} initialItems={[]}>
      <KeepButton
        item={{ id: "article-123", meta: { title: "Example" } }}
        unsavedAriaLabel="Save article"
        savedAriaLabel="Remove article"
      />
    </KeepProvider>,
  );

  const button = await screen.findByRole("button", { name: "Save article" });
  fireEvent.click(button);
  await waitFor(() => expect(button).toHaveAccessibleName("Remove article"));
  expect((await storage.getAll()).map((item) => item.id)).toEqual(["article-123"]);
});
