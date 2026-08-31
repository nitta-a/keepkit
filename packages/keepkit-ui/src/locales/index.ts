import { DE_LABELS } from "./de";
import { EN_LABELS } from "./en";
import { ES_LABELS } from "./es";
import { FIL_LABELS } from "./fil";
import { FR_LABELS } from "./fr";
import { ID_LABELS } from "./id";
import { IT_LABELS } from "./it";
import { JA_LABELS } from "./ja";
import { KO_LABELS } from "./ko";
import { MS_LABELS } from "./ms";
import { PT_BR_LABELS } from "./pt-BR";
import { RU_LABELS } from "./ru";
import { TH_LABELS } from "./th";
import type { KeepUiLocaleLabels } from "./types";
import { VI_LABELS } from "./vi";
import { ZH_HANS_LABELS } from "./zh-Hans";
import { ZH_HANT_LABELS } from "./zh-Hant";

export const KEEP_BUILT_IN_LOCALES = [
  "en",
  "ja",
  "ko",
  "zh-Hans",
  "zh-Hant",
  "th",
  "fr",
  "es",
  "pt-BR",
  "it",
  "de",
  "ru",
  "fil",
  "vi",
  "id",
  "ms",
] as const;

export type KeepUiLocale = (typeof KEEP_BUILT_IN_LOCALES)[number];

export const KEEP_LOCALE_LABELS: Record<KeepUiLocale, KeepUiLocaleLabels> = {
  en: EN_LABELS,
  ja: JA_LABELS,
  ko: KO_LABELS,
  "zh-Hans": ZH_HANS_LABELS,
  "zh-Hant": ZH_HANT_LABELS,
  th: TH_LABELS,
  fr: FR_LABELS,
  es: ES_LABELS,
  "pt-BR": PT_BR_LABELS,
  it: IT_LABELS,
  de: DE_LABELS,
  ru: RU_LABELS,
  fil: FIL_LABELS,
  vi: VI_LABELS,
  id: ID_LABELS,
  ms: MS_LABELS,
};

const LOCALE_ALIASES: Record<string, KeepUiLocale> = {
  "zh-cn": "zh-Hans",
  "zh-sg": "zh-Hans",
  zh: "zh-Hans",
  "zh-tw": "zh-Hant",
  "zh-hk": "zh-Hant",
  "zh-mo": "zh-Hant",
  "pt-pt": "pt-BR",
};

export function normalizeKeepLocale(locale?: string): KeepUiLocale {
  const normalized = locale?.trim().replace(/_/g, "-").toLowerCase() ?? "en";
  const exact = KEEP_BUILT_IN_LOCALES.find((candidate) => candidate.toLowerCase() === normalized);
  if (exact) return exact;
  if (LOCALE_ALIASES[normalized]) return LOCALE_ALIASES[normalized];
  const language = normalized.split("-")[0];
  const languageMatch = KEEP_BUILT_IN_LOCALES.find((candidate) => candidate.toLowerCase() === language);
  return languageMatch ?? "en";
}

export function getKeepLocaleLabels(locale?: string): KeepUiLocaleLabels {
  return { ...KEEP_LOCALE_LABELS[normalizeKeepLocale(locale)] };
}
