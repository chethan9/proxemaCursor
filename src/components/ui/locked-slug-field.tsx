"use client";

import { useId, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { Lock, LockOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

function norm(s: string) {
  return s.trim();
}

export type LockedSlugFieldProps = {
  /** Defaults to a stable generated id when omitted. */
  id?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  lockedByDefault?: boolean;
  maxLength?: number;
  className?: string;
  /** Saved / server slug for dirty detection when re-locking. Omit on pure create flows (snapshot taken when unlocking). */
  committedValue?: string | null;
  placeholder?: string;
  /** Show the short integration warning below the field (off by default; many parents already have a field hint). */
  showHint?: boolean;
};

const readOnlyClass =
  "flex min-h-10 w-full items-center rounded-md border border-transparent bg-muted/30 px-3 py-2 font-mono text-sm text-muted-foreground outline-none";

export function LockedSlugField({
  id: idProp,
  value,
  onChange,
  disabled,
  lockedByDefault = true,
  maxLength,
  className,
  committedValue,
  placeholder = "",
  showHint = false,
}: LockedSlugFieldProps) {
  const { t } = useTranslation("site");
  const genId = useId();
  const id = idProp ?? genId;
  const [unlocked, setUnlocked] = useState(!lockedByDefault);
  const baselineUnlockRef = useRef(value);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const usesCommitted = committedValue !== undefined;

  function isDirtyForRelock(): boolean {
    if (usesCommitted) {
      return norm(value) !== norm(String(committedValue ?? ""));
    }
    return norm(value) !== norm(baselineUnlockRef.current);
  }

  function handleToggleLock() {
    if (disabled) return;
    if (!unlocked) {
      baselineUnlockRef.current = value;
      setUnlocked(true);
      return;
    }
    if (isDirtyForRelock()) {
      setConfirmOpen(true);
      return;
    }
    setUnlocked(false);
  }

  function confirmDiscard() {
    const revert = usesCommitted ? String(committedValue ?? "") : baselineUnlockRef.current;
    onChange(revert);
    setUnlocked(false);
    setConfirmOpen(false);
  }

  return (
    <>
      <div className={cn("flex gap-2 items-start", className)}>
        <div className="flex-1 min-w-0">
          {!unlocked ? (
            <div id={id} className={readOnlyClass} aria-readonly="true">
              {norm(value) ? (
                value
              ) : (
                <span className="font-sans text-muted-foreground">{placeholder}</span>
              )}
            </div>
          ) : (
            <Input
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              maxLength={maxLength}
              className="h-10 bg-background font-mono text-sm"
              placeholder={placeholder}
              aria-label={t("slugField.inputAria")}
            />
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          disabled={disabled}
          aria-pressed={unlocked}
          aria-label={unlocked ? t("slugField.lock") : t("slugField.unlock")}
          title={unlocked ? t("slugField.lock") : t("slugField.unlock")}
          onClick={handleToggleLock}
        >
          {unlocked ? <LockOpen className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
        </Button>
      </div>
      {showHint ? <p className="text-[11px] text-muted-foreground ps-0.5">{t("slugField.hint")}</p> : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("slugField.relockTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("slugField.relockDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>{t("slugField.keepEditing")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard}>{t("slugField.discard")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
