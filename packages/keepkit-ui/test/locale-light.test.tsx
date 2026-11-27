import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { KeepUiProvider } from "../src/entries/ui-provider-light";
import { useUiLabel } from "../src/foundation/ui-context";
import { JA_LABELS } from "../src/locales/ja";

function Labels() {
  return (
    <div>
      {useUiLabel("save")} / {useUiLabel("remove")}
    </div>
  );
}

test("the lightweight provider uses the supplied dictionary and supports label overrides", () => {
  const { rerender } = render(
    <KeepUiProvider locale="ja" dictionary={JA_LABELS} labels={{ save: "保存する" }}>
      <Labels />
    </KeepUiProvider>,
  );
  expect(screen.getByText(`保存する / ${JA_LABELS.remove}`)).toBeTruthy();
  rerender(
    <KeepUiProvider>
      <Labels />
    </KeepUiProvider>,
  );
  expect(screen.getByText("Save / Remove")).toBeTruthy();
});
