"use client";

import { useState } from "react";
import { t } from "@/i18n/th";

interface ConfirmArchiveDialogProps {
  itemLabel: string;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmArchiveDialog({ itemLabel, onConfirm }: ConfirmArchiveDialogProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function closeDialog() {
    setStep(0);
    setConfirmText("");
    setIsSubmitting(false);
  }

  async function handleFinalConfirm() {
    if (confirmText.trim() !== "ARCHIVE" || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm();
      closeDialog();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setStep(1)}
        className="rounded-md border border-danger px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
      >
        {t("archive.button")}
      </button>

      {step > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md space-y-4 rounded-lg border border-line bg-surface p-6 shadow-lg">
            {step === 1 ? (
              <>
                <h3 className="text-base font-semibold text-ink">{t("archive.step1.title")}</h3>
                <p className="text-sm text-ink-muted">
                  {t("archive.step1.body")} ({itemLabel})
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink"
                  >
                    {t("archive.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white"
                  >
                    {t("archive.step1.next")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-ink">{t("archive.step2.title")}</h3>
                <p className="text-sm text-ink-muted">
                  {t("archive.step2.body")} ({itemLabel})
                </p>
                <input
                  type="text"
                  placeholder="ARCHIVE"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink"
                  >
                    {t("archive.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={confirmText.trim() !== "ARCHIVE" || isSubmitting}
                    onClick={handleFinalConfirm}
                    className="rounded-md bg-danger px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {t("archive.step2.confirm")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
