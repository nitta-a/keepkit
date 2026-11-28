import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { KeepUiProvider } from "../src/entries/ui-provider-light";
import { useUiLabel } from "../src/foundation/ui-context";
import { getKeepLocaleLabels } from "../src/locales";
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

test("Japanese removal and unknown-status messages describe their meaning", () => {
  expect(JA_LABELS.removedMessage).toBe("保存から外しました。");
  expect(JA_LABELS.undoAvailable).toBe("保存から外しました。元に戻しますか？");
  expect(JA_LABELS.statusUnknown).toBe("確認できません");
});

test.each([
  ["en", "Unable to verify"],
  ["de", "Nicht überprüfbar"],
  ["es", "No se pudo verificar"],
  ["fr", "Impossible à vérifier"],
  ["it", "Impossibile verificare"],
  ["pt-BR", "Não foi possível verificar"],
  ["ru", "Не удалось проверить"],
  ["ko", "확인할 수 없음"],
  ["zh-Hans", "无法确认"],
  ["zh-Hant", "無法確認"],
  ["fil", "Hindi ma-verify"],
  ["id", "Tidak dapat diverifikasi"],
  ["ms", "Tidak dapat disahkan"],
  ["vi", "Không thể xác minh"],
  ["th", "ไม่สามารถตรวจสอบได้"],
])("%s labels unknown status as unverified", (locale, expected) => {
  expect(getKeepLocaleLabels(locale).statusUnknown).toBe(expected);
});
