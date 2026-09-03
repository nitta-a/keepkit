"use client";

import { useKeepSyncFeedback } from "./hooks/useKeepSyncFeedback";

export function KeepSyncFeedbackObserver() {
  useKeepSyncFeedback();
  return null;
}
